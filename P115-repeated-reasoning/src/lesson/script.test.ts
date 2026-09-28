import { describe, expect, it } from 'vitest';
import { CHAPTERS, ALL_BEATS, answerFor, totalPlaybackMs, type Beat } from './script';
import { computeFrame, describeFrame, type Frame } from './frame';
import {
  BUILD_GROUP_COUNTS,
  GROUP_SIZE,
  PROPOSED_TERM,
  STICKERS,
  TRANSFER_GROUPS,
  totalFor,
  type LayoutName,
} from '@/model/repeatedReasoning';

const LAYOUTS: LayoutName[] = ['wide', 'narrow'];
const wholeWord = (s: string) => new RegExp(`(^|[^0-9])${s}([^0-9]|$)`);

/** Every piece of text a frame would put in the DOM. */
function frameTexts(f: Frame): string[] {
  const out: string[] = [f.header];
  if (f.banner) out.push(f.banner.text);
  for (const c of f.crates) {
    out.push(c.label);
    if (c.badge) out.push(c.badge.text);
  }
  if (f.counter) out.push(String(f.counter.value));
  if (f.table) {
    out.push(...f.table.rowLabels.map((r) => r.text), ...f.table.headers.map((h) => h.text));
    out.push(...f.table.cells.map((c) => c.text), ...f.table.arcs.map((a) => a.label));
  }
  if (f.bubble) out.push(...f.bubble.lines);
  out.push(...f.sheets.map((s) => s.label), ...f.runs.map((r) => r.text), ...f.runArcs.map((a) => a.label));
  if (f.ruleLine) out.push(f.ruleLine.text);
  out.push(describeFrame(f));
  return out;
}

function sampleTimes(b: Beat): number[] {
  const ts = new Set<number>([0, b.duration / 4, b.duration / 2, (3 * b.duration) / 4, b.duration]);
  for (const e of b.timeline ?? []) {
    ts.add(e.at);
    ts.add(e.at + e.dur / 2);
    ts.add(e.at + e.dur);
  }
  return [...ts].filter((t) => t >= 0 && t <= b.duration);
}

describe('lesson structure', () => {
  it('has five short chapters in the teaching order', () => {
    expect(CHAPTERS.map((c) => c.id)).toEqual(['build', 'pattern', 'rule', 'check', 'transfer']);
  });

  it('runs about 2–4 minutes with no learner pauses', () => {
    const ms = totalPlaybackMs();
    expect(ms).toBeGreaterThanOrEqual(120_000);
    expect(ms).toBeLessThanOrEqual(240_000);
  });

  it('uses predict, animate, explain, and try in every chapter it needs them', () => {
    const phases = new Set(ALL_BEATS.map((b) => b.data.phase));
    expect(phases).toEqual(new Set(['predict', 'animate', 'explain', 'try']));
    for (const c of CHAPTERS) expect(c.beats.length).toBeGreaterThan(2);
  });

  it('has unique beat ids and only waits where it should', () => {
    const ids = ALL_BEATS.map((b) => b.data.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const { data } of ALL_BEATS) {
      if (data.wait === 'question') expect(data.question).toBeDefined();
      if (data.question) expect(data.wait).toBe('question');
      if (data.wait === 'gate') expect(data.actionLabel).toMatch(/^Pack crate \d$/);
      expect(data.duration).toBeGreaterThan(0);
    }
  });

  it('lets learners build 1–4 groups and records 5, 10, 15, 20', () => {
    const build = CHAPTERS[0];
    const recorded = build.beats.filter((b) => b.id.startsWith('c1-fill')).map((b) => b.caption.match(/Leo writes (\d+)\./)?.[1]);
    expect(recorded).toEqual(['5', '10', '15', '20']);
    expect(build.beats.filter((b) => b.wait === 'gate')).toHaveLength(BUILD_GROUP_COUNTS.length);
  });

  it('asks for the next total, checks Pip’s wrong term, monitors crate 6, and has one fresh transfer question', () => {
    const qs = ALL_BEATS.filter((b) => b.data.question).map((b) => b.data.question!);
    expect(qs.map((q) => q.id)).toEqual(['predict-5', 'check-pip', 'monitor-6', 'transfer-7']);
    expect(answerFor(qs[0])).toBe('25');
    expect(answerFor(qs[1])).toBe('short');
    expect(answerFor(qs[2])).toBe('30');
    expect(answerFor(qs[3])).toBe('35');
    const transfer = qs[3];
    expect(transfer.kind === 'number' && transfer.context).toBe(STICKERS);
    expect(transfer.kind === 'number' && transfer.groups).toBe(TRANSFER_GROUPS);
  });

  it('every number in the captions comes from the model', () => {
    const allowed = new Set<string>();
    for (let g = 0; g <= 7; g++) {
      allowed.add(String(g));
      allowed.add(String(totalFor(g)));
    }
    allowed.add(String(GROUP_SIZE));
    allowed.add(String(PROPOSED_TERM.total));
    for (let v = 1; v <= 30; v++) allowed.add(String(v)); // counting on by ones between totals
    allowed.add(String(totalFor(TRANSFER_GROUPS, STICKERS)));
    for (const { data } of ALL_BEATS) {
      for (const n of data.caption.match(/\d+/g) ?? []) expect(allowed.has(n), `${n} in "${data.caption}"`).toBe(true);
    }
  });
});

describe('frames', () => {
  const beat = (id: string) => ALL_BEATS.find((b) => b.data.id === id)!.data;

  it('after building four crates shows 20 apples and totals 5, 10, 15, 20', () => {
    for (const L of LAYOUTS) {
      const b = beat('c1-wrap');
      const f = computeFrame(b, b.duration, L, false);
      expect(f.crates).toHaveLength(4);
      expect(f.crates.flatMap((c) => c.slots.filter((s) => s.apple >= 1))).toHaveLength(20);
      expect(f.table!.cells.filter((c) => c.kind === 'total').map((c) => c.text)).toEqual(['5', '10', '15', '20']);
      expect(f.header).toMatch(/4/);
    }
  });

  it('counts on intermediate results: 21, 22, 23, 24 then an empty spot', () => {
    const b = beat('c4-count');
    const f = computeFrame(b, b.duration, 'wide', false);
    expect(f.counter?.value).toBe(24);
    const crate5 = f.crates.find((c) => c.n === 5)!;
    expect(crate5.slots.filter((s) => s.apple >= 1)).toHaveLength(4);
    expect(f.focus?.circles).toHaveLength(1);
    const mid = computeFrame(b, 300 + 480 * 1 + 420, 'wide', false);
    expect(mid.counter?.value).toBe(22);
  });

  it('corrects Pip’s 24 with the model: crossed out, 25 written', () => {
    const b = beat('c4-fix');
    const f = computeFrame(b, b.duration, 'narrow', false);
    const guess = f.table!.cells.find((c) => c.id === 'guess')!;
    expect(guess.kind).toBe('guessCrossed');
    expect(guess.strike).toBe(1);
    expect(f.table!.cells.find((c) => c.id === 'total-5')!.text).toBe('25');
    expect(f.counter?.value).toBe(25);
  });

  it('reduced motion shows the final state of every beat at once', () => {
    for (const L of LAYOUTS) {
      for (const { data } of ALL_BEATS) {
        expect(computeFrame(data, 0, L, true)).toEqual(computeFrame(data, data.duration, L, false));
      }
    }
  });

  it('keeps stable identities for apples across beats', () => {
    const ids = (id: string) =>
      computeFrame(beat(id), beat(id).duration, 'wide', false)
        .crates.flatMap((c) => c.slots.filter((s) => s.apple > 0).map((s) => s.id));
    const four = ids('c1-wrap');
    const six = ids('c4-fill6');
    expect(six.slice(0, four.length)).toEqual(four);
    expect(new Set(six).size).toBe(30);
  });

  it('never includes elements that have not appeared yet', () => {
    for (const { data } of ALL_BEATS) {
      for (const t of sampleTimes(data)) {
        const f = computeFrame(data, t, 'wide', false);
        for (const c of f.crates) expect(c.p).toBeGreaterThan(0);
        for (const c of f.table?.cells ?? []) expect(c.p).toBeGreaterThan(0);
        for (const a of f.table?.arcs ?? []) expect(a.p).toBeGreaterThan(0);
        for (const r of f.runs) expect(r.p).toBeGreaterThan(0);
      }
    }
  });
});

describe('no answer leaks before submission', () => {
  const questionBeats = ALL_BEATS.filter((b) => b.data.question);

  for (const qb of questionBeats) {
    const q = qb.data.question!;
    if (q.kind !== 'number') continue;
    const answer = answerFor(q);
    it(`${q.id}: the answer ${answer} is not in any caption, label, or description before it is asked`, () => {
      const chapter = CHAPTERS[qb.chapter];
      const upTo = chapter.beats.slice(0, qb.beat + 1);
      expect(q.prompt).not.toMatch(wholeWord(answer));
      for (const b of upTo) {
        expect(b.caption, b.id).not.toMatch(wholeWord(answer));
        for (const L of LAYOUTS) {
          for (const t of sampleTimes(b)) {
            for (const text of frameTexts(computeFrame(b, t, L, false))) expect(text, `${b.id} @${t} ${L}`).not.toMatch(wholeWord(answer));
          }
          for (const text of frameTexts(computeFrame(b, 0, L, true))) expect(text, `${b.id} reduced ${L}`).not.toMatch(wholeWord(answer));
        }
      }
    });
  }

  it('check-pip: options never reveal the fifth total', () => {
    const q = questionBeats.find((b) => b.data.question!.id === 'check-pip')!.data.question!;
    expect(q.kind).toBe('choice');
    if (q.kind === 'choice') for (const o of q.options) expect(o.text).not.toMatch(wholeWord('25'));
    const chapter = CHAPTERS[3];
    for (const b of chapter.beats.slice(0, 3)) {
      expect(b.caption).not.toMatch(wholeWord('25'));
      for (const text of frameTexts(computeFrame(b, b.duration, 'wide', false))) expect(text).not.toMatch(wholeWord('25'));
    }
  });
});
