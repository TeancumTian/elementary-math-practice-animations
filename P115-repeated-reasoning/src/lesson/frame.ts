/**
 * Pure frame computation: (beat, time, layout, reduced motion) → everything the
 * SVG stage draws. Positions and labels come from the math model; the
 * timeline only decides how far along (0 → 1) each element is.
 *
 * Elements whose progress is 0 are left out of the frame entirely, so text
 * that has not appeared yet is never in the DOM (no hidden answer leaks).
 */
import {
  GROUP_SIZE,
  ORCHARD,
  ORCHARD_MAX_GROUPS,
  PROPOSED_TERM,
  STICKERS,
  appleCenter,
  counterRect,
  crateLabelPoint,
  crateRect,
  equationLabel,
  getLayout,
  groupName,
  headerLabel,
  multiplicationLabel,
  num,
  ruleSentence,
  runArc,
  sheetRect,
  starCenter,
  starPath,
  stepLabel,
  tableArc,
  tableColRect,
  tableColX,
  totalFor,
  type LayoutName,
  type Point,
  type Rect,
  type SceneLayout,
} from '@/model/repeatedReasoning';
import type { Beat, Focus, OrchardScene, StickerScene, TimelineEntry } from './script';

/** An apple counts as "landed" (and is counted) once its drop is this far along. */
export const LANDED = 0.85;

export interface SlotFrame {
  i: number;
  id: string;
  x: number;
  y: number;
  r: number;
  /** Apple progress (0 = no apple yet). */
  apple: number;
}

export interface CrateFrame {
  n: number;
  id: string;
  rect: Rect;
  p: number;
  label: string;
  labelPoint: Point;
  badge: { text: string; p: number } | null;
  slots: SlotFrame[];
  applesLanded: number;
}

export type CellKind = 'total' | 'pending' | 'predicted' | 'guess' | 'guessCrossed' | 'rule';

export interface CellFrame {
  id: string;
  col: number;
  kind: CellKind;
  text: string;
  x: number;
  y: number;
  size: number;
  p: number;
  /** Progress of the strike-through for a crossed guess. */
  strike?: number;
}

export interface ArcFrame {
  id: string;
  d: string;
  label: string;
  labelX: number;
  labelY: number;
  labelSize: number;
  stroke: number;
  p: number;
}

export interface TableFrame {
  board: Rect;
  rowLabels: { text: string; x: number; y: number; size: number }[];
  headers: { col: number; text: string; x: number; y: number; size: number }[];
  cells: CellFrame[];
  arcs: ArcFrame[];
}

export interface BubbleFrame {
  lines: string[];
  rect: Rect;
  size: number;
  tail: Point;
  p: number;
}

export interface FocusFrame {
  rects: Rect[];
  circles: { x: number; y: number; r: number; label: string }[];
  onBoard: boolean;
  p: number;
}

export interface SheetFrame {
  n: number;
  id: string;
  rect: Rect;
  p: number;
  label: string;
  labelY: number;
  labelSize: number;
  stars: { id: string; d: string }[];
}

export interface Frame {
  layout: SceneLayout;
  kind: 'orchard' | 'stickers';
  header: string;
  banner: { text: string; p: number } | null;
  crates: CrateFrame[];
  counter: { crate: number; value: number; rect: Rect; size: number } | null;
  table: TableFrame | null;
  pip: { x: number; y: number; scale: number; p: number; post: boolean } | null;
  bubble: BubbleFrame | null;
  leo: { x: number; y: number; scale: number; cheer: boolean } | null;
  focus: FocusFrame | null;
  sheets: SheetFrame[];
  runs: { id: string; text: string; x: number; y: number; size: number; p: number }[];
  runArcs: ArcFrame[];
  ruleLine: { text: string; x: number; y: number; size: number; p: number } | null;
  finale: number;
  confetti: { x: number; y: number }[];
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Progress of element `id` at time t. Elements not on the timeline are simply present. */
export function progressOf(id: string, timeline: TimelineEntry[] | undefined, t: number, reduced: boolean): number {
  if (reduced) return 1;
  const e = timeline?.find((x) => x.id === id);
  if (!e) return 1;
  return clamp01((t - e.at) / e.dur);
}

export function computeFrame(beat: Beat, t: number, layoutName: LayoutName, reduced: boolean): Frame {
  const L = getLayout(layoutName);
  const p = (id: string) => progressOf(id, beat.timeline, t, reduced);
  const empty: Frame = {
    layout: L,
    kind: beat.scene.kind,
    header: '',
    banner: null,
    crates: [],
    counter: null,
    table: null,
    pip: null,
    bubble: null,
    leo: null,
    focus: null,
    sheets: [],
    runs: [],
    runArcs: [],
    ruleLine: null,
    finale: 0,
    confetti: [],
  };
  return beat.scene.kind === 'orchard' ? orchardFrame(empty, L, beat.scene, p) : stickerFrame(empty, L, beat.scene, p);
}

function orchardFrame(frame: Frame, L: SceneLayout, s: OrchardScene, p: (id: string) => number): Frame {
  const crates: CrateFrame[] = [];
  const crateCount = Math.max(s.apples.length, s.emptyCrate ?? 0);
  for (let n = 1; n <= crateCount; n++) {
    const inScene = n <= s.apples.length || n === s.emptyCrate;
    if (!inScene) continue;
    const cp = p(`crate-${n}`);
    if (cp <= 0) continue;
    const applesAtEnd = s.apples[n - 1] ?? 0;
    const slots: SlotFrame[] = [];
    let landed = 0;
    for (let i = 1; i <= GROUP_SIZE; i++) {
      const c = appleCenter(L, n, i);
      const ap = i <= applesAtEnd ? p(`apple-${n}-${i}`) : 0;
      if (ap >= LANDED) landed++;
      slots.push({ i, id: `apple-${n}-${i}`, x: c.x, y: c.y, r: L.crate.appleR, apple: ap });
    }
    const bp = s.badges && applesAtEnd === GROUP_SIZE ? p(`badge-${n}`) : 0;
    crates.push({
      n,
      id: `crate-${n}`,
      rect: crateRect(L, n),
      p: cp,
      label: groupName(n, ORCHARD),
      labelPoint: crateLabelPoint(L, n),
      badge: bp > 0 ? { text: `${num(GROUP_SIZE)} ${ORCHARD.items}`, p: bp } : null,
      slots,
      applesLanded: landed,
    });
  }
  frame.crates = crates;

  const fullCrates = crates.filter((c) => c.applesLanded === GROUP_SIZE).length;
  frame.header = headerLabel(L.name, fullCrates, ORCHARD);

  if (s.counter) {
    const c = crates.find((x) => x.n === s.counter);
    if (c) {
      frame.counter = {
        crate: c.n,
        value: totalFor(c.n - 1, ORCHARD) + c.applesLanded,
        rect: counterRect(L, c.n),
        size: L.counter.size,
      };
    }
  }

  if (s.banner) {
    const bp = p('banner');
    if (bp > 0) frame.banner = { text: ruleSentence(ORCHARD), p: bp };
  }

  frame.table = tableFrame(L, s, p);

  if (s.pip) {
    const pp = p('pip');
    if (pp > 0) {
      frame.pip = { x: L.pip.x, y: L.pip.y, scale: L.pip.scale, p: pp, post: L.pipPost };
      const bub = p('bubble');
      if (bub > 0) {
        const lines =
          s.pip === 'guess'
            ? ['Squawk!', `${num(PROPOSED_TERM.groups)} crates: ${num(PROPOSED_TERM.total)} apples!`]
            : ['Oops! I was short.', `I'll count by ${num(GROUP_SIZE)}s!`];
        frame.bubble = { lines, rect: L.bubble, size: L.bubble.size, tail: L.bubble.tail, p: bub };
      }
    }
  }
  if (L.leo) frame.leo = { ...L.leo, cheer: false };

  frame.focus = s.focus ? focusFrame(L, s.focus, p('focus')) : null;
  return frame;
}

function tableFrame(L: SceneLayout, s: OrchardScene, p: (id: string) => number): TableFrame {
  const T = L.table;
  const mid = (b: { y: number; h: number }, size: number) => b.y + b.h / 2 + size * 0.35;
  const rowLabels = [
    { text: 'Crates', x: T.labelX, y: mid(T.header, T.labelSize), size: T.labelSize },
    { text: 'Apples', x: T.labelX, y: mid(T.totals, T.labelSize), size: T.labelSize },
    { text: T.ruleLabel, x: T.labelX, y: mid(T.rule, T.labelSize), size: T.labelSize },
  ];
  const headers = Array.from({ length: ORCHARD_MAX_GROUPS }, (_, k) => ({
    col: k + 1,
    text: num(k + 1),
    x: tableColX(L, k + 1),
    y: mid(T.header, T.headerSize),
    size: T.headerSize,
  }));

  const cells: CellFrame[] = [];
  const guessCol = PROPOSED_TERM.groups;
  const crossed = s.guess === 'crossed';
  for (let col = 1; col <= s.totals; col++) {
    const cp = p(`total-${col}`);
    if (cp <= 0) continue;
    const lowered = crossed && col === guessCol;
    const y = lowered ? T.totals.y + T.totals.h - 8 : mid(T.totals, T.totalSize);
    const size = lowered ? Math.round(T.totalSize * 0.85) : T.totalSize;
    cells.push({ id: `total-${col}`, col, kind: 'total', text: num(totalFor(col, ORCHARD)), x: tableColX(L, col), y, size, p: cp });
  }
  for (const col of s.pending ?? []) {
    const cp = p(`pending-${col}`);
    if (cp > 0) cells.push({ id: `pending-${col}`, col, kind: 'pending', text: '?', x: tableColX(L, col), y: mid(T.totals, T.totalSize), size: T.totalSize, p: cp });
  }
  for (const col of s.predicted ?? []) {
    cells.push({ id: `predicted-${col}`, col, kind: 'predicted', text: num(totalFor(col, ORCHARD)), x: tableColX(L, col), y: mid(T.totals, T.totalSize), size: T.totalSize, p: 1 });
  }
  if (s.guess) {
    const gp = p('guess');
    if (gp > 0) {
      const strike = crossed ? p('cross') : 0;
      const centerY = mid(T.totals, T.totalSize);
      const topY = T.totals.y + T.guessSize + 2;
      cells.push({
        id: 'guess',
        col: guessCol,
        kind: crossed ? 'guessCrossed' : 'guess',
        text: num(PROPOSED_TERM.total),
        x: tableColX(L, guessCol),
        y: crossed ? centerY + (topY - centerY) * strike : centerY,
        size: crossed ? T.totalSize + (T.guessSize - T.totalSize) * strike : T.totalSize,
        p: gp,
        strike,
      });
    }
  }
  for (let col = 1; col <= s.rules; col++) {
    const rp = p(`rule-${col}`);
    if (rp > 0) cells.push({ id: `rule-${col}`, col, kind: 'rule', text: multiplicationLabel(col, GROUP_SIZE), x: tableColX(L, col), y: mid(T.rule, T.ruleSize), size: T.ruleSize, p: rp });
  }

  const arcs: ArcFrame[] = [];
  for (let k = 1; k <= s.arcs; k++) {
    const ap = p(`arc-${k}`);
    if (ap <= 0) continue;
    const a = tableArc(L, k);
    arcs.push({ id: `arc-${k}`, d: a.d, label: stepLabel(GROUP_SIZE), labelX: a.labelX, labelY: a.labelY, labelSize: T.arcLabelSize, stroke: T.arcStroke, p: ap });
  }
  return { board: T.board, rowLabels, headers, cells, arcs };
}

function focusFrame(L: SceneLayout, f: Focus, fp: number): FocusFrame | null {
  if (fp <= 0) return null;
  const pad = L.focusPad;
  const grow = (r: Rect, d = pad): Rect => ({ x: r.x - d, y: r.y - d, w: r.w + 2 * d, h: r.h + 2 * d });
  switch (f.kind) {
    case 'crates':
      return { rects: f.crates.map((n) => grow(crateRect(L, n))), circles: [], onBoard: false, p: fp };
    case 'cols': {
      const sorted = [...f.cols].sort((a, b) => a - b);
      const first = tableColRect(L, sorted[0]);
      const last = tableColRect(L, sorted[sorted.length - 1]);
      return { rects: [{ x: first.x, y: first.y, w: last.x + last.w - first.x, h: first.h }], circles: [], onBoard: true, p: fp };
    }
    case 'totalsRow': {
      const T = L.table;
      const first = tableColRect(L, 1);
      const last = tableColRect(L, ORCHARD_MAX_GROUPS);
      return { rects: [{ x: first.x, y: T.totals.y - 2, w: last.x + last.w - first.x, h: T.totals.h + 4 }], circles: [], onBoard: true, p: fp };
    }
    case 'slot': {
      const c = appleCenter(L, f.crate, f.slot);
      return { rects: [], circles: [{ x: c.x, y: c.y, r: L.crate.appleR + 5, label: '?' }], onBoard: false, p: fp };
    }
    case 'banner': {
      const b = L.banner;
      return { rects: [grow({ x: b.cx - b.w / 2, y: b.cy - b.h / 2, w: b.w, h: b.h }, 5)], circles: [], onBoard: false, p: fp };
    }
    case 'sheets': {
      const a = sheetRect(L, 1);
      const b = sheetRect(L, 7);
      return { rects: [grow({ x: a.x, y: a.y, w: b.x + b.w - a.x, h: a.h }, 5)], circles: [], onBoard: false, p: fp };
    }
    case 'runs': {
      const a = sheetRect(L, 1);
      const b = sheetRect(L, 7);
      const top = L.runs.y - L.runs.size - 4;
      return { rects: [{ x: a.x - 4, y: top, w: b.x + b.w - a.x + 8, h: L.runs.arcY + L.runs.arcDepth + 8 - top }], circles: [], onBoard: false, p: fp };
    }
  }
}

function stickerFrame(frame: Frame, L: SceneLayout, s: StickerScene, p: (id: string) => number): Frame {
  const sheets: SheetFrame[] = [];
  for (let n = 1; n <= s.sheets; n++) {
    const sp = p(`sheet-${n}`);
    if (sp <= 0) continue;
    const stars = Array.from({ length: STICKERS.groupSize }, (_, k) => ({
      id: `star-${n}-${k + 1}`,
      d: starPath(starCenter(L, n, k + 1), L.sheets.starR),
    }));
    sheets.push({
      n,
      id: `sheet-${n}`,
      rect: sheetRect(L, n),
      p: sp,
      label: L.name === 'narrow' ? num(n) : groupName(n, STICKERS),
      labelY: L.sheets.labelY,
      labelSize: L.sheets.labelSize,
      stars,
    });
  }
  frame.sheets = sheets;
  frame.header = headerLabel(L.name, sheets.filter((x) => x.p >= 0.5).length, STICKERS);

  for (let n = 1; n <= s.runs; n++) {
    const rp = p(`run-${n}`);
    if (rp <= 0) continue;
    const r = sheetRect(L, n);
    frame.runs.push({ id: `run-${n}`, text: num(totalFor(n, STICKERS)), x: r.x + r.w / 2, y: L.runs.y, size: L.runs.size, p: rp });
  }
  for (let k = 1; k <= s.arcs; k++) {
    const ap = p(`sarc-${k}`);
    if (ap <= 0) continue;
    const a = runArc(L, k);
    frame.runArcs.push({ id: `sarc-${k}`, d: a.d, label: stepLabel(STICKERS.groupSize), labelX: a.labelX, labelY: a.labelY, labelSize: L.runs.arcLabelSize, stroke: L.runs.arcStroke, p: ap });
  }
  if (s.ruleLine) {
    const rp = p('ruleline');
    if (rp > 0) frame.ruleLine = { text: `${equationLabel(s.sheets, STICKERS.groupSize)} stars`, x: L.ruleLine.cx, y: L.ruleLine.y, size: L.ruleLine.size, p: rp };
  }
  const F = L.finale;
  frame.leo = { ...F.leo, cheer: !!s.finale };
  frame.pip = { ...F.pip, p: 1, post: false };
  if (s.finale) {
    const fp = p('finale');
    frame.finale = fp;
    frame.confetti = F.confetti.map(([x, y]) => ({ x, y }));
    if (fp > 0) frame.bubble = { lines: ['Great reasoning!', `Groups × ${num(GROUP_SIZE)}!`], rect: F.bubble, size: F.bubble.size, tail: F.bubble.tail, p: fp };
  }
  frame.focus = s.focus ? focusFrame(L, s.focus, p('focus')) : null;
  return frame;
}

/**
 * Plain-language description of what is visible, for the SVG's accessible
 * description. Built only from elements already in the frame, so it can never
 * mention an answer the learner has not seen.
 */
export function describeFrame(frame: Frame): string {
  const parts: string[] = [frame.header + '.'];
  if (frame.kind === 'orchard') {
    for (const c of frame.crates) {
      const apples = c.slots.filter((s) => s.apple > 0).length;
      parts.push(`${c.label}: ${apples === 0 ? `empty, ${num(GROUP_SIZE)} spots` : `${num(apples)} of ${num(GROUP_SIZE)} spots filled`}.`);
    }
    if (frame.counter) parts.push(`Count so far: ${num(frame.counter.value)}.`);
    if (frame.banner) parts.push(`Rule: ${frame.banner.text}.`);
    if (frame.table) {
      const byCol = new Map<number, string[]>();
      for (const cell of frame.table.cells) {
        const list = byCol.get(cell.col) ?? [];
        const text =
          cell.kind === 'total'
            ? `${cell.text} apples`
            : cell.kind === 'pending'
              ? 'unknown, question mark'
              : cell.kind === 'predicted'
                ? `predicted ${cell.text}`
                : cell.kind === 'guess'
                  ? `Pip's guess ${cell.text}`
                  : cell.kind === 'guessCrossed'
                    ? `Pip's guess ${cell.text}, crossed out`
                    : `rule ${cell.text}`;
        list.push(text);
        byCol.set(cell.col, list);
      }
      const cols = [...byCol.entries()].sort((a, b) => a[0] - b[0]).map(([col, list]) => `${num(col)} ${col === 1 ? 'crate' : 'crates'}: ${list.join(', ')}`);
      if (cols.length) parts.push(`Leo's board. ${cols.join('; ')}.`);
      if (frame.table.arcs.length) parts.push(`${num(frame.table.arcs.length)} jumps of ${stepLabel(GROUP_SIZE)} between totals.`);
    }
    if (frame.bubble) parts.push(`Pip says: ${frame.bubble.lines.join(' ')}`);
  } else {
    if (frame.sheets.length) parts.push(`${num(frame.sheets.length)} sticker sheets, each with ${num(STICKERS.groupSize)} stars.`);
    if (frame.runs.length) parts.push(`Counting by ${num(STICKERS.groupSize)}s under the sheets: ${frame.runs.map((r) => r.text).join(', ')}.`);
    if (frame.ruleLine) parts.push(`${frame.ruleLine.text}.`);
    if (frame.bubble) parts.push(`Pip says: ${frame.bubble.lines.join(' ')}`);
  }
  return parts.join(' ');
}
