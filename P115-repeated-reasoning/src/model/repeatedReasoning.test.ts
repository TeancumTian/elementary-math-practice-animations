import { describe, expect, it } from 'vitest';
import {
  GROUP_SIZE,
  ORCHARD,
  ORCHARD_MAX_GROUPS,
  PROPOSED_TERM,
  STICKERS,
  appleCenter,
  buildGroups,
  checkGroupTotal,
  checkProposalChoice,
  claimHolds,
  counterRect,
  crateRect,
  differences,
  endsInZeroOrFive,
  equationLabel,
  getLayout,
  headerLabel,
  isWholeGroupsTotal,
  multiplicationLabel,
  proposalOptions,
  repeatedAdditionLabel,
  revealGroupTotal,
  ruleTotal,
  runningTotals,
  sheetRect,
  starCenter,
  tableArc,
  tableColRect,
  tableColX,
  totalFor,
  type LayoutName,
  type Rect,
} from './repeatedReasoning';

const wholeWord = (n: number) => new RegExp(`(^|[^0-9])${n}([^0-9]|$)`);

describe('concrete verification cases', () => {
  it('1–6 groups of 5 give totals 5, 10, 15, 20, 25, 30', () => {
    expect(runningTotals(6)).toEqual([5, 10, 15, 20, 25, 30]);
    expect([1, 2, 3, 4, 5, 6].map((g) => totalFor(g))).toEqual([5, 10, 15, 20, 25, 30]);
  });

  it('successive totals differ by exactly 5', () => {
    const d = differences(runningTotals(6));
    expect(d).toEqual([5, 5, 5, 5, 5]);
    expect(new Set(d)).toEqual(new Set([GROUP_SIZE]));
  });

  it('the fifth total is 25, not 24', () => {
    expect(totalFor(5)).toBe(25);
    expect(totalFor(5)).not.toBe(PROPOSED_TERM.total);
    expect(PROPOSED_TERM).toEqual({ groups: 5, total: 24 });
    const wrong = checkGroupTotal('24', 5);
    expect(wrong.correct).toBe(false);
    expect(wrong.attempt).toBe(true);
    expect(checkGroupTotal('25', 5).correct).toBe(true);
  });

  it('the proposed 24 is rejected by the model, with a reason based on the groups', () => {
    const correct = proposalOptions().filter((o) => claimHolds(o.claim));
    expect(correct.map((o) => o.id)).toEqual(['short']);
    expect(correct[0].text).toContain('24 is only 4 more than 20');
    expect(isWholeGroupsTotal(24)).toBe(false);
    expect(endsInZeroOrFive(24)).toBe(false);
  });
});

describe('equal groups justify the rule', () => {
  it('builds equal groups with stable, unique ids', () => {
    const groups = buildGroups(6);
    expect(groups.map((g) => g.id)).toEqual(['crate-1', 'crate-2', 'crate-3', 'crate-4', 'crate-5', 'crate-6']);
    for (const g of groups) expect(g.itemIds).toHaveLength(GROUP_SIZE);
    const ids = groups.flatMap((g) => g.itemIds);
    expect(new Set(ids).size).toBe(ids.length);
    expect(groups[2].itemIds[4]).toBe('apple-3-5');
    expect(buildGroups(6)).toEqual(groups); // deterministic
  });

  it('repeated addition (counting the groups) always equals groups × 5', () => {
    for (let g = 0; g <= 40; g++) {
      expect(totalFor(g)).toBe(ruleTotal(g));
      expect(totalFor(g)).toBe(g * 5);
    }
  });

  it('every total of full groups ends in 0 or 5', () => {
    for (let g = 0; g <= 40; g++) {
      expect(isWholeGroupsTotal(totalFor(g))).toBe(true);
      expect(endsInZeroOrFive(totalFor(g))).toBe(true);
    }
  });

  it('rejects non-whole group counts', () => {
    expect(() => totalFor(-1)).toThrow(RangeError);
    expect(() => totalFor(2.5)).toThrow(RangeError);
  });

  it('transfer context uses the same model: 7 sheets of 5 stars is 35', () => {
    expect(runningTotals(7, STICKERS)).toEqual([5, 10, 15, 20, 25, 30, 35]);
    expect(totalFor(7, STICKERS)).toBe(35);
  });
});

describe('labels', () => {
  it('writes repeated addition, multiplication, and equations from the model', () => {
    expect(repeatedAdditionLabel(3)).toBe('5 + 5 + 5');
    expect(repeatedAdditionLabel(1)).toBe('5');
    expect(multiplicationLabel(4)).toBe('4 × 5');
    expect(equationLabel(5)).toBe('5 × 5 = 25');
    expect(equationLabel(6)).toBe('6 × 5 = 30');
  });

  it('keeps the group count and group size explicit in the header', () => {
    expect(headerLabel('wide', 4, ORCHARD)).toBe('Crates packed: 4 · Apples in each crate: 5');
    expect(headerLabel('narrow', 4, ORCHARD)).toBe('Crates: 4 · 5 apples each');
    expect(headerLabel('wide', 7, STICKERS)).toBe('Sheets: 7 · Stars on each sheet: 5');
  });
});

describe('answer checks and specific corrective feedback', () => {
  it('does not count empty or non-numeric input as an attempt', () => {
    expect(checkGroupTotal('', 5)).toMatchObject({ attempt: false, code: 'empty' });
    expect(checkGroupTotal('  ', 5)).toMatchObject({ attempt: false, code: 'empty' });
    expect(checkGroupTotal('2x', 5)).toMatchObject({ attempt: false, code: 'notNumber' });
    expect(checkGroupTotal('-5', 5)).toMatchObject({ attempt: false, code: 'notNumber' });
  });

  it('diagnoses common mistakes for the fifth total', () => {
    expect(checkGroupTotal('24', 5)).toMatchObject({ code: 'addedTooFew' });
    expect(checkGroupTotal('24', 5).message).toContain('only 4 more than 20');
    expect(checkGroupTotal('21', 5).message).toContain('only 1 more than 20');
    expect(checkGroupTotal('20', 5)).toMatchObject({ code: 'previousTotal' });
    expect(checkGroupTotal('20', 5).message).toContain('total for 4 crates');
    expect(checkGroupTotal('30', 5)).toMatchObject({ code: 'wrongGroupCount' });
    expect(checkGroupTotal('30', 5).message).toContain('one crate too many');
    expect(checkGroupTotal('10', 5)).toMatchObject({ code: 'addedCountAndSize' });
    expect(checkGroupTotal('27', 5)).toMatchObject({ code: 'notWholeGroups' });
    expect(checkGroupTotal('27', 5).message).toContain('end in 0 or 5');
  });

  it('diagnoses common mistakes for the monitored sixth total', () => {
    expect(checkGroupTotal('30', 6).correct).toBe(true);
    expect(checkGroupTotal('25', 6)).toMatchObject({ code: 'previousTotal' });
    expect(checkGroupTotal('29', 6)).toMatchObject({ code: 'addedTooFew' });
    expect(checkGroupTotal('11', 6)).toMatchObject({ code: 'addedCountAndSize' });
  });

  it('diagnoses common mistakes for the transfer question (7 sheets of 5)', () => {
    expect(checkGroupTotal('35', 7, STICKERS).correct).toBe(true);
    expect(checkGroupTotal('12', 7, STICKERS)).toMatchObject({ code: 'addedCountAndSize' });
    expect(checkGroupTotal('12', 7, STICKERS).message).toContain('7 + 5');
    expect(checkGroupTotal('7', 7, STICKERS)).toMatchObject({ code: 'countedGroups' });
    expect(checkGroupTotal('30', 7, STICKERS)).toMatchObject({ code: 'previousTotal' });
    expect(checkGroupTotal('40', 7, STICKERS).message).toContain('one sheet too many');
    expect(checkGroupTotal('36', 7, STICKERS)).toMatchObject({ code: 'notWholeGroups' });
  });

  it('never states the correct total in wrong-answer feedback (no leaks)', () => {
    const cases: [number, typeof ORCHARD][] = [
      [5, ORCHARD],
      [6, ORCHARD],
      [7, STICKERS],
    ];
    for (const [groups, ctx] of cases) {
      const answer = totalFor(groups, ctx);
      for (let v = 0; v <= 300; v++) {
        if (v === answer) continue;
        const fb = checkGroupTotal(String(v), groups, ctx);
        expect(fb.correct).toBe(false);
        expect(fb.message, `input ${v} for ${groups} groups`).not.toMatch(wholeWord(answer));
      }
    }
  });

  it('gives specific feedback for each claim about Pip’s guess, without stating 25', () => {
    for (const o of proposalOptions()) {
      const fb = checkProposalChoice(o.id);
      expect(fb.correct).toBe(o.id === 'short');
      expect(fb.message).not.toMatch(wholeWord(25));
      expect(o.text).not.toMatch(wholeWord(25));
    }
    expect(checkProposalChoice('step-claim').message).toContain('+5, not +4');
    expect(checkProposalChoice('bigger').message).toContain('Bigger is not enough');
    expect(checkProposalChoice('nope')).toMatchObject({ attempt: false });
  });

  it('reveal text uses the model', () => {
    expect(revealGroupTotal(5)).toContain('20 + 5 = 25');
    expect(revealGroupTotal(5)).toContain('5 × 5 = 25');
  });
});

describe('layout coordinates', () => {
  const inside = (r: Rect, W: number, H: number) => r.x >= 0 && r.y >= 0 && r.x + r.w <= W && r.y + r.h <= H;
  const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

  for (const name of ['wide', 'narrow'] as LayoutName[]) {
    const L = getLayout(name);
    it(`${name}: crates fit, do not overlap, and hold all 5 apples`, () => {
      const rects = Array.from({ length: ORCHARD_MAX_GROUPS }, (_, k) => crateRect(L, k + 1));
      for (const r of rects) expect(inside(r, L.width, L.height)).toBe(true);
      for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) expect(overlap(rects[i], rects[j])).toBe(false);
      for (let n = 1; n <= ORCHARD_MAX_GROUPS; n++) {
        const r = crateRect(L, n);
        for (let i = 1; i <= GROUP_SIZE; i++) {
          const c = appleCenter(L, n, i);
          expect(c.x - L.crate.appleR).toBeGreaterThanOrEqual(r.x);
          expect(c.x + L.crate.appleR).toBeLessThanOrEqual(r.x + r.w);
          expect(c.y - L.crate.appleR).toBeGreaterThanOrEqual(r.y);
          expect(c.y + L.crate.appleR).toBeLessThanOrEqual(r.y + r.h);
        }
        expect(inside(counterRect(L, n), L.width, L.height)).toBe(true);
        // crates sit above the chalkboard
        expect(r.y + r.h + L.crate.labelDy).toBeLessThan(L.table.board.y);
      }
    });

    it(`${name}: table columns and jumps stay on the board`, () => {
      const B = L.table.board;
      for (let col = 1; col <= ORCHARD_MAX_GROUPS; col++) {
        const r = tableColRect(L, col);
        expect(r.x).toBeGreaterThanOrEqual(B.x);
        expect(r.x + r.w).toBeLessThanOrEqual(B.x + B.w);
        expect(r.y + r.h).toBeLessThanOrEqual(B.y + B.h);
        expect(tableColX(L, col)).toBeGreaterThan(L.table.labelX + 40);
      }
      for (let k = 1; k < ORCHARD_MAX_GROUPS; k++) {
        const a = tableArc(L, k);
        expect(a.labelX).toBeGreaterThan(tableColX(L, k));
        expect(a.labelX).toBeLessThan(tableColX(L, k + 1));
        expect(a.labelY).toBeLessThan(L.table.rule.y);
      }
      expect(B.y + B.h).toBeLessThanOrEqual(L.height);
    });

    it(`${name}: sticker sheets and stars fit`, () => {
      for (let n = 1; n <= 7; n++) {
        const r = sheetRect(L, n);
        expect(inside(r, L.width, L.height)).toBe(true);
        for (let i = 1; i <= 5; i++) {
          const c = starCenter(L, n, i);
          expect(c.y + L.sheets.starR).toBeLessThanOrEqual(r.y + r.h);
        }
      }
      expect(inside(L.bubble, L.width, L.height)).toBe(true);
      expect(inside(L.finale.bubble, L.width, L.height)).toBe(true);
    });

    it(`${name}: finale confetti stays clear of text, characters, and sheets`, () => {
      const F = L.finale;
      const header = headerLabel(name, 7, STICKERS);
      const blockers: Rect[] = [
        { x: L.header.x, y: L.header.y - L.header.size, w: header.length * L.header.size * 0.55, h: L.header.size * 1.3 },
        { x: F.leo.x, y: F.leo.y, w: 72 * F.leo.scale, h: 170 * F.leo.scale },
        { x: F.pip.x, y: F.pip.y, w: 60 * F.pip.scale, h: 75 * F.pip.scale },
        F.bubble,
        { x: L.ruleLine.cx - L.ruleLine.size * 4.6, y: L.ruleLine.y - L.ruleLine.size * 1.05, w: L.ruleLine.size * 9.2, h: L.ruleLine.size * 1.45 },
        { x: sheetRect(L, 1).x, y: L.sheets.labelY - L.sheets.labelSize, w: sheetRect(L, 7).x + L.sheets.w - sheetRect(L, 1).x, h: L.runs.arcY + L.runs.arcDepth + L.runs.arcLabelSize + 4 - (L.sheets.labelY - L.sheets.labelSize) },
      ];
      for (const [x, y] of F.confetti) {
        const dot: Rect = { x: x - 6, y: y - 6, w: 12, h: 12 };
        expect(inside(dot, L.width, L.height), `${x},${y}`).toBe(true);
        for (const b of blockers) expect(overlap(dot, b), `confetti ${x},${y}`).toBe(false);
      }
    });

    it(`${name}: text is large enough to read`, () => {
      const min = 13;
      const sizes = [L.header.size, L.crate.labelSize, L.counter.size, L.table.labelSize, L.table.headerSize, L.table.totalSize, L.table.guessSize, L.table.ruleSize, L.table.arcLabelSize, L.bubble.size, L.sheets.labelSize, L.runs.size, L.runs.arcLabelSize];
      for (const s of sizes) expect(s).toBeGreaterThanOrEqual(min);
    });
  }

  it('is deterministic', () => {
    expect(getLayout('wide')).toBe(getLayout('wide'));
    expect(tableArc(getLayout('narrow'), 2)).toEqual(tableArc(getLayout('narrow'), 2));
  });
});
