/**
 * Crates of Five — the single deterministic math model.
 *
 * Every quantity (group counts, group size, totals, differences), every
 * coordinate the SVG stage draws, every number-bearing label, and every
 * answer check in the lesson comes from this module. Nothing here reads the
 * clock, randomness, or the DOM, so the same inputs always give the same
 * outputs.
 *
 * Totals are built the way learners build them: one equal group at a time
 * (repeated addition). The multiplication rule (groups × size) is a separate
 * function, and the unit tests prove the two agree — the rule is justified by
 * the equal groups, not assumed from a few examples.
 */

/* ------------------------------------------------------------------ */
/* Quantities                                                          */
/* ------------------------------------------------------------------ */

export const GROUP_SIZE = 5;

/** A counting context: what the equal groups are and what is inside them. */
export interface CountContext {
  groupSize: number;
  group: string;
  groups: string;
  item: string;
  items: string;
}

export const ORCHARD: CountContext = {
  groupSize: GROUP_SIZE,
  group: 'crate',
  groups: 'crates',
  item: 'apple',
  items: 'apples',
};

export const STICKERS: CountContext = {
  groupSize: GROUP_SIZE,
  group: 'sheet',
  groups: 'sheets',
  item: 'star',
  items: 'stars',
};

/** Crates learners build first (one, two, three, and four equal groups). */
export const BUILD_GROUP_COUNTS = [1, 2, 3, 4] as const;
/** The "next term" learners predict. */
export const PREDICT_GROUPS = 5;
/** The intermediate result learners monitor after the correction. */
export const MONITOR_GROUPS = 6;
/** Most crates ever shown in the orchard scene. */
export const ORCHARD_MAX_GROUPS = 6;
/** Pip's deliberately incorrect proposed next term. */
export const PROPOSED_TERM = { groups: PREDICT_GROUPS, total: 24 } as const;
/** The fresh transfer question: 7 sticker sheets with 5 stars on each. */
export const TRANSFER_GROUPS = 7;

export interface EqualGroup {
  index: number;
  id: string;
  itemIds: string[];
}

/** Build `count` equal groups with stable ids, e.g. crate-3 holding apple-3-1 … apple-3-5. */
export function buildGroups(count: number, ctx: CountContext = ORCHARD): EqualGroup[] {
  assertCount(count);
  const groups: EqualGroup[] = [];
  for (let g = 1; g <= count; g++) {
    const itemIds: string[] = [];
    for (let i = 1; i <= ctx.groupSize; i++) itemIds.push(`${ctx.item}-${g}-${i}`);
    groups.push({ index: g, id: `${ctx.group}-${g}`, itemIds });
  }
  return groups;
}

/** Running totals made by adding one equal group at a time: 5, 10, 15, … */
export function runningTotals(count: number, ctx: CountContext = ORCHARD): number[] {
  const totals: number[] = [];
  let total = 0;
  for (const group of buildGroups(count, ctx)) {
    total += group.itemIds.length;
    totals.push(total);
  }
  return totals;
}

/** Total items in `groups` equal groups, counted from the groups themselves. */
export function totalFor(groups: number, ctx: CountContext = ORCHARD): number {
  if (groups === 0) return 0;
  return runningTotals(groups, ctx)[groups - 1];
}

/** The general method learners express: number of groups × group size. */
export function ruleTotal(groups: number, groupSize: number = GROUP_SIZE): number {
  assertCount(groups);
  return groups * groupSize;
}

/** Successive differences of a sequence. */
export function differences(values: readonly number[]): number[] {
  return values.slice(1).map((v, i) => v - values[i]);
}

/** Can this total be made from full groups? (For groups of 5: it ends in 0 or 5.) */
export function isWholeGroupsTotal(total: number, groupSize: number = GROUP_SIZE): boolean {
  return Number.isInteger(total) && total >= 0 && total % groupSize === 0;
}

export function endsInZeroOrFive(n: number): boolean {
  return Number.isInteger(n) && (n % 10 === 0 || n % 10 === 5);
}

function assertCount(count: number): void {
  if (!Number.isInteger(count) || count < 0) {
    throw new RangeError(`Group count must be a whole number, got ${count}`);
  }
}

/* ------------------------------------------------------------------ */
/* Labels                                                              */
/* ------------------------------------------------------------------ */

export const num = (n: number): string => String(n);

export function groupWord(n: number, ctx: CountContext = ORCHARD): string {
  return n === 1 ? ctx.group : ctx.groups;
}

export function itemWord(n: number, ctx: CountContext = ORCHARD): string {
  return n === 1 ? ctx.item : ctx.items;
}

/** "5 + 5 + 5" for three groups of five. */
export function repeatedAdditionLabel(groups: number, groupSize: number = GROUP_SIZE): string {
  assertCount(groups);
  return Array.from({ length: groups }, () => num(groupSize)).join(' + ');
}

/** "3 × 5" */
export function multiplicationLabel(groups: number, groupSize: number = GROUP_SIZE): string {
  return `${num(groups)} × ${num(groupSize)}`;
}

/** "3 × 5 = 15" */
export function equationLabel(groups: number, groupSize: number = GROUP_SIZE): string {
  return `${multiplicationLabel(groups, groupSize)} = ${num(ruleTotal(groups, groupSize))}`;
}

/** "+5" */
export function stepLabel(groupSize: number = GROUP_SIZE): string {
  return `+${num(groupSize)}`;
}

/** "Crate 3" */
export function groupName(n: number, ctx: CountContext = ORCHARD): string {
  return `${capitalize(ctx.group)} ${num(n)}`;
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export type LayoutName = 'wide' | 'narrow';

/** The scene header that keeps the count of groups and the group size explicit. */
export function headerLabel(layout: LayoutName, groupsDone: number, ctx: CountContext = ORCHARD): string {
  const g = capitalize(ctx.groups);
  if (layout === 'narrow') return `${g}: ${num(groupsDone)} · ${num(ctx.groupSize)} ${ctx.items} each`;
  return ctx === STICKERS
    ? `${g}: ${num(groupsDone)} · ${capitalize(ctx.items)} on each ${ctx.group}: ${num(ctx.groupSize)}`
    : `${g} packed: ${num(groupsDone)} · ${capitalize(ctx.items)} in each ${ctx.group}: ${num(ctx.groupSize)}`;
}

/** The general rule, written in words. */
export function ruleSentence(ctx: CountContext = ORCHARD): string {
  return `Total = ${ctx.groups} × ${num(ctx.groupSize)}`;
}

/* ------------------------------------------------------------------ */
/* Answer checks and specific corrective feedback                      */
/* ------------------------------------------------------------------ */

export type FeedbackCode =
  | 'empty'
  | 'notNumber'
  | 'correct'
  | 'addedCountAndSize'
  | 'countedGroups'
  | 'oneGroupOnly'
  | 'previousTotal'
  | 'addedTooFew'
  | 'wrongGroupCount'
  | 'notWholeGroups'
  | 'other';

export interface Feedback {
  /** Whether the input counted as a real attempt (empty / non-numeric input does not). */
  attempt: boolean;
  correct: boolean;
  code: FeedbackCode;
  message: string;
}

/**
 * Check a typed total for `groups` equal groups. Wrong-answer messages are
 * specific to the mistake and never state the correct total.
 */
export function checkGroupTotal(input: string, groups: number, ctx: CountContext = ORCHARD): Feedback {
  const trimmed = input.trim();
  if (trimmed === '') {
    return { attempt: false, correct: false, code: 'empty', message: 'Type a number first, then press Check.' };
  }
  if (!/^\d{1,4}$/.test(trimmed)) {
    return { attempt: false, correct: false, code: 'notNumber', message: 'Use digits only, like 12.' };
  }
  const value = Number(trimmed);
  const size = ctx.groupSize;
  const target = totalFor(groups, ctx);
  const prev = totalFor(groups - 1, ctx);
  const G = ctx.groups;
  const one = ctx.group;
  const items = ctx.items;

  if (value === target) {
    return {
      attempt: true,
      correct: true,
      code: 'correct',
      message: `Yes! ${num(prev)} + ${num(size)} = ${num(target)}, and ${multiplicationLabel(groups, size)} = ${num(target)}. Both ways agree.`,
    };
  }
  const wrong = (code: FeedbackCode, message: string): Feedback => ({ attempt: true, correct: false, code, message });

  if (value === groups + size) {
    return wrong(
      'addedCountAndSize',
      `${num(value)} is ${num(groups)} + ${num(size)}. That adds the number of ${G} to the ${items} in one ${one}. But each of the ${num(groups)} ${G} holds ${num(size)} ${items}.`,
    );
  }
  if (value === groups) {
    return wrong('countedGroups', `${num(value)} is how many ${G} there are. Count the ${items} inside them: ${num(size)} in each ${one}.`);
  }
  if (value === size) {
    return wrong('oneGroupOnly', `${num(value)} is the ${items} in just one ${one}. There are ${num(groups)} ${G}.`);
  }
  if (value === prev) {
    return wrong(
      'previousTotal',
      `${num(value)} is the total for ${num(groups - 1)} ${groupWord(groups - 1, ctx)}. One more ${one} adds ${num(size)} more ${items}.`,
    );
  }
  if (value > prev && value < target) {
    const k = value - prev;
    return wrong(
      'addedTooFew',
      `${num(value)} is only ${num(k)} more than ${num(prev)}. A full ${one} adds ${num(size)} ${items}, not ${num(k)}. Totals made of fives end in 0 or 5.`,
    );
  }
  if (isWholeGroupsTotal(value, size) && value > 0) {
    const m = value / size;
    if (m > groups * 2) {
      // Far too big. Don't name the group count: it could echo the answer (125 = 25 × 5).
      return wrong('wrongGroupCount', `${num(value)} is far too many. It would need many more than ${num(groups)} ${G}. Add ${num(size)} for each ${one}.`);
    }
    const hint = m === groups + 1 ? ` That is one ${one} too many.` : m > groups ? ` That is too many ${G}.` : ` That is too few ${G}.`;
    return wrong('wrongGroupCount', `${num(value)} would be ${num(m)} ${groupWord(m, ctx)} of ${num(size)}. We have ${num(groups)} ${G}.${hint}`);
  }
  if (!isWholeGroupsTotal(value, size)) {
    return wrong(
      'notWholeGroups',
      `${num(value)} can't be made from full ${G} of ${num(size)}. Totals of fives always end in 0 or 5. Try adding ${num(size)} one ${one} at a time.`,
    );
  }
  return wrong('other', `Not yet. Add ${num(size)} ${items} for each ${one}, one ${one} at a time.`);
}

/** Worked explanation shown only after the learner has submitted and asked to see the model. */
export function revealGroupTotal(groups: number, ctx: CountContext = ORCHARD): string {
  const target = totalFor(groups, ctx);
  const prev = totalFor(groups - 1, ctx);
  return `Here is the model: ${num(groups)} ${groupWord(groups, ctx)} with ${num(ctx.groupSize)} ${ctx.items} in each. ${num(prev)} + ${num(ctx.groupSize)} = ${num(target)}, and ${multiplicationLabel(groups, ctx.groupSize)} = ${num(target)}.`;
}

/* Pip's proposed next term ------------------------------------------ */

/** Each choice makes a claim that the model can check. */
export type ProposalClaim =
  | { verdict: 'right'; reason: 'bigger' }
  | { verdict: 'right'; reason: 'stepIs'; step: number }
  | { verdict: 'wrong'; reason: 'stepShort'; step: number }
  | { verdict: 'wrong'; reason: 'noChange' };

export interface ProposalOption {
  id: string;
  text: string;
  claim: ProposalClaim;
}

export function proposalFacts(proposed = PROPOSED_TERM.total, groups = PROPOSED_TERM.groups, ctx: CountContext = ORCHARD) {
  const prev = totalFor(groups - 1, ctx);
  const actual = totalFor(groups, ctx);
  return {
    proposed,
    groups,
    prev,
    step: proposed - prev,
    groupSize: ctx.groupSize,
    proposalIsCorrect: proposed === actual,
    observedSteps: differences(runningTotals(groups - 1, ctx)),
  };
}

export function proposalOptions(ctx: CountContext = ORCHARD): ProposalOption[] {
  const f = proposalFacts(PROPOSED_TERM.total, PROPOSED_TERM.groups, ctx);
  return [
    { id: 'bigger', text: `Yes. ${num(f.proposed)} is more than ${num(f.prev)}, so it fits.`, claim: { verdict: 'right', reason: 'bigger' } },
    { id: 'step-claim', text: `Yes. The totals go up by ${num(f.step)} each time.`, claim: { verdict: 'right', reason: 'stepIs', step: f.step } },
    {
      id: 'short',
      text: `No. ${num(f.proposed)} is only ${num(f.step)} more than ${num(f.prev)}, but one more ${ctx.group} adds ${num(f.groupSize)}.`,
      claim: { verdict: 'wrong', reason: 'stepShort', step: f.step },
    },
    { id: 'same', text: `No. The total should stay at ${num(f.prev)}.`, claim: { verdict: 'wrong', reason: 'noChange' } },
  ];
}

/** Check a claim about Pip's proposed term against the equal-groups model. */
export function claimHolds(claim: ProposalClaim, ctx: CountContext = ORCHARD): boolean {
  const f = proposalFacts(PROPOSED_TERM.total, PROPOSED_TERM.groups, ctx);
  const verdictOk = (claim.verdict === 'right') === f.proposalIsCorrect;
  if (!verdictOk) return false;
  switch (claim.reason) {
    case 'bigger':
      return false; // "bigger" is never a sufficient reason
    case 'stepIs':
      return f.observedSteps.every((d) => d === claim.step);
    case 'stepShort':
      return claim.step === f.step && claim.step < f.groupSize;
    case 'noChange':
      return false; // adding a non-empty group always changes the total
  }
}

export function checkProposalChoice(optionId: string, ctx: CountContext = ORCHARD): Feedback {
  const f = proposalFacts(PROPOSED_TERM.total, PROPOSED_TERM.groups, ctx);
  const option = proposalOptions(ctx).find((o) => o.id === optionId);
  if (!option) {
    return { attempt: false, correct: false, code: 'empty', message: 'Choose an answer first, then press Check.' };
  }
  if (claimHolds(option.claim, ctx)) {
    return {
      attempt: true,
      correct: true,
      code: 'correct',
      message: `Right! ${num(f.proposed)} is ${num(f.prev)} + ${num(f.step)}. A full ${ctx.group} adds ${num(f.groupSize)}, so ${num(f.proposed)} can't be the total for ${num(f.groups)} ${ctx.groups}.`,
    };
  }
  const steps = runningTotals(f.groups - 1, ctx).map(num).join(' → ');
  const message: Record<string, string> = {
    bigger: `Bigger is not enough. One more ${ctx.group} adds exactly ${num(f.groupSize)} ${ctx.items}. Is ${num(f.proposed)} exactly ${num(f.groupSize)} more than ${num(f.prev)}?`,
    'step-claim': `Look at Leo's board: ${steps}. Every jump is ${stepLabel(f.groupSize)}, not +${num(f.step)}.`,
    same: `${capitalize(ctx.group)} ${num(f.groups)} has ${ctx.items} in it too, so the total must grow. How many does one ${ctx.group} add?`,
  };
  return { attempt: true, correct: false, code: 'other', message: message[option.id] ?? 'Not yet. Check the jumps on the board.' };
}

export function revealProposal(ctx: CountContext = ORCHARD): string {
  const f = proposalFacts(PROPOSED_TERM.total, PROPOSED_TERM.groups, ctx);
  const opt = proposalOptions(ctx).find((o) => claimHolds(o.claim, ctx));
  return `Pip is not right. ${opt ? opt.text.replace(/^No\. /, '') : ''} So ${num(f.proposed)} is too small.`.trim();
}

/* ------------------------------------------------------------------ */
/* Layout: every coordinate the SVG stage uses                         */
/* ------------------------------------------------------------------ */

export interface Point {
  x: number;
  y: number;
}
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Band {
  y: number;
  h: number;
}

export interface SceneLayout {
  name: LayoutName;
  width: number;
  height: number;
  header: Point & { size: number };
  banner: { cx: number; cy: number; w: number; h: number; size: number };
  crate: { cols: number; w: number; h: number; x0: number; xPitch: number; y0: number; yPitch: number; appleR: number; appleDx0: number; applePitch: number; appleDy: number; labelDy: number; labelSize: number; dropHeight: number };
  counter: { w: number; h: number; dx: number; dy: number; size: number };
  table: {
    board: Rect;
    labelX: number;
    labelSize: number;
    col0: number;
    colW: number;
    header: Band;
    totals: Band;
    arcs: Band;
    rule: Band;
    headerSize: number;
    totalSize: number;
    guessSize: number;
    ruleSize: number;
    arcLabelSize: number;
    arcInset: number;
    /** How far the ∪ of a jump dips; labels sit inside the dip or just below it. */
    arcDepth: number;
    arcLabelBelow: boolean;
    arcStroke: number;
    ruleLabel: string;
  };
  pip: Point & { scale: number };
  pipPost: boolean;
  bubble: Rect & { size: number; tail: Point };
  leo: (Point & { scale: number }) | null;
  sheets: { x0: number; pitch: number; w: number; h: number; y: number; starR: number; starDy0: number; starPitch: number; labelY: number; labelSize: number };
  runs: { y: number; size: number; arcY: number; arcDepth: number; arcInset: number; arcLabelSize: number; arcLabelBelow: boolean; arcStroke: number };
  ruleLine: { cx: number; y: number; size: number };
  finale: { leo: Point & { scale: number }; pip: Point & { scale: number }; bubble: Rect & { size: number; tail: Point }; confetti: [number, number][] };
  /** Gap between an outlined (focused) object and its dashed outline. */
  focusPad: number;
}

const WIDE: SceneLayout = {
  name: 'wide',
  width: 800,
  height: 490,
  header: { x: 24, y: 34, size: 21 },
  banner: { cx: 320, cy: 64, w: 320, h: 38, size: 21 },
  crate: { cols: 3, w: 180, h: 64, x0: 30, xPitch: 200, y0: 96, yPitch: 102, appleR: 14, appleDx0: 22, applePitch: 34, appleDy: 34, labelDy: 23, labelSize: 18, dropHeight: 70 },
  counter: { w: 56, h: 30, dx: -58, dy: -17, size: 20 },
  table: {
    board: { x: 16, y: 294, w: 768, h: 180 },
    labelX: 30,
    labelSize: 20,
    col0: 180,
    colW: 100,
    header: { y: 300, h: 30 },
    totals: { y: 332, h: 52 },
    arcs: { y: 386, h: 40 },
    rule: { y: 428, h: 38 },
    headerSize: 20,
    totalSize: 32,
    guessSize: 17,
    ruleSize: 21,
    arcLabelSize: 19,
    arcInset: 12,
    arcDepth: 32,
    arcLabelBelow: false,
    arcStroke: 3,
    ruleLabel: 'Crates × 5',
  },
  pip: { x: 722, y: 92, scale: 1 },
  pipPost: true,
  bubble: { x: 494, y: 12, w: 222, h: 60, size: 18, tail: { x: 728, y: 104 } },
  leo: { x: 632, y: 112, scale: 1 },
  sheets: { x0: 52, pitch: 102, w: 84, h: 160, y: 100, starR: 14, starDy0: 20, starPitch: 30, labelY: 90, labelSize: 18 },
  runs: { y: 298, size: 30, arcY: 308, arcDepth: 28, arcInset: 12, arcLabelSize: 18, arcLabelBelow: false, arcStroke: 3 },
  ruleLine: { cx: 200, y: 412, size: 30 },
  finale: {
    leo: { x: 668, y: 334, scale: 0.9 },
    pip: { x: 590, y: 404, scale: 0.9 },
    bubble: { x: 360, y: 372, w: 200, h: 54, size: 17, tail: { x: 596, y: 418 } },
    confetti: [[470, 30], [560, 54], [650, 26], [730, 52], [780, 22], [36, 462], [150, 472], [270, 458], [400, 472], [520, 460]],
  },
  focusPad: 5,
};

const NARROW: SceneLayout = {
  name: 'narrow',
  width: 360,
  height: 468,
  header: { x: 12, y: 26, size: 16 },
  banner: { cx: 180, cy: 52, w: 250, h: 30, size: 15 },
  crate: { cols: 2, w: 164, h: 52, x0: 10, xPitch: 176, y0: 78, yPitch: 76, appleR: 12.5, appleDx0: 18, applePitch: 32, appleDy: 28, labelDy: 17, labelSize: 14, dropHeight: 50 },
  counter: { w: 44, h: 24, dx: -48, dy: -14, size: 15 },
  table: {
    board: { x: 4, y: 306, w: 352, h: 156 },
    labelX: 10,
    labelSize: 14,
    col0: 78,
    colW: 46,
    header: { y: 312, h: 26 },
    totals: { y: 340, h: 48 },
    arcs: { y: 388, h: 32 },
    rule: { y: 420, h: 36 },
    headerSize: 15,
    totalSize: 22,
    guessSize: 13,
    ruleSize: 15,
    arcLabelSize: 14,
    arcInset: 6,
    arcDepth: 12,
    arcLabelBelow: true,
    arcStroke: 2.4,
    ruleLabel: 'Rule',
  },
  pip: { x: 306, y: 4, scale: 0.78 },
  pipPost: false,
  bubble: { x: 116, y: 32, w: 178, h: 40, size: 14, tail: { x: 306, y: 34 } },
  leo: null,
  sheets: { x0: 8, pitch: 50, w: 44, h: 150, y: 78, starR: 10, starDy0: 18, starPitch: 28.5, labelY: 71, labelSize: 15 },
  runs: { y: 254, size: 19, arcY: 261, arcDepth: 10, arcInset: 5, arcLabelSize: 14, arcLabelBelow: true, arcStroke: 2.4 },
  ruleLine: { cx: 180, y: 326, size: 26 },
  finale: {
    leo: { x: 30, y: 344, scale: 0.62 },
    pip: { x: 92, y: 382, scale: 0.72 },
    bubble: { x: 150, y: 372, w: 196, h: 40, size: 14, tail: { x: 140, y: 400 } },
    confetti: [[240, 20], [275, 46], [305, 16], [342, 40], [14, 298], [160, 440], [222, 452], [282, 436], [336, 450]],
  },
  focusPad: 3,
};

export function getLayout(name: LayoutName): SceneLayout {
  return name === 'narrow' ? NARROW : WIDE;
}

/** Crate n (1-based) rectangle. */
export function crateRect(L: SceneLayout, n: number): Rect {
  const i = n - 1;
  const c = i % L.crate.cols;
  const r = Math.floor(i / L.crate.cols);
  return { x: L.crate.x0 + c * L.crate.xPitch, y: L.crate.y0 + r * L.crate.yPitch, w: L.crate.w, h: L.crate.h };
}

/** Center of apple slot i (1-based) in crate n. */
export function appleCenter(L: SceneLayout, n: number, i: number): Point {
  const r = crateRect(L, n);
  return { x: r.x + L.crate.appleDx0 + (i - 1) * L.crate.applePitch, y: r.y + L.crate.appleDy };
}

export function crateLabelPoint(L: SceneLayout, n: number): Point {
  const r = crateRect(L, n);
  return { x: r.x + 2, y: r.y + r.h + L.crate.labelDy };
}

export function counterRect(L: SceneLayout, n: number): Rect {
  const r = crateRect(L, n);
  return { x: r.x + r.w + L.counter.dx, y: r.y + L.counter.dy, w: L.counter.w, h: L.counter.h };
}

/** Horizontal center of table column `col` (1-based). */
export function tableColX(L: SceneLayout, col: number): number {
  return L.table.col0 + (col - 1) * L.table.colW + L.table.colW / 2;
}

export function tableColRect(L: SceneLayout, col: number): Rect {
  const t = L.table;
  return { x: t.col0 + (col - 1) * t.colW + 2, y: t.header.y, w: t.colW - 4, h: t.rule.y + t.rule.h - t.header.y };
}

/** A ∪-shaped jump from column `from` to `from + 1`, drawn under the totals row. */
export function tableArc(L: SceneLayout, from: number): { d: string; labelX: number; labelY: number; end: Point } {
  const t = L.table;
  const x1 = tableColX(L, from) + t.arcInset;
  const x2 = tableColX(L, from + 1) - t.arcInset;
  const y = t.arcs.y + 2;
  return arcShape(x1, x2, y, t.arcDepth, t.arcLabelBelow, t.arcLabelSize);
}

/** Sheet n (1-based) rectangle in the sticker scene. */
export function sheetRect(L: SceneLayout, n: number): Rect {
  const s = L.sheets;
  return { x: s.x0 + (n - 1) * s.pitch, y: s.y, w: s.w, h: s.h };
}

export function starCenter(L: SceneLayout, n: number, i: number): Point {
  const r = sheetRect(L, n);
  return { x: r.x + r.w / 2, y: r.y + L.sheets.starDy0 + (i - 1) * L.sheets.starPitch };
}

/** Five-pointed star path centered at p. */
export function starPath(p: Point, outer: number): string {
  const inner = outer * 0.45;
  const pts: string[] = [];
  for (let k = 0; k < 10; k++) {
    const r = k % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    pts.push(`${round(p.x + r * Math.cos(a))} ${round(p.y + r * Math.sin(a))}`);
  }
  return `M ${pts.join(' L ')} Z`;
}

export function runArc(L: SceneLayout, from: number): { d: string; labelX: number; labelY: number; end: Point } {
  const a = sheetRect(L, from);
  const b = sheetRect(L, from + 1);
  const x1 = a.x + a.w / 2 + L.runs.arcInset;
  const x2 = b.x + b.w / 2 - L.runs.arcInset;
  return arcShape(x1, x2, L.runs.arcY, L.runs.arcDepth, L.runs.arcLabelBelow, L.runs.arcLabelSize);
}

/** A cubic ∪ from x1 to x2 at height y. Its lowest point is 3/4 of `depth` below y. */
function arcShape(x1: number, x2: number, y: number, depth: number, labelBelow: boolean, labelSize: number) {
  return {
    d: `M ${x1} ${y} C ${x1} ${y + depth}, ${x2} ${y + depth}, ${x2} ${y}`,
    labelX: (x1 + x2) / 2,
    labelY: labelBelow ? y + depth * 0.75 + labelSize + 1 : y + depth * 0.62,
    end: { x: x2, y },
  };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
