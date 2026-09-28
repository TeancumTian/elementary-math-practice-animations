/**
 * Math-Message Repair Shop — the single deterministic model.
 *
 * Grade 2, Mathematical Practice MP.6 "Attend to precision".
 * Every quantity, coordinate, label, caption number, scene state, and answer
 * check in the app is computed here. The file is pure: no React, no DOM,
 * no clocks, no randomness. The UI only renders what these functions return.
 */

// ============================================================================
// 0. Small pure helpers
// ============================================================================

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function lerp(a: number, b: number, p: number): number {
  return a + (b - a) * p;
}

/** Linear 0..1 progress of `t` through [start, end]. */
export function progress(t: number, start: number, end: number): number {
  if (end <= start) return t >= end ? 1 : 0;
  return clamp((t - start) / (end - start), 0, 1);
}

export function easeInOut(p: number): number {
  return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
}

/** Eased 0..1 progress of `t` through [start, end]. */
function ease(t: number, start: number, end: number): number {
  return easeInOut(progress(t, start, end));
}

export function round(n: number, places = 2): number {
  const f = 10 ** places;
  return Math.round(n * f) / f;
}

export function range(from: number, toInclusive: number): number[] {
  const out: number[] = [];
  for (let i = from; i <= toInclusive; i += 1) out.push(i);
  return out;
}

// ============================================================================
// 1. Units and lengths
// ============================================================================

export type LengthUnitId = 'cm' | 'inch';

export const LENGTH_UNITS = {
  cm: { id: 'cm', symbol: 'cm', singular: 'centimeter', plural: 'centimeters' },
  inch: { id: 'inch', symbol: 'in.', singular: 'inch', plural: 'inches' },
} as const;

/** The one way this app writes a length: number, space, unit. */
export function formatLength(value: number, unit: LengthUnitId = 'cm'): string {
  if (unit === 'cm') return `${value} ${LENGTH_UNITS.cm.symbol}`;
  return `${value} ${value === 1 ? LENGTH_UNITS.inch.singular : LENGTH_UNITS.inch.plural}`;
}

export interface LengthClaim {
  value: number;
  unit: LengthUnitId | null;
}

/** "7" alone, or "7 cm", or "7 inches". */
export function lengthPhrase(claim: LengthClaim): string {
  return claim.unit === null ? String(claim.value) : formatLength(claim.value, claim.unit);
}

export function hasLengthUnit(claim: LengthClaim): boolean {
  return claim.unit !== null;
}

/** A length statement is precise only with the right number AND the ruler's unit (cm). */
export function isPreciseLength(claim: LengthClaim, trueLengthCm: number): boolean {
  return claim.unit === 'cm' && claim.value === trueLengthCm;
}

export const PENCIL = { id: 'pencil', owner: 'Leo', noun: 'pencil', lengthCm: 7 } as const;
export const ERASER = { id: 'eraser', owner: 'Ada', noun: 'eraser', lengthCm: 4 } as const;
export const RIBBON = {
  id: 'ribbon',
  owner: 'Ella',
  noun: 'ribbon',
  startCm: 9,
  firstPieceCm: 1,
  secondPieceCm: 4,
} as const;

export type MeasuredThing = 'pencil' | 'eraser' | 'ribbon';

// ============================================================================
// 2. Rulers (coordinates in SVG user units)
// ============================================================================

export interface RulerSpec {
  id: string;
  maxCm: number;
  x0: number;
  pxPerCm: number;
  top: number;
  height: number;
  labelFontSize: number;
}

export const PENCIL_RULER: RulerSpec = {
  id: 'ruler-cm-10',
  maxCm: 10,
  x0: 30,
  pxPerCm: 34,
  top: 180,
  height: 62,
  labelFontSize: 18,
};

export const RIBBON_RULER: RulerSpec = {
  id: 'ruler-cm-15',
  maxCm: 15,
  x0: 16,
  pxPerCm: 24.6,
  top: 214,
  height: 62,
  labelFontSize: 16,
};

export function cmToX(r: RulerSpec, cm: number): number {
  return r.x0 + cm * r.pxPerCm;
}

export function xToCm(r: RulerSpec, x: number): number {
  return (x - r.x0) / r.pxPerCm;
}

/** Length read from a ruler: right-end mark minus left-end mark. */
export function measureOnRuler(r: RulerSpec, leftX: number, rightX: number): number {
  return round(xToCm(r, rightX) - xToCm(r, leftX));
}

export interface RulerTick {
  id: string;
  cm: number;
  x: number;
  whole: boolean;
  label: string | null;
  length: number;
}

export function rulerTicks(r: RulerSpec): RulerTick[] {
  const ticks: RulerTick[] = [];
  for (let h = 0; h <= r.maxCm * 2; h += 1) {
    const cm = h / 2;
    const whole = h % 2 === 0;
    ticks.push({
      id: `${r.id}-tick-${h}`,
      cm,
      x: cmToX(r, cm),
      whole,
      label: whole ? String(cm) : null,
      length: whole ? 20 : 11,
    });
  }
  return ticks;
}

export function rulerLabelY(r: RulerSpec): number {
  return r.top + 38;
}

/** Where the ruler prints its unit, bottom-right inside the ruler body. */
export function rulerUnitLabel(r: RulerSpec): { text: string; x: number; y: number } {
  return { text: LENGTH_UNITS.cm.symbol, x: cmToX(r, r.maxCm), y: r.top + r.height - 5 };
}

/** Tick lines touched from 0 to L (a common miscount) versus the L spaces that are the length. */
export function linesFromZero(lengthCm: number): number {
  return lengthCm + 1;
}
export function spacesFromZero(lengthCm: number): number {
  return lengthCm;
}

// ============================================================================
// 3. Equations (sums, chains, balance)
// ============================================================================

/** An expression is a sum of whole-number terms, e.g. [8, 2] is "8 + 2". */
export type Expr = readonly number[];
/** A chain [a, b, c] claims a = b = c. */
export type Chain = readonly Expr[];

export function valueOf(e: Expr): number {
  return e.reduce((sum, term) => sum + term, 0);
}

export function formatExpr(e: Expr): string {
  return e.join(' + ');
}

export function formatChain(c: Chain): string {
  return c.map(formatExpr).join(' = ');
}

/** Several chains written one after another, e.g. "8 + 2 = 10, then 10 + 3 = 13". */
export function formatSteps(lines: readonly Chain[]): string {
  return lines.map(formatChain).join(', then ');
}

export interface ChainLink {
  left: Expr;
  right: Expr;
  leftValue: number;
  rightValue: number;
  holds: boolean;
}

/** Every equal sign in a chain, with the values on each side. */
export function chainLinks(c: Chain): ChainLink[] {
  return c.slice(1).map((right, i) => {
    const left = c[i];
    const leftValue = valueOf(left);
    const rightValue = valueOf(right);
    return { left, right, leftValue, rightValue, holds: leftValue === rightValue };
  });
}

/** A chain is true only if EVERY equal sign joins two equal values. */
export function isChainTrue(c: Chain): boolean {
  return chainLinks(c).every((link) => link.holds);
}

export interface ThreeStepStory {
  a: number;
  b: number;
  c: number;
}

export interface StoryMessages {
  mid: number;
  total: number;
  /** The run-on chain a + b = mid + c = total (false whenever c is not 0). */
  faultyChain: Chain;
  /** Two true equations: a + b = mid, then mid + c = total. */
  repaired: readonly [Chain, Chain];
}

export function buildMessages({ a, b, c }: ThreeStepStory): StoryMessages {
  const mid = a + b;
  const total = mid + c;
  return {
    mid,
    total,
    faultyChain: [[a, b], [mid, c], [total]],
    repaired: [
      [[a, b], [mid]],
      [[mid, c], [total]],
    ],
  };
}

export const STICKERS: ThreeStepStory = { a: 8, b: 2, c: 3 };
export const STICKER_MESSAGES = buildMessages(STICKERS);
export const SHELLS: ThreeStepStory = { a: 7, b: 3, c: 5 };
export const SHELL_MESSAGES = buildMessages(SHELLS);
export const RIBBON_STORY: ThreeStepStory = {
  a: RIBBON.startCm,
  b: RIBBON.firstPieceCm,
  c: RIBBON.secondPieceCm,
};
export const RIBBON_MESSAGES = buildMessages(RIBBON_STORY);

/** Degrees the balance beam turns; positive = right side goes down. */
export function tiltAngle(leftValue: number, rightValue: number): number {
  return clamp((rightValue - leftValue) * 3.5, -10, 10);
}

export function balanceOutcome(left: Expr, right: Expr): 'level' | 'tips' {
  return valueOf(left) === valueOf(right) ? 'level' : 'tips';
}

// ============================================================================
// 4. Picture data: the favorite-fruit tally chart and bar graph
// ============================================================================

export type FruitId = 'apples' | 'bananas' | 'grapes' | 'pears';

export interface Fruit {
  id: FruitId;
  label: string;
  count: number;
}

export const FRUITS: readonly Fruit[] = [
  { id: 'apples', label: 'Apples', count: 5 },
  { id: 'bananas', label: 'Bananas', count: 3 },
  { id: 'grapes', label: 'Grapes', count: 6 },
  { id: 'pears', label: 'Pears', count: 2 },
];

export function fruit(id: FruitId): Fruit {
  const f = FRUITS.find((item) => item.id === id);
  if (!f) throw new Error(`Unknown fruit ${id}`);
  return f;
}

export const GRAPH = {
  title: 'Favorite Fruit',
  yAxisTitle: 'Number of students',
  xAxisTitle: 'Fruit',
  countNoun: 'students',
  className: "Ms. Rivera's class",
  axisX: 80,
  plotRight: 392,
  baseY: 244,
  step: 26,
  gridCount: 7,
  barWidth: 44,
  firstBarX: 124,
  barSpacing: 78,
} as const;

/** Skipped number in the class's broken axis. */
export const SKIPPED_LABEL = 4;
/** Correct scale: gridline i is labeled i (count by 1 student). */
export const CORRECT_SCALE: readonly number[] = range(0, GRAPH.gridCount);
/** The class's broken scale: 0, 1, 2, 3, 5, 6, 7, 8 (4 is skipped). */
export const FAULTY_SCALE: readonly number[] = CORRECT_SCALE.map((v) =>
  v >= SKIPPED_LABEL ? v + 1 : v,
);

export function gridY(index: number): number {
  return GRAPH.baseY - index * GRAPH.step;
}

export function barCenterX(index: number): number {
  return GRAPH.firstBarX + index * GRAPH.barSpacing;
}

/** Bars are drawn from the data: a bar for n students reaches gridline n. */
export function barTopY(count: number): number {
  return gridY(count);
}

/** Gridline index whose y matches a bar top. */
export function gridIndexAtY(y: number): number {
  return round((GRAPH.baseY - y) / GRAPH.step, 4);
}

/** The number a reader sees next to the top of a bar on a given scale. */
export function readBar(count: number, scale: readonly number[]): number {
  const index = gridIndexAtY(barTopY(count));
  const label = scale[index];
  if (label === undefined) throw new Error(`No label at gridline ${index}`);
  return label;
}

/** Constant difference between neighboring labels, or null if the spacing changes. */
export function scaleStep(scale: readonly number[]): number | null {
  const step = scale[1] - scale[0];
  for (let i = 1; i < scale.length; i += 1) {
    if (scale[i] - scale[i - 1] !== step) return null;
  }
  return step;
}

/** First place the labels stop counting by 1s. */
export function findScaleGap(
  scale: readonly number[],
): { index: number; after: number; shown: number; missing: number } | null {
  for (let i = 1; i < scale.length; i += 1) {
    if (scale[i] - scale[i - 1] !== 1) {
      return { index: i, after: scale[i - 1], shown: scale[i], missing: scale[i - 1] + 1 };
    }
  }
  return null;
}

/** True when every bar reads its true count on this scale. */
export function barsMatchScale(scale: readonly number[]): boolean {
  return FRUITS.every((f) => readBar(f.count, scale) === f.count);
}

export function tallyGroups(count: number): { fives: number; ones: number } {
  return { fives: Math.floor(count / 5), ones: count % 5 };
}

const SCALE_GAP = findScaleGap(FAULTY_SCALE)!;

// ============================================================================
// 5. Messages (all message text is built from the numbers above)
// ============================================================================

export const UNIT_MESSAGE_PARTS = {
  pre: 'My pencil is',
  number: String(PENCIL.lengthCm),
  unit: LENGTH_UNITS.cm.symbol,
  post: 'long.',
} as const;

/** The broken message Leo brings in: a length with no unit. */
export const UNIT_FAULTY_CLAIM: LengthClaim = { value: PENCIL.lengthCm, unit: null };
export const UNIT_FAULTY_MESSAGE = `${UNIT_MESSAGE_PARTS.pre} ${UNIT_MESSAGE_PARTS.number} ${UNIT_MESSAGE_PARTS.post}`;
export const UNIT_REPAIRED_CLAIM: LengthClaim = { value: PENCIL.lengthCm, unit: 'cm' };
export const UNIT_REPAIRED_MESSAGE = `${UNIT_MESSAGE_PARTS.pre} ${UNIT_MESSAGE_PARTS.number} ${UNIT_MESSAGE_PARTS.unit} ${UNIT_MESSAGE_PARTS.post}`;

export function lengthStatement(noun: string, claim: LengthClaim): string {
  return `The ${noun} is ${lengthPhrase(claim)} long.`;
}

export function trueLengthCm(thing: MeasuredThing): number {
  if (thing === 'pencil') return PENCIL.lengthCm;
  if (thing === 'eraser') return ERASER.lengthCm;
  return RIBBON_MESSAGES.total;
}

export const STICKER_FAULTY_TEXT = formatChain(STICKER_MESSAGES.faultyChain);
export const STICKER_REPAIRED_TEXT = formatSteps(STICKER_MESSAGES.repaired);

// ============================================================================
// 6. Questions and answer checks
// ============================================================================

export type QuestionId =
  | 'predict-unit'
  | 'explain-unit'
  | 'try-unit'
  | 'predict-axis'
  | 'explain-axis'
  | 'try-axis'
  | 'predict-equal'
  | 'explain-equal'
  | 'try-equal'
  | 'transfer';

export type OptionLetter = 'A' | 'B' | 'C' | 'D';

export type Claim =
  | { type: 'length'; subject: MeasuredThing; value: number; unit: LengthUnitId | null }
  | { type: 'graphCount'; fruit: FruitId; value: number | null }
  | { type: 'balance'; left: Expr; right: Expr; outcome: 'level' | 'tips' }
  | {
      type: 'steps';
      lines: readonly Chain[];
      expectedTotal: number;
      statement: LengthClaim | null;
      requireLengthStatement: boolean;
    }
  | { type: 'reason'; valid: boolean };

export interface QuestionOption {
  letter: OptionLetter;
  text: string;
  claim: Claim;
  /** Specific corrective feedback, shown only after this option is checked and is wrong. */
  feedback: string;
  /** Short label shown on this option after the question is solved. */
  flaw: string;
}

export type StageLabel = 'Look' | 'Predict' | 'Watch' | 'Explain' | 'Try' | 'New problem' | 'Wrap-up';

export type SceneId =
  | 'intro'
  | 'look-unit'
  | 'repair-unit'
  | 'eraser'
  | 'look-axis'
  | 'repair-axis'
  | 'look-equal'
  | 'repair-equal'
  | 'shells'
  | 'look-transfer'
  | 'reveal-transfer'
  | 'finale';

/** A frozen scene frame shown behind a question. 'end' = the scene's last frame. */
export interface Visual {
  scene: SceneId;
  at: 'start' | 'end';
}

export interface Question {
  id: QuestionId;
  stage: StageLabel;
  prompt: string;
  options: readonly QuestionOption[];
  /** Shown only after a correct submission. */
  success: string;
  visual: Visual;
}

/** Decide whether a statement is mathematically precise, using only the model. */
export function evaluateClaim(claim: Claim): boolean {
  switch (claim.type) {
    case 'length':
      return isPreciseLength(claim, trueLengthCm(claim.subject));
    case 'graphCount':
      return claim.value !== null && claim.value === fruit(claim.fruit).count;
    case 'balance':
      return claim.outcome === balanceOutcome(claim.left, claim.right);
    case 'steps': {
      const everyEqualSignTrue = claim.lines.every(isChainTrue);
      const lastLine = claim.lines[claim.lines.length - 1];
      const lastValue = valueOf(lastLine[lastLine.length - 1]);
      const statementOk =
        !claim.requireLengthStatement ||
        (claim.statement !== null && isPreciseLength(claim.statement, claim.expectedTotal));
      return everyEqualSignTrue && lastValue === claim.expectedTotal && statementOk;
    }
    case 'reason':
      return claim.valid;
  }
}

const pencilNumber = PENCIL.lengthCm;
const apples = fruit('apples');
const pears = fruit('pears');
const grapes = fruit('grapes');
const [stickerLine1, stickerLine2] = STICKER_MESSAGES.repaired;
const [shellLine1, shellLine2] = SHELL_MESSAGES.repaired;
const [ribbonLine1, ribbonLine2] = RIBBON_MESSAGES.repaired;

function ribbonOption(
  letter: OptionLetter,
  lines: readonly Chain[],
  statement: LengthClaim,
  feedback: string,
  flaw: string,
): QuestionOption {
  return {
    letter,
    text: `${formatSteps(lines)}. ${lengthStatement(RIBBON.noun, statement)}`,
    claim: {
      type: 'steps',
      lines,
      expectedTotal: RIBBON_MESSAGES.total,
      statement,
      requireLengthStatement: true,
    },
    feedback,
    flaw,
  };
}

function shellOption(
  letter: OptionLetter,
  lines: readonly Chain[],
  feedback: string,
  flaw: string,
): QuestionOption {
  return {
    letter,
    text: formatSteps(lines),
    claim: {
      type: 'steps',
      lines,
      expectedTotal: SHELL_MESSAGES.total,
      statement: null,
      requireLengthStatement: false,
    },
    feedback,
    flaw,
  };
}

function eraserOption(letter: OptionLetter, claim: LengthClaim, feedback: string, flaw: string): QuestionOption {
  return {
    letter,
    text: lengthStatement(ERASER.noun, claim),
    claim: { type: 'length', subject: 'eraser', value: claim.value, unit: claim.unit },
    feedback,
    flaw,
  };
}

function graphOption(letter: OptionLetter, fruitId: FruitId, value: number, feedback: string, flaw: string): QuestionOption {
  return {
    letter,
    text: `${value} ${GRAPH.countNoun} chose ${fruit(fruitId).label.toLowerCase()}.`,
    claim: { type: 'graphCount', fruit: fruitId, value },
    feedback,
    flaw,
  };
}

export const QUESTIONS: Readonly<Record<QuestionId, Question>> = {
  'predict-unit': {
    id: 'predict-unit',
    stage: 'Predict',
    prompt: `What does ${PENCIL.owner}'s message need so everyone knows how long the pencil is?`,
    visual: { scene: 'look-unit', at: 'end' },
    options: [
      {
        letter: 'A',
        text: 'A bigger number',
        claim: { type: 'reason', valid: false },
        feedback: `The number ${pencilNumber} matches the ruler, so keep it. Ask yourself: ${pencilNumber} of what? Something else is missing.`,
        flaw: `${pencilNumber} is already the right number`,
      },
      {
        letter: 'B',
        text: 'Neater handwriting',
        claim: { type: 'reason', valid: false },
        feedback: `The message is already easy to read. Neat writing is nice, but it does not tell how long the pencil is. What is missing after the ${pencilNumber}?`,
        flaw: 'neatness is not the math problem',
      },
      {
        letter: 'C',
        text: `A unit that tells ${pencilNumber} of what`,
        claim: { type: 'reason', valid: !hasLengthUnit(UNIT_FAULTY_CLAIM) },
        feedback: '',
        flaw: '',
      },
      {
        letter: 'D',
        text: `Nothing. “${pencilNumber} long” is clear.`,
        claim: { type: 'reason', valid: hasLengthUnit(UNIT_FAULTY_CLAIM) },
        feedback: `${pencilNumber} what? ${formatLength(pencilNumber)} and ${formatLength(pencilNumber, 'inch')} are very different lengths. A reader cannot tell which one ${PENCIL.owner} means.`,
        flaw: `a reader cannot tell ${pencilNumber} of what`,
      },
    ],
    success: `Yes! A length needs a unit. The number tells how many; the unit tells what size each one is.`,
  },
  'explain-unit': {
    id: 'explain-unit',
    stage: 'Explain',
    prompt: `Why does adding ${LENGTH_UNITS.cm.symbol} make ${PENCIL.owner}'s message precise?`,
    visual: { scene: 'repair-unit', at: 'end' },
    options: [
      {
        letter: 'A',
        text: 'It makes the message look longer and fancier.',
        claim: { type: 'reason', valid: false },
        feedback: `Longer or fancier writing does not make math precise. Think about what each of the ${pencilNumber} spaces on the ruler stands for.`,
        flaw: 'looks do not make math precise',
      },
      {
        letter: 'B',
        text: `It tells what we counted: ${pencilNumber} centimeters, not ${pencilNumber} inches or ${pencilNumber} paper clips.`,
        claim: { type: 'reason', valid: true },
        feedback: '',
        flaw: '',
      },
      {
        letter: 'C',
        text: 'It tells how many lines are on the ruler.',
        claim: { type: 'reason', valid: false },
        feedback: `From 0 to ${pencilNumber} there are ${linesFromZero(pencilNumber)} lines, but the length is the ${spacesFromZero(pencilNumber)} spaces between them. ${LENGTH_UNITS.cm.symbol} names the size of each space.`,
        flaw: `${LENGTH_UNITS.cm.symbol} does not count lines`,
      },
    ],
    success: `Right! ${formatLength(pencilNumber)} means ${pencilNumber} one-centimeter spaces, so everyone pictures the same length.`,
  },
  'try-unit': {
    id: 'try-unit',
    stage: 'Try',
    prompt: `${ERASER.owner} measured an eraser with the same centimeter ruler. Which message is precise?`,
    visual: { scene: 'eraser', at: 'start' },
    options: [
      eraserOption(
        'A',
        { value: ERASER.lengthCm, unit: null },
        `Good number, but ${ERASER.lengthCm} what? A precise length needs its unit.`,
        'missing the unit',
      ),
      eraserOption(
        'B',
        { value: linesFromZero(ERASER.lengthCm), unit: 'cm' },
        'It looks like the lines were counted. Count the spaces from 0 to the end of the eraser instead.',
        'counted lines, not spaces',
      ),
      eraserOption(
        'C',
        { value: ERASER.lengthCm, unit: 'inch' },
        `This ruler shows centimeters (${LENGTH_UNITS.cm.symbol}), not inches. Use the unit printed on the ruler.`,
        'wrong unit for this ruler',
      ),
      eraserOption('D', { value: ERASER.lengthCm, unit: 'cm' }, '', ''),
    ],
    success: `Precise! The eraser covers ${spacesFromZero(ERASER.lengthCm)} one-centimeter spaces, so it is ${formatLength(ERASER.lengthCm)} long.`,
  },
  'predict-axis': {
    id: 'predict-axis',
    stage: 'Predict',
    prompt: 'Compare the graph with the tally chart. What needs to be repaired?',
    visual: { scene: 'look-axis', at: 'end' },
    options: [
      {
        letter: 'A',
        text: 'The bars need brighter colors.',
        claim: { type: 'reason', valid: false },
        feedback: 'Colors do not change how many students chose a fruit. Look at the numbers on the side axis.',
        flaw: 'colors do not change amounts',
      },
      {
        letter: 'B',
        text: `The side axis numbers skip from ${SCALE_GAP.after} to ${SCALE_GAP.shown}.`,
        claim: { type: 'reason', valid: scaleStep(FAULTY_SCALE) === null },
        feedback: '',
        flaw: '',
      },
      {
        letter: 'C',
        text: 'Nothing. The graph matches the tally chart.',
        claim: { type: 'reason', valid: barsMatchScale(FAULTY_SCALE) },
        feedback: `Check ${apples.label}: the tally chart shows ${apples.count}, but on this axis the ${apples.label} bar lines up with ${readBar(apples.count, FAULTY_SCALE)}.`,
        flaw: `${apples.label} reads ${readBar(apples.count, FAULTY_SCALE)}, not ${apples.count}`,
      },
      {
        letter: 'D',
        text: `The ${pears.label} bar is too short.`,
        claim: { type: 'reason', valid: readBar(pears.count, FAULTY_SCALE) !== pears.count },
        feedback: `${pears.label} has ${pears.count} tally marks, and its bar lines up with ${readBar(pears.count, FAULTY_SCALE)}. That bar is fine. Look at the axis numbers above ${SCALE_GAP.after}.`,
        flaw: `${pears.label} already matches`,
      },
    ],
    success: `Yes! The axis jumps from ${SCALE_GAP.after} to ${SCALE_GAP.shown}, so it skips ${SCALE_GAP.missing}. That makes every bar above ${SCALE_GAP.after} read too high.`,
  },
  'explain-axis': {
    id: 'explain-axis',
    stage: 'Explain',
    prompt: 'Why is the repaired graph precise?',
    visual: { scene: 'repair-axis', at: 'end' },
    options: [
      {
        letter: 'A',
        text: 'The bars got taller.',
        // The bars are drawn from the data and never move: same top y on both scales.
        claim: { type: 'reason', valid: false },
        feedback: 'Look again: the bars did not move at all. Only the numbers on the side axis changed.',
        flaw: 'the bars did not move',
      },
      {
        letter: 'B',
        text: 'The graph looks tidier now.',
        claim: { type: 'reason', valid: false },
        feedback: 'Tidy is nice, but it is not what makes a graph precise. Think about what each space on the axis stands for.',
        flaw: 'tidiness is not the math',
      },
      {
        letter: 'C',
        text: `Each space on the side axis stands for 1 student, so every bar shows its true count.`,
        claim: { type: 'reason', valid: scaleStep(CORRECT_SCALE) === 1 && barsMatchScale(CORRECT_SCALE) },
        feedback: '',
        flaw: '',
      },
    ],
    success: 'Exactly! Counting by 1s with no skips means each bar lines up with the same number as the tally chart.',
  },
  'try-axis': {
    id: 'try-axis',
    stage: 'Try',
    prompt: 'Use the repaired graph. Which statement is precise?',
    visual: { scene: 'repair-axis', at: 'end' },
    options: [
      graphOption('A', 'grapes', grapes.count, '', ''),
      graphOption(
        'B',
        'grapes',
        readBar(grapes.count, FAULTY_SCALE),
        `${readBar(grapes.count, FAULTY_SCALE)} comes from the broken axis. Read the repaired axis: find the number beside the top of the ${grapes.label} bar.`,
        'read from the broken axis',
      ),
      graphOption(
        'C',
        'pears',
        grapes.count,
        `Check the label under the bar. The bar that reaches ${grapes.count} is not the ${pears.label} bar.`,
        'wrong label for that bar',
      ),
      {
        letter: 'D',
        text: `${grapes.label} has a tall bar.`,
        claim: { type: 'graphCount', fruit: 'grapes', value: null },
        feedback: 'That is true, but not precise. A precise statement tells how many, and what was counted.',
        flaw: 'does not say how many',
      },
    ],
    success: `Precise! The ${grapes.label} bar lines up with ${grapes.count} on the repaired axis, and the axis counts ${GRAPH.countNoun}.`,
  },
  'predict-equal': {
    id: 'predict-equal',
    stage: 'Predict',
    prompt: `Put ${formatExpr(STICKER_MESSAGES.faultyChain[0])} on one side of a balance and ${formatExpr(STICKER_MESSAGES.faultyChain[1])} on the other side. What will happen?`,
    visual: { scene: 'look-equal', at: 'end' },
    options: [
      {
        letter: 'A',
        text: 'It will stay level. Both sides are the same amount.',
        claim: {
          type: 'balance',
          left: STICKER_MESSAGES.faultyChain[0],
          right: STICKER_MESSAGES.faultyChain[1],
          outcome: 'level',
        },
        feedback: `Count each side. ${formatExpr(STICKER_MESSAGES.faultyChain[0])} makes one amount, and ${formatExpr(STICKER_MESSAGES.faultyChain[1])} makes another. Are they really the same?`,
        flaw: 'the two sides are different amounts',
      },
      {
        letter: 'B',
        text: `It will stay level, because the chain ends with ${STICKER_MESSAGES.total}.`,
        claim: {
          type: 'balance',
          left: STICKER_MESSAGES.faultyChain[0],
          right: STICKER_MESSAGES.faultyChain[1],
          outcome: 'level',
        },
        feedback: 'An equal sign does not mean “the answer comes next.” It means both sides have the same value. Compare the two sides, not the end of the chain.',
        flaw: '= does not mean “the answer comes next”',
      },
      {
        letter: 'C',
        text: 'It will tip. The two sides are different amounts.',
        claim: {
          type: 'balance',
          left: STICKER_MESSAGES.faultyChain[0],
          right: STICKER_MESSAGES.faultyChain[1],
          outcome: 'tips',
        },
        feedback: '',
        flaw: '',
      },
    ],
    success: `Yes! ${formatExpr(STICKER_MESSAGES.faultyChain[0])} makes ${STICKER_MESSAGES.mid}, but ${formatExpr(STICKER_MESSAGES.faultyChain[1])} makes ${STICKER_MESSAGES.total}. ${STICKER_MESSAGES.mid} is not equal to ${STICKER_MESSAGES.total}, so the balance tips.`,
  },
  'explain-equal': {
    id: 'explain-equal',
    stage: 'Explain',
    prompt: "Why did we rebuild Sam's message as two equations?",
    visual: { scene: 'repair-equal', at: 'end' },
    options: [
      {
        letter: 'A',
        text: 'Every equal sign must join two sides with the same value, and now each one does.',
        claim: {
          type: 'reason',
          valid: STICKER_MESSAGES.repaired.every(isChainTrue) && !isChainTrue(STICKER_MESSAGES.faultyChain),
        },
        feedback: '',
        flaw: '',
      },
      {
        letter: 'B',
        text: 'Two short lines look neater than one long line.',
        claim: { type: 'reason', valid: false },
        feedback: `Neat lines are nice, but that is not the math reason. The long chain said ${formatChain(STICKER_MESSAGES.faultyChain.slice(0, 2))}, and ${STICKER_MESSAGES.mid} is not equal to ${STICKER_MESSAGES.total}.`,
        flaw: 'neatness is not the reason',
      },
      {
        letter: 'C',
        text: 'Short equations are faster to write.',
        claim: { type: 'reason', valid: false },
        feedback: 'Speed does not make math true. What matters is that every equal sign joins two sides with the same value.',
        flaw: 'speed is not the reason',
      },
    ],
    success: `Yes! ${formatChain(stickerLine1)} is true, and ${formatChain(stickerLine2)} is true. Each equal sign tells the truth.`,
  },
  'try-equal': {
    id: 'try-equal',
    stage: 'Try',
    prompt: `Kim had ${SHELLS.a} shells. Kim found ${SHELLS.b} more, then ${SHELLS.c} more. Which message is precise?`,
    visual: { scene: 'shells', at: 'start' },
    options: [
      shellOption(
        'A',
        [shellLine1, [[SHELL_MESSAGES.mid, SHELLS.c], [SHELL_MESSAGES.total + 1]]],
        `The first equation is true. Check the second one: count on ${SHELLS.c} from ${SHELL_MESSAGES.mid}.`,
        `${formatExpr([SHELL_MESSAGES.mid, SHELLS.c])} is not ${SHELL_MESSAGES.total + 1}`,
      ),
      shellOption(
        'B',
        [SHELL_MESSAGES.faultyChain],
        `This is a run-on chain like Sam's. It says ${formatChain(SHELL_MESSAGES.faultyChain.slice(0, 2))}, but those two sides are not equal.`,
        'run-on chain with a false equal sign',
      ),
      shellOption('C', [shellLine1, shellLine2], '', ''),
      shellOption(
        'D',
        [
          [[SHELLS.a, SHELLS.b], [SHELL_MESSAGES.mid + 1]],
          [[SHELL_MESSAGES.mid + 1, SHELLS.c], [SHELL_MESSAGES.total + 1]],
        ],
        `Check the first equation: ${formatExpr([SHELLS.a, SHELLS.b])} makes a ten. Is it ${SHELL_MESSAGES.mid + 1}?`,
        `${formatExpr([SHELLS.a, SHELLS.b])} is not ${SHELL_MESSAGES.mid + 1}`,
      ),
    ],
    success: `Precise! ${formatChain(shellLine1)} is true, and ${formatChain(shellLine2)} is true. Kim has ${SHELL_MESSAGES.total} shells.`,
  },
  transfer: {
    id: 'transfer',
    stage: 'New problem',
    prompt: `${RIBBON.owner}'s ribbon is ${formatLength(RIBBON.startCm)} long. ${RIBBON.owner} tapes on a ${formatLength(RIBBON.firstPieceCm)} piece, then a ${formatLength(RIBBON.secondPieceCm)} piece. Which message is precise?`,
    visual: { scene: 'look-transfer', at: 'end' },
    options: [
      ribbonOption(
        'A',
        [ribbonLine1, ribbonLine2],
        { value: RIBBON_MESSAGES.total, unit: null },
        `The equations are true, but ${RIBBON_MESSAGES.total} what? A precise length needs its unit.`,
        'missing the unit',
      ),
      ribbonOption(
        'B',
        [RIBBON_MESSAGES.faultyChain],
        { value: RIBBON_MESSAGES.total, unit: 'cm' },
        `Check each equal sign. This chain says ${formatChain(RIBBON_MESSAGES.faultyChain.slice(0, 2))}, and those two sides are not equal.`,
        'run-on chain with a false equal sign',
      ),
      ribbonOption(
        'C',
        [ribbonLine1, [[RIBBON_MESSAGES.mid, RIBBON_STORY.c], [RIBBON_MESSAGES.total + 1]]],
        { value: RIBBON_MESSAGES.total + 1, unit: 'cm' },
        `The unit is there, but check the adding: count on ${RIBBON_STORY.c} from ${RIBBON_MESSAGES.mid}.`,
        `${formatExpr([RIBBON_MESSAGES.mid, RIBBON_STORY.c])} is not ${RIBBON_MESSAGES.total + 1}`,
      ),
      ribbonOption('D', [ribbonLine1, ribbonLine2], { value: RIBBON_MESSAGES.total, unit: 'cm' }, '', ''),
    ],
    success: `Precise! Both equal signs are true, and the length has its unit: ${formatLength(RIBBON_MESSAGES.total)}.`,
  },
};

export const QUESTION_IDS = Object.keys(QUESTIONS) as QuestionId[];

export interface AnswerResult {
  correct: boolean;
  feedback: string;
}

/** The only answer check in the app. */
export function checkAnswer(questionId: QuestionId, letter: OptionLetter): AnswerResult {
  const q = QUESTIONS[questionId];
  const option = q.options.find((o) => o.letter === letter);
  if (!option) throw new Error(`Question ${questionId} has no option ${letter}`);
  const correct = evaluateClaim(option.claim);
  return { correct, feedback: correct ? q.success : option.feedback };
}

/** Used by tests and by the post-answer badges; never rendered before a correct submission. */
export function correctLetter(questionId: QuestionId): OptionLetter {
  const hits = QUESTIONS[questionId].options.filter((o) => evaluateClaim(o.claim));
  if (hits.length !== 1) throw new Error(`Question ${questionId} must have exactly one precise option`);
  return hits[0].letter;
}

// ============================================================================
// 7. Scenes, captions, and chapters
// ============================================================================

export const VIEWBOX = { width: 400, height: 310 } as const;

export interface Cue {
  id: string;
  start: number;
  end: number;
  text: string;
}

export interface SceneSpec {
  id: SceneId;
  /** Accessible name of the picture. */
  name: string;
  duration: number;
  cues: readonly Cue[];
}

function makeCues(sceneId: SceneId, bounds: readonly number[], texts: readonly string[]): Cue[] {
  if (bounds.length !== texts.length + 1) throw new Error(`Cue bounds mismatch in ${sceneId}`);
  return texts.map((text, i) => ({ id: `${sceneId}-${i + 1}`, start: bounds[i], end: bounds[i + 1], text }));
}

// --- timing constants (milliseconds) ---
const HOP_START = 4000;
const HOP_EACH = 900;
const HOPS_END = HOP_START + PENCIL.lengthCm * HOP_EACH + 700;
const POINTER_START = 400;
const POINTER_EACH = 800;
const MORPH_START = 9800;
const MORPH_EACH = 900;

const countingWords = range(1, PENCIL.lengthCm).join(', ');

export const SCENES: Readonly<Record<SceneId, SceneSpec>> = {
  intro: {
    id: 'intro',
    name: "Juno's Math-Message Repair Shop",
    duration: 16000,
    cues: makeCues('intro', [0, 4000, 8000, 12000, 16000], [
      "Welcome to the Math-Message Repair Shop! I'm Juno, the fixer.",
      "Friends bring me math messages that other people can't understand.",
      'A precise message has correct numbers, units, clear labels, and true equal signs.',
      "Broken messages get a NEEDS REPAIR stamp. Let's fix them together!",
    ]),
  },
  'look-unit': {
    id: 'look-unit',
    name: `${PENCIL.owner}'s pencil and message`,
    duration: 14000,
    cues: makeCues('look-unit', [0, 3500, 7000, 10500, 14000], [
      `Knock, knock! ${PENCIL.owner} brings a message to the shop.`,
      `${PENCIL.owner} measured a pencil with a centimeter ruler.`,
      `${PENCIL.owner}'s message says: “${UNIT_FAULTY_MESSAGE}”`,
      'The checker stamps it NEEDS REPAIR. This message is not precise yet.',
    ]),
  },
  'repair-unit': {
    id: 'repair-unit',
    name: `Repairing ${PENCIL.owner}'s message`,
    duration: 20000,
    cues: makeCues('repair-unit', [0, HOP_START, HOPS_END, 15000, 20000], [
      'First, check the start: the end of the pencil lines up with the 0 mark.',
      `Count the spaces, not the lines: ${countingWords}.`,
      `Each space is 1 centimeter. We write ${LENGTH_UNITS.cm.symbol} for centimeters.`,
      `Repaired: “${UNIT_REPAIRED_MESSAGE}” Now everyone knows how long it is.`,
    ]),
  },
  eraser: { id: 'eraser', name: `${ERASER.owner}'s eraser on a centimeter ruler`, duration: 0, cues: [] },
  'look-axis': {
    id: 'look-axis',
    name: `${GRAPH.className}'s tally chart and bar graph`,
    duration: 14000,
    cues: makeCues('look-axis', [0, 3500, 7000, 10500, 14000], [
      `Next customer: ${GRAPH.className} asked, “What is your favorite fruit?”`,
      'The tally chart shows how many students chose each fruit.',
      'The class drew a bar graph to show the same answers.',
      'The checker stamps the graph NEEDS REPAIR. Compare it with the tally chart.',
    ]),
  },
  'repair-axis': {
    id: 'repair-axis',
    name: 'Repairing the bar graph',
    duration: 22000,
    cues: makeCues('repair-axis', [0, 5000, 9500, 14500, 19000, 22000], [
      `Count up the side axis: ${FAULTY_SCALE.slice(0, SCALE_GAP.index).join(', ')}, then ${SCALE_GAP.shown}? The ${SCALE_GAP.missing} is missing!`,
      'On a bar graph, each space on the axis must stand for the same amount: 1 student.',
      `Repair the labels: ${CORRECT_SCALE.slice(SCALE_GAP.index).join(', ')}. The bars stay right where they are.`,
      `Check ${apples.label}: the bar lines up with ${apples.count}, and the tally chart shows ${apples.count}. They match!`,
      'Repaired! Now the numbers on the axis tell the truth.',
    ]),
  },
  'look-equal': {
    id: 'look-equal',
    name: "Sam's stickers and message",
    duration: 14000,
    cues: makeCues('look-equal', [0, 3500, 7000, 10500, 14000], [
      'Last job of the day! Sam counted stickers.',
      `Sam had ${STICKERS.a} stickers, got ${STICKERS.b} more, and then got ${STICKERS.c} more.`,
      `Sam wrote one long chain: ${STICKER_FAULTY_TEXT}.`,
      'The checker stamps it NEEDS REPAIR. Remember: an equal sign means both sides have the same value.',
    ]),
  },
  'repair-equal': {
    id: 'repair-equal',
    name: "Repairing Sam's equations",
    duration: 28000,
    cues: makeCues('repair-equal', [0, 4500, 10000, 13500, 19000, 24500, 28000], [
      `Test it on a balance. Put ${formatExpr(STICKER_MESSAGES.faultyChain[0])} on one side and ${formatExpr(STICKER_MESSAGES.faultyChain[1])} on the other.`,
      `${formatExpr(STICKER_MESSAGES.faultyChain[0])} makes ${STICKER_MESSAGES.mid}. ${formatExpr(STICKER_MESSAGES.faultyChain[1])} makes ${STICKER_MESSAGES.total}. The balance tips, because ${STICKER_MESSAGES.mid} is not equal to ${STICKER_MESSAGES.total}.`,
      "So the long chain is false. Let's rebuild it as two true equations.",
      `First: ${formatChain(stickerLine1)}. Both sides are ${STICKER_MESSAGES.mid}, so the balance is level. True!`,
      `Next: ${formatChain(stickerLine2)}. Both sides are ${STICKER_MESSAGES.total}, so the balance is level. True!`,
      "Repaired! Every equal sign in Sam's message tells the truth.",
    ]),
  },
  shells: { id: 'shells', name: "Kim's shells", duration: 0, cues: [] },
  'look-transfer': {
    id: 'look-transfer',
    name: `${RIBBON.owner}'s ribbon pieces and a centimeter ruler`,
    duration: 12000,
    cues: makeCues('look-transfer', [0, 4000, 8000, 12000], [
      `A brand-new customer! ${RIBBON.owner} is making a ribbon for a kite tail.`,
      `${RIBBON.owner}'s ribbon is ${formatLength(RIBBON.startCm)} long. ${RIBBON.owner} tapes on a ${formatLength(RIBBON.firstPieceCm)} piece, then a ${formatLength(RIBBON.secondPieceCm)} piece.`,
      'Use everything you learned. Only one message will be precise.',
    ]),
  },
  'reveal-transfer': {
    id: 'reveal-transfer',
    name: `Building ${RIBBON.owner}'s ribbon on the ruler`,
    duration: 18000,
    cues: makeCues('reveal-transfer', [0, 5000, 10000, 14000, 18000], [
      `Tape on the ${formatLength(RIBBON.firstPieceCm)} piece: ${formatChain(ribbonLine1)}. The ribbon reaches the ${RIBBON_MESSAGES.mid} mark.`,
      `Tape on the ${formatLength(RIBBON.secondPieceCm)} piece: ${formatChain(ribbonLine2)}. The ribbon reaches the ${RIBBON_MESSAGES.total} mark.`,
      `Two true equations, and the ribbon measures ${formatLength(RIBBON_MESSAGES.total)} on the ruler.`,
      `Precise message: “${formatSteps(RIBBON_MESSAGES.repaired)}. ${lengthStatement(RIBBON.noun, { value: RIBBON_MESSAGES.total, unit: 'cm' })}”`,
    ]),
  },
  finale: {
    id: 'finale',
    name: 'Precision checklist',
    duration: 12000,
    cues: makeCues('finale', [0, 4000, 8000, 12000], [
      'You repaired three math messages and wrote a new precise one!',
      'Precise messages use units, clear labels, and true equal signs.',
      'Now everyone can understand your math. Thanks for helping at the shop!',
    ]),
  },
};

export type Step =
  | { kind: 'scene'; scene: SceneId; stage: StageLabel }
  | { kind: 'question'; question: QuestionId; stage: StageLabel };

export interface Chapter {
  id: string;
  number: number;
  title: string;
  navLabel: string;
  steps: readonly Step[];
}

const scene = (id: SceneId, stage: StageLabel): Step => ({ kind: 'scene', scene: id, stage });
const ask = (id: QuestionId): Step => ({ kind: 'question', question: id, stage: QUESTIONS[id].stage });

export const CHAPTERS: readonly Chapter[] = [
  { id: 'welcome', number: 0, title: 'Welcome to the shop', navLabel: 'Welcome', steps: [scene('intro', 'Look')] },
  {
    id: 'pencil',
    number: 1,
    title: `${PENCIL.owner}'s pencil`,
    navLabel: `${PENCIL.owner}'s pencil`,
    steps: [scene('look-unit', 'Look'), ask('predict-unit'), scene('repair-unit', 'Watch'), ask('explain-unit'), ask('try-unit')],
  },
  {
    id: 'graph',
    number: 2,
    title: 'The fruit graph',
    navLabel: 'Fruit graph',
    steps: [scene('look-axis', 'Look'), ask('predict-axis'), scene('repair-axis', 'Watch'), ask('explain-axis'), ask('try-axis')],
  },
  {
    id: 'stickers',
    number: 3,
    title: "Sam's stickers",
    navLabel: "Sam's stickers",
    steps: [scene('look-equal', 'Look'), ask('predict-equal'), scene('repair-equal', 'Watch'), ask('explain-equal'), ask('try-equal')],
  },
  {
    id: 'ribbon',
    number: 4,
    title: `${RIBBON.owner}'s ribbon`,
    navLabel: `${RIBBON.owner}'s ribbon`,
    steps: [scene('look-transfer', 'Look'), ask('transfer'), scene('reveal-transfer', 'Watch'), scene('finale', 'Wrap-up')],
  },
];

/** Total animation time if a learner never pauses (questions wait, so they add 0). */
export const TOTAL_ANIMATION_MS = CHAPTERS.flatMap((c) => c.steps).reduce(
  (sum, step) => sum + (step.kind === 'scene' ? SCENES[step.scene].duration : 0),
  0,
);

export function cueAt(sceneId: SceneId, t: number): Cue | null {
  const cues = SCENES[sceneId].cues;
  if (cues.length === 0) return null;
  const found = cues.find((c) => t >= c.start && t < c.end);
  return found ?? (t >= cues[cues.length - 1].end ? cues[cues.length - 1] : cues[0]);
}

/** Reduced motion: show each caption's finished picture at once instead of tweening. */
export function reducedMotionTime(sceneId: SceneId, t: number): number {
  const cue = cueAt(sceneId, t);
  return cue ? cue.end : t;
}

export function visualTime(v: Visual): number {
  return v.at === 'end' ? SCENES[v.scene].duration : 0;
}

// ============================================================================
// 7b. Words drawn inside the pictures (so every on-screen label has one source)
// ============================================================================

export const TEXT = {
  shopSign: 'MATH-MESSAGE REPAIR SHOP',
  fixer: 'Juno',
  checklistTitle: 'A precise message has:',
  stamp: { 'needs-repair': 'NEEDS REPAIR', repaired: 'REPAIRED', precise: 'PRECISE' },
  zeroMarker: 'start at 0',
  then: 'then',
  lineTrue: 'true',
  finaleTitle: 'Precision checklist',
  finaleBadge: 'Great repair work!',
  tally: { caption: 'Tally chart', fruit: 'Fruit', tally: 'Tally', number: 'Number', match: 'matches the graph' },
} as const;

export function inAllLabel(total: number): string {
  return `${total} in all`;
}

// ============================================================================
// 8. Scene states (pure functions of time)
// ============================================================================

export type StampKind = 'needs-repair' | 'repaired' | 'precise';

export interface StampState {
  kind: StampKind;
  opacity: number;
  scale: number;
}

export type CardStatus = 'faulty' | 'fixed' | 'neutral';

export interface MessageToken {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  opacity: number;
  emphasis: boolean;
  /** 0..1 highlight pill behind a token that is moving into place. */
  pill: number;
}

export interface CardState {
  x: number;
  y: number;
  width: number;
  height: number;
  header: string;
  status: CardStatus;
  opacity: number;
  tokens: MessageToken[];
  stamps: StampState[];
  stampX: number;
  stampY: number;
}

export const MONO_RATIO = 0.62;
export function monoCharWidth(fontSize: number): number {
  return fontSize * MONO_RATIO;
}

/** Center x of a token that starts at column `col` and is `length` characters long. */
export function tokenCenterX(startX: number, col: number, length: number, fontSize: number): number {
  return startX + (col + length / 2) * monoCharWidth(fontSize);
}

function stampPair(t: number, faultyAt: number, fixedAt: number | null, fixedKind: StampKind = 'repaired'): StampState[] {
  const faultyIn = ease(t, faultyAt, faultyAt + 400);
  const stamps: StampState[] = [];
  if (fixedAt === null) {
    stamps.push({ kind: 'needs-repair', opacity: faultyIn, scale: lerp(1.5, 1, ease(t, faultyAt, faultyAt + 600)) });
    return stamps;
  }
  const faultyOut = 1 - ease(t, fixedAt, fixedAt + 300);
  stamps.push({ kind: 'needs-repair', opacity: faultyIn * faultyOut, scale: lerp(1.5, 1, ease(t, faultyAt, faultyAt + 600)) });
  stamps.push({
    kind: fixedKind,
    opacity: ease(t, fixedAt + 300, fixedAt + 600),
    scale: lerp(1.5, 1, ease(t, fixedAt + 300, fixedAt + 900)),
  });
  return stamps;
}

function cardStatus(stamps: StampState[]): CardStatus {
  const fixed = stamps.find((s) => s.kind !== 'needs-repair');
  if (fixed && fixed.opacity > 0.5) return 'fixed';
  const faulty = stamps.find((s) => s.kind === 'needs-repair');
  if (faulty && faulty.opacity > 0.5) return 'faulty';
  return 'neutral';
}

const CARD_BASE = { x: 14, y: 8, width: 372, stampX: 302, stampY: 27 } as const;

// ---------- 8a. Intro ----------

export interface IntroState {
  kind: 'intro';
  jobCards: { id: string; name: string; x: number; y: number; opacity: number }[];
  checklist: { id: string; text: string; x: number; y: number; opacity: number }[];
  stamp: StampState;
}

const JOB_CARD_NAMES = [PENCIL.owner, 'Class', 'Sam'] as const;
const CHECKLIST_TEXT = ['correct numbers', 'units, like cm', 'clear labels', 'true equal signs'] as const;

function introState(t: number): IntroState {
  return {
    kind: 'intro',
    jobCards: JOB_CARD_NAMES.map((name, k) => {
      const p = ease(t, 4200 + k * 600, 5100 + k * 600);
      return { id: `job-${k}`, name, x: 146 + k * 82 + lerp(180, 0, p), y: 102, opacity: p };
    }),
    checklist: CHECKLIST_TEXT.map((text, k) => ({
      id: `check-${k}`,
      text,
      x: 168,
      y: 234 + k * 20,
      opacity: ease(t, 8400 + k * 800, 8900 + k * 800),
    })),
    stamp: { kind: 'needs-repair', opacity: ease(t, 12400, 12800), scale: lerp(1.6, 1, ease(t, 12400, 13000)) },
  };
}

// ---------- 8b. Ruler scenes (pencil, eraser) ----------

export interface RulerItemState {
  id: 'pencil' | 'eraser';
  noun: string;
  leftX: number;
  y: number;
  height: number;
  widthPx: number;
  lengthCm: number;
  opacity: number;
}

export interface HopState {
  id: string;
  index: number;
  fromX: number;
  toX: number;
  baseY: number;
  peakY: number;
  opacity: number;
  draw: number;
}

export interface RulerSceneState {
  kind: 'ruler';
  ruler: RulerSpec;
  card: CardState;
  item: RulerItemState;
  hops: HopState[];
  guides: { id: string; x: number; opacity: number }[];
  zeroMarker: { x: number; opacity: number };
  unitLabelHighlight: number;
}

export const UNIT_MESSAGE_LAYOUT = { x: 30, y: 76, fontSize: 22 } as const;
const ITEM_Y = 148;
const ITEM_HEIGHT = 24;

interface UnitTokenMotion {
  x: number;
  y: number;
  opacity: number;
  pill: number;
}

function unitMessageTokens(tokenOpacity: number, unitInsert: number, unit: UnitTokenMotion | null): MessageToken[] {
  const { x, y, fontSize } = UNIT_MESSAGE_LAYOUT;
  const p = UNIT_MESSAGE_PARTS;
  const numberCol = p.pre.length + 1;
  const unitCol = numberCol + p.number.length + 1;
  const postColFaulty = unitCol;
  const postColFixed = unitCol + p.unit.length + 1;
  const base = { y, fontSize, opacity: tokenOpacity, emphasis: false, pill: 0 };
  const tokens: MessageToken[] = [
    { ...base, id: 'msg-pre', text: p.pre, x: tokenCenterX(x, 0, p.pre.length, fontSize) },
    { ...base, id: 'msg-number', text: p.number, x: tokenCenterX(x, numberCol, p.number.length, fontSize) },
  ];
  if (unit) {
    tokens.push({ id: 'msg-unit', text: p.unit, x: unit.x, y: unit.y, fontSize, opacity: unit.opacity, emphasis: true, pill: unit.pill });
  }
  tokens.push({
    ...base,
    id: 'msg-post',
    text: p.post,
    x: tokenCenterX(x, lerp(postColFaulty, postColFixed, unitInsert), p.post.length, fontSize),
  });
  return tokens;
}

export function unitTokenTarget(): { x: number; y: number } {
  const { x, y, fontSize } = UNIT_MESSAGE_LAYOUT;
  const p = UNIT_MESSAGE_PARTS;
  const unitCol = p.pre.length + 1 + p.number.length + 1;
  return { x: tokenCenterX(x, unitCol, p.unit.length, fontSize), y };
}

function rulerItem(id: 'pencil' | 'eraser', lengthCm: number, leftX: number, opacity: number): RulerItemState {
  return {
    id,
    noun: id,
    leftX,
    y: ITEM_Y,
    height: ITEM_HEIGHT,
    widthPx: lengthCm * PENCIL_RULER.pxPerCm,
    lengthCm,
    opacity,
  };
}

function lookUnitState(t: number): RulerSceneState {
  const r = PENCIL_RULER;
  const stamps = stampPair(t, 10500, null);
  return {
    kind: 'ruler',
    ruler: r,
    card: {
      ...CARD_BASE,
      height: 90,
      header: `${PENCIL.owner}'s message`,
      status: cardStatus(stamps),
      opacity: ease(t, 0, 1000),
      tokens: unitMessageTokens(ease(t, 7000, 7800), 0, null),
      stamps,
    },
    item: rulerItem('pencil', PENCIL.lengthCm, lerp(cmToX(r, 0) + 70, cmToX(r, 0), ease(t, 3800, 5600)), ease(t, 3500, 4000)),
    hops: [],
    guides: [],
    zeroMarker: { x: cmToX(r, 0), opacity: 0 },
    unitLabelHighlight: 0,
  };
}

function repairUnitState(t: number): RulerSceneState {
  const r = PENCIL_RULER;
  const stamps = stampPair(t, -1000, 15000);
  const unitLabel = rulerUnitLabel(r);
  const target = unitTokenTarget();
  const fly = ease(t, 12200, 14200);
  const hops: HopState[] = range(1, PENCIL.lengthCm).map((k) => {
    const start = HOP_START + (k - 1) * HOP_EACH;
    return {
      id: `hop-${k}`,
      index: k,
      fromX: cmToX(r, k - 1),
      toX: cmToX(r, k),
      baseY: ITEM_Y - 6,
      peakY: ITEM_Y - 36,
      opacity: ease(t, start, start + 400),
      draw: ease(t, start, start + 600),
    };
  });
  const guides = range(0, PENCIL.lengthCm).map((k) => ({
    id: `guide-${k}`,
    x: cmToX(r, k),
    opacity: k === 0 ? ease(t, HOP_START - 400, HOP_START) : ease(t, HOP_START + (k - 1) * HOP_EACH, HOP_START + (k - 1) * HOP_EACH + 400),
  }));
  return {
    kind: 'ruler',
    ruler: r,
    card: {
      ...CARD_BASE,
      height: 90,
      header: `${PENCIL.owner}'s message`,
      status: cardStatus(stamps),
      opacity: 1,
      tokens: unitMessageTokens(1, ease(t, 13200, 14200), {
        x: lerp(unitLabel.x - 8, target.x, fly),
        y: lerp(unitLabel.y, target.y, fly),
        opacity: ease(t, 11600, 12000),
        pill: ease(t, 11600, 12000) * (1 - ease(t, 14200, 15000)),
      }),
      stamps,
    },
    item: rulerItem('pencil', PENCIL.lengthCm, cmToX(r, 0), 1),
    hops,
    guides,
    zeroMarker: { x: cmToX(r, 0), opacity: ease(t, 300, 1000) * (1 - ease(t, HOPS_END - 500, HOPS_END)) },
    unitLabelHighlight: ease(t, HOPS_END, HOPS_END + 600) * (1 - ease(t, 14200, 14800)),
  };
}

function eraserState(): RulerSceneState {
  const r = PENCIL_RULER;
  return {
    kind: 'ruler',
    ruler: r,
    card: {
      ...CARD_BASE,
      height: 90,
      header: `${ERASER.owner}'s eraser`,
      status: 'neutral',
      opacity: 1,
      tokens: [
        {
          id: 'msg-blank',
          text: `${ERASER.owner}'s message: ?`,
          x: tokenCenterX(UNIT_MESSAGE_LAYOUT.x, 0, `${ERASER.owner}'s message: ?`.length, UNIT_MESSAGE_LAYOUT.fontSize),
          y: UNIT_MESSAGE_LAYOUT.y,
          fontSize: UNIT_MESSAGE_LAYOUT.fontSize,
          opacity: 1,
          emphasis: false,
          pill: 0,
        },
      ],
      stamps: [],
    },
    item: rulerItem('eraser', ERASER.lengthCm, cmToX(r, 0), 1),
    hops: [],
    guides: [],
    zeroMarker: { x: cmToX(r, 0), opacity: 0 },
    unitLabelHighlight: 0,
  };
}

// ---------- 8c. Graph scenes ----------

export interface GraphTickState {
  id: string;
  index: number;
  y: number;
  label: number;
  previousLabel: number | null;
  morph: number;
}

export interface GraphBarState {
  id: string;
  fruitId: FruitId;
  label: string;
  count: number;
  centerX: number;
  width: number;
  topY: number;
  height: number;
}

export interface TallyRowState {
  fruitId: FruitId;
  label: string;
  count: number;
  fives: number;
  ones: number;
  opacity: number;
  highlight: boolean;
}

export interface GraphSceneState {
  kind: 'graph';
  graphOpacity: number;
  ticks: GraphTickState[];
  bars: GraphBarState[];
  tally: TallyRowState[];
  pointer: { index: number; opacity: number; atGap: boolean } | null;
  gapMarker: { index: number; opacity: number };
  spaceBands: number;
  readingLine: { fruitId: FruitId; x1: number; x2: number; y: number; opacity: number } | null;
  stamps: StampState[];
  status: CardStatus;
}

function graphBars(grow: (k: number) => number): GraphBarState[] {
  return FRUITS.map((f, k) => {
    const g = grow(k);
    const fullTop = barTopY(f.count);
    return {
      id: `bar-${f.id}`,
      fruitId: f.id,
      label: f.label,
      count: f.count,
      centerX: barCenterX(k),
      width: GRAPH.barWidth,
      topY: lerp(GRAPH.baseY, fullTop, g),
      height: (GRAPH.baseY - fullTop) * g,
    };
  });
}

function graphTicks(morphOf: (index: number) => number): GraphTickState[] {
  return CORRECT_SCALE.map((correctLabel, index) => {
    const faultyLabel = FAULTY_SCALE[index];
    const morph = faultyLabel === correctLabel ? 1 : morphOf(index);
    return {
      id: `tick-${index}`,
      index,
      y: gridY(index),
      label: correctLabel,
      previousLabel: faultyLabel === correctLabel ? null : faultyLabel,
      morph,
    };
  });
}

function tallyRows(opacityOf: (k: number) => number, highlight: FruitId | null): TallyRowState[] {
  return FRUITS.map((f, k) => ({
    fruitId: f.id,
    label: f.label,
    count: f.count,
    ...tallyGroups(f.count),
    opacity: opacityOf(k),
    highlight: highlight === f.id,
  }));
}

/** Label a reader currently sees at gridline i. */
export function displayedTickLabel(tick: GraphTickState): number {
  if (tick.previousLabel === null) return tick.label;
  return tick.morph >= 0.5 ? tick.label : tick.previousLabel;
}

function lookAxisState(t: number): GraphSceneState {
  const stamps = stampPair(t, 10500, null);
  return {
    kind: 'graph',
    graphOpacity: ease(t, 7000, 7600),
    ticks: graphTicks(() => 0),
    bars: graphBars((k) => ease(t, 7400 + k * 300, 8200 + k * 300)),
    tally: tallyRows((k) => ease(t, 3700 + k * 400, 4200 + k * 400), null),
    pointer: null,
    gapMarker: { index: SCALE_GAP.index, opacity: 0 },
    spaceBands: 0,
    readingLine: null,
    stamps,
    status: cardStatus(stamps),
  };
}

function repairAxisState(t: number): GraphSceneState {
  const stamps = stampPair(t, -1000, 19000);
  const pointerRaw = Math.floor((t - POINTER_START) / POINTER_EACH);
  const pointerIndex = clamp(pointerRaw, 0, SCALE_GAP.index);
  const pointerVisible = t >= POINTER_START && t < 5000;
  const applesIndex = FRUITS.findIndex((f) => f.id === 'apples');
  return {
    kind: 'graph',
    graphOpacity: 1,
    ticks: graphTicks((index) => {
      const start = MORPH_START + (index - SCALE_GAP.index) * MORPH_EACH;
      return ease(t, start, start + 700);
    }),
    bars: graphBars(() => 1),
    tally: tallyRows(() => 1, t >= 15300 ? 'apples' : null),
    pointer: pointerVisible
      ? { index: pointerIndex, opacity: ease(t, POINTER_START - 100, POINTER_START + 200), atGap: pointerIndex === SCALE_GAP.index }
      : null,
    gapMarker: {
      index: SCALE_GAP.index,
      opacity:
        ease(t, POINTER_START + SCALE_GAP.index * POINTER_EACH, POINTER_START + SCALE_GAP.index * POINTER_EACH + 300) *
        (1 - ease(t, MORPH_START, MORPH_START + 700)),
    },
    spaceBands: ease(t, 5200, 6000) * (1 - ease(t, 9000, 9500)),
    readingLine: {
      fruitId: 'apples',
      x1: barCenterX(applesIndex) - GRAPH.barWidth / 2,
      x2: GRAPH.axisX,
      y: barTopY(apples.count),
      opacity: ease(t, 14700, 15300),
    },
    stamps,
    status: cardStatus(stamps),
  };
}

// ---------- 8d. Equation scenes (stickers, shells) ----------

export interface DotGroupState {
  id: string;
  count: number;
  label: string;
  x: number;
  y: number;
  width: number;
  labelY: number;
  opacity: number;
}

export interface PanState {
  side: 'left' | 'right';
  label: string;
  solid: number;
  hollow: number;
  total: number;
  centerX: number;
  trayY: number;
  opacity: number;
  totalOpacity: number;
}

export interface BalanceState {
  opacity: number;
  pivot: { x: number; y: number };
  halfBeam: number;
  angle: number;
  left: PanState;
  right: PanState;
  relation: { symbol: '=' | '≠'; text: string; opacity: number } | null;
}

export interface EquationSceneState {
  kind: 'equation';
  card: CardState;
  lineChecks: { id: string; x: number; y: number; opacity: number }[];
  groups: DotGroupState[];
  connectorOpacity: number;
  balance: BalanceState;
}

export const CHAIN_LAYOUT = { fontSize: 26, chainY: 78, line1Y: 70, line2Y: 106 } as const;
export const BALANCE = { pivotX: 200, pivotY: 174, halfBeam: 130, string: 58, standBottom: 298 } as const;
export const DOT = { radius: 6, spacing: 16, perRow: 5 } as const;
export const GROUP_DOT = { radius: 7, spacing: 18 } as const;

/** Balance-pan dots: rows of 5 (ten-frame style) stacked up from the tray. */
export function panDotCenter(pan: { centerX: number; trayY: number }, k: number): { x: number; y: number } {
  const row = Math.floor(k / DOT.perRow);
  const col = k % DOT.perRow;
  return { x: pan.centerX + (col - (DOT.perRow - 1) / 2) * DOT.spacing, y: pan.trayY - 9 - row * DOT.spacing };
}

/** Story dots (stickers, shells): rows of 5 from the group's top-left corner. */
export function groupDotCenter(g: { x: number; y: number }, k: number): { x: number; y: number } {
  return {
    x: g.x + (k % DOT.perRow) * GROUP_DOT.spacing + GROUP_DOT.spacing / 2,
    y: g.y + Math.floor(k / DOT.perRow) * GROUP_DOT.spacing,
  };
}

export function groupWidth(count: number): number {
  return Math.min(count, DOT.perRow) * GROUP_DOT.spacing;
}

interface TokenSlot {
  id: string;
  text: string;
  chainCol: number | null;
  line: 1 | 2;
  lineCol: number;
}

/** Stable token identities for "a + b = mid + c = total" splitting into two lines. */
function chainTokenSlots(m: StoryMessages): TokenSlot[] {
  const [a, b] = m.faultyChain[0];
  const [mid, c] = m.faultyChain[1];
  const total = valueOf(m.faultyChain[2]);
  const parts: { id: string; text: string; line: 1 | 2; lineIndex: number; chainIndex: number | null }[] = [
    { id: 'tok-a', text: String(a), line: 1, lineIndex: 0, chainIndex: 0 },
    { id: 'tok-plus1', text: '+', line: 1, lineIndex: 1, chainIndex: 1 },
    { id: 'tok-b', text: String(b), line: 1, lineIndex: 2, chainIndex: 2 },
    { id: 'tok-eq1', text: '=', line: 1, lineIndex: 3, chainIndex: 3 },
    { id: 'tok-mid', text: String(mid), line: 1, lineIndex: 4, chainIndex: 4 },
    { id: 'tok-mid-copy', text: String(mid), line: 2, lineIndex: 0, chainIndex: null },
    { id: 'tok-plus2', text: '+', line: 2, lineIndex: 1, chainIndex: 5 },
    { id: 'tok-c', text: String(c), line: 2, lineIndex: 2, chainIndex: 6 },
    { id: 'tok-eq2', text: '=', line: 2, lineIndex: 3, chainIndex: 7 },
    { id: 'tok-total', text: String(total), line: 2, lineIndex: 4, chainIndex: 8 },
  ];
  const chainTexts = parts.filter((p) => p.chainIndex !== null).sort((x, y) => x.chainIndex! - y.chainIndex!);
  const chainCols = new Map<string, number>();
  let col = 0;
  for (const p of chainTexts) {
    chainCols.set(p.id, col);
    col += p.text.length + 1;
  }
  const lineCols = new Map<string, number>();
  for (const line of [1, 2] as const) {
    let lc = 0;
    for (const p of parts.filter((q) => q.line === line).sort((x, y) => x.lineIndex - y.lineIndex)) {
      lineCols.set(p.id, lc);
      lc += p.text.length + 1;
    }
  }
  return parts.map((p) => ({
    id: p.id,
    text: p.text,
    chainCol: chainCols.get(p.id) ?? null,
    line: p.line,
    lineCol: lineCols.get(p.id)!,
  }));
}

export interface ChainGeometry {
  chainStartX: number;
  line1StartX: number;
  line2StartX: number;
  lineEndX: number;
}

/** Center the run-on chain; align the two repaired lines on their equal signs. */
export function chainGeometry(m: StoryMessages): ChainGeometry {
  const fs = CHAIN_LAYOUT.fontSize;
  const cw = monoCharWidth(fs);
  const chainLen = formatChain(m.faultyChain).length;
  const line1 = formatChain(m.repaired[0]);
  const line2 = formatChain(m.repaired[1]);
  const eq1 = line1.indexOf('=');
  const eq2 = line2.indexOf('=');
  const longest = Math.max(eq1, eq2) + Math.max(line1.length - eq1, line2.length - eq2);
  const blockStart = (VIEWBOX.width - longest * cw) / 2;
  const eqCenter = blockStart + (Math.max(eq1, eq2) + 0.5) * cw;
  const line1StartX = eqCenter - (eq1 + 0.5) * cw;
  const line2StartX = eqCenter - (eq2 + 0.5) * cw;
  return {
    chainStartX: (VIEWBOX.width - chainLen * cw) / 2,
    line1StartX,
    line2StartX,
    lineEndX: Math.max(line1StartX + line1.length * cw, line2StartX + line2.length * cw),
  };
}

function chainTokens(
  m: StoryMessages,
  split: number,
  appear: (k: number) => number,
  copyOpacity: number,
  emphasizeLine: 0 | 1 | 2,
): MessageToken[] {
  const fs = CHAIN_LAYOUT.fontSize;
  const g = chainGeometry(m);
  const slots = chainTokenSlots(m);
  let order = 0;
  return slots.map((s) => {
    const lineStart = s.line === 1 ? g.line1StartX : g.line2StartX;
    const lineY = s.line === 1 ? CHAIN_LAYOUT.line1Y : CHAIN_LAYOUT.line2Y;
    const endX = tokenCenterX(lineStart, s.lineCol, s.text.length, fs);
    if (s.chainCol === null) {
      // The copied middle number grows out of the original one.
      const source = slots.find((q) => q.id === 'tok-mid')!;
      const fromX = tokenCenterX(g.chainStartX, source.chainCol!, source.text.length, fs);
      const fromY = lerp(CHAIN_LAYOUT.chainY, CHAIN_LAYOUT.line1Y, split);
      return {
        id: s.id,
        text: s.text,
        x: lerp(fromX, endX, split),
        y: lerp(fromY, lineY, split),
        fontSize: fs,
        opacity: copyOpacity,
        emphasis: emphasizeLine === s.line,
        pill: 0,
      };
    }
    const startX = tokenCenterX(g.chainStartX, s.chainCol, s.text.length, fs);
    const k = order;
    order += 1;
    return {
      id: s.id,
      text: s.text,
      x: lerp(startX, endX, split),
      y: lerp(CHAIN_LAYOUT.chainY, lineY, split),
      fontSize: fs,
      opacity: appear(k),
      emphasis: emphasizeLine === s.line,
      pill: 0,
    };
  });
}

function dotGroups(story: ThreeStepStory, nouns: readonly [string, string, string], opacityOf: (k: number) => number): DotGroupState[] {
  const counts = [story.a, story.b, story.c];
  const widths = counts.map(groupWidth);
  const gap = 44;
  const total = widths.reduce((s, w) => s + w, 0) + gap * 2;
  let x = (VIEWBOX.width - total) / 2;
  return counts.map((count, k) => {
    const g = { id: `group-${k}`, count, label: nouns[k], x, y: 196, width: widths[k], labelY: 256, opacity: opacityOf(k) };
    x += widths[k] + gap;
    return g;
  });
}

function panFor(side: 'left' | 'right', e: Expr, angle: number, opacity: number, totalOpacity: number): PanState {
  const rad = (angle * Math.PI) / 180;
  const dir = side === 'left' ? -1 : 1;
  const endX = BALANCE.pivotX + dir * BALANCE.halfBeam * Math.cos(rad);
  const endY = BALANCE.pivotY + dir * BALANCE.halfBeam * Math.sin(rad);
  return {
    side,
    label: formatExpr(e),
    solid: e[0],
    hollow: e.length > 1 ? valueOf(e.slice(1)) : 0,
    total: valueOf(e),
    centerX: endX,
    trayY: endY + BALANCE.string,
    opacity,
    totalOpacity,
  };
}

function hiddenBalance(): BalanceState {
  const [l, r] = STICKER_MESSAGES.faultyChain;
  return {
    opacity: 0,
    pivot: { x: BALANCE.pivotX, y: BALANCE.pivotY },
    halfBeam: BALANCE.halfBeam,
    angle: 0,
    left: panFor('left', l, 0, 0, 0),
    right: panFor('right', r, 0, 0, 0),
    relation: null,
  };
}

function lookEqualState(t: number): EquationSceneState {
  const stamps = stampPair(t, 10500, null);
  const m = STICKER_MESSAGES;
  return {
    kind: 'equation',
    card: {
      ...CARD_BASE,
      height: 110,
      header: "Sam's message",
      status: cardStatus(stamps),
      opacity: ease(t, 0, 1000),
      tokens: chainTokens(m, 0, (k) => ease(t, 7000 + k * 90, 7300 + k * 90), 0, 0),
      stamps,
    },
    lineChecks: [],
    groups: dotGroups(STICKERS, ['stickers', 'more', 'more'], (k) => ease(t, 3500 + k * 1100, 4100 + k * 1100)),
    connectorOpacity: ease(t, 6200, 6700),
    balance: hiddenBalance(),
  };
}

function repairEqualState(t: number): EquationSceneState {
  const m = STICKER_MESSAGES;
  const stamps = stampPair(t, -1000, 24500);
  const split = ease(t, 11000, 13000);
  const [faultyLeft, faultyRight] = m.faultyChain;
  const [line1, line2] = m.repaired;
  const tiltFaulty = tiltAngle(valueOf(faultyLeft), valueOf(faultyRight));

  let left: Expr;
  let right: Expr;
  let fade: number;
  let angle: number;
  let leftIn = 1;
  let rightIn = 1;
  let totals: number;
  let relation: BalanceState['relation'];
  if (t < 13950) {
    left = faultyLeft;
    right = faultyRight;
    fade = 1 - ease(t, 13500, 13900);
    leftIn = ease(t, 1300, 2300);
    rightIn = ease(t, 2600, 3600);
    angle = tiltFaulty * ease(t, 4500, 6500);
    totals = ease(t, 5000, 5600);
    relation = { symbol: '≠', text: 'not equal', opacity: ease(t, 7000, 7600) * (1 - ease(t, 10000, 10400)) };
  } else if (t < 19450) {
    left = line1[0];
    right = line1[1];
    fade = ease(t, 14000, 14600) * (1 - ease(t, 19000, 19400));
    angle = lerp(tiltFaulty, tiltAngle(valueOf(line1[0]), valueOf(line1[1])), ease(t, 14600, 16200));
    totals = 1;
    relation = { symbol: '=', text: 'equal', opacity: ease(t, 16200, 16800) * (1 - ease(t, 19000, 19300)) };
  } else {
    left = line2[0];
    right = line2[1];
    fade = ease(t, 19500, 20100);
    angle = tiltAngle(valueOf(line2[0]), valueOf(line2[1]));
    totals = 1;
    relation = { symbol: '=', text: 'equal', opacity: ease(t, 21000, 21600) };
  }
  const g = chainGeometry(m);
  const emphasize: 0 | 1 | 2 = t >= 13500 && t < 19000 ? 1 : t >= 19000 && t < 24500 ? 2 : 0;
  return {
    kind: 'equation',
    card: {
      ...CARD_BASE,
      height: 110,
      header: "Sam's message",
      status: cardStatus(stamps),
      opacity: 1,
      tokens: chainTokens(m, split, () => 1, ease(t, 11000, 11400), emphasize),
      stamps,
    },
    lineChecks: [
      { id: 'check-line-1', x: g.lineEndX + 14, y: CHAIN_LAYOUT.line1Y, opacity: ease(t, 16800, 17400) },
      { id: 'check-line-2', x: g.lineEndX + 14, y: CHAIN_LAYOUT.line2Y, opacity: ease(t, 21600, 22200) },
    ],
    groups: dotGroups(STICKERS, ['stickers', 'more', 'more'], () => 1 - ease(t, 0, 700)),
    connectorOpacity: 1 - ease(t, 0, 700),
    balance: {
      opacity: ease(t, 500, 1300),
      pivot: { x: BALANCE.pivotX, y: BALANCE.pivotY },
      halfBeam: BALANCE.halfBeam,
      angle,
      left: panFor('left', left, angle, fade * leftIn, fade * totals),
      right: panFor('right', right, angle, fade * rightIn, fade * totals),
      relation,
    },
  };
}

function shellsState(): EquationSceneState {
  const text = "Kim's message: ?";
  return {
    kind: 'equation',
    card: {
      ...CARD_BASE,
      height: 110,
      header: "Kim's shells",
      status: 'neutral',
      opacity: 1,
      tokens: [
        {
          id: 'msg-blank',
          text,
          x: tokenCenterX(30, 0, text.length, 22),
          y: 82,
          fontSize: 22,
          opacity: 1,
          emphasis: false,
          pill: 0,
        },
      ],
      stamps: [],
    },
    lineChecks: [],
    groups: dotGroups(SHELLS, ['shells', 'more', 'more'], () => 1),
    connectorOpacity: 1,
    balance: hiddenBalance(),
  };
}

// ---------- 8e. Transfer scenes (ribbon) ----------

export interface RibbonPieceState {
  id: string;
  lengthCm: number;
  label: string;
  leftX: number;
  y: number;
  widthPx: number;
  opacity: number;
}

export interface CardLine {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  opacity: number;
}

export interface TransferSceneState {
  kind: 'transfer';
  ruler: RulerSpec;
  rulerOpacity: number;
  card: CardState;
  lines: CardLine[];
  pieces: RibbonPieceState[];
  bracket: { fromX: number; toX: number; y: number; label: string; opacity: number };
}

export const RIBBON_LAYOUT = { joinedY: 182, floatY: 140, pieceHeight: 16, lineFontSize: 18 } as const;

export function ribbonPieceTargets(): { id: string; fromCm: number; toCm: number }[] {
  const { a, b, c } = RIBBON_STORY;
  return [
    { id: 'piece-start', fromCm: 0, toCm: a },
    { id: 'piece-first', fromCm: a, toCm: a + b },
    { id: 'piece-second', fromCm: a + b, toCm: a + b + c },
  ];
}

function transferLines(o1: number, o2: number, o3: number): CardLine[] {
  const fs = RIBBON_LAYOUT.lineFontSize;
  const cw = monoCharWidth(fs);
  const [l1, l2] = RIBBON_MESSAGES.repaired.map(formatChain);
  const eq1 = l1.indexOf('=');
  const eq2 = l2.indexOf('=');
  const eqCenter = 30 + (Math.max(eq1, eq2) + 0.5) * cw;
  const final = lengthStatement(RIBBON.noun, { value: RIBBON_MESSAGES.total, unit: 'cm' });
  return [
    { id: 'line-1', text: l1, x: eqCenter - (eq1 + 0.5) * cw, y: 61, fontSize: fs, opacity: o1 },
    { id: 'line-2', text: l2, x: eqCenter - (eq2 + 0.5) * cw, y: 85, fontSize: fs, opacity: o2 },
    { id: 'line-3', text: final, x: 30, y: 109, fontSize: fs, opacity: o3 },
  ];
}

function transferState(t: number, reveal: boolean): TransferSceneState {
  const r = RIBBON_RULER;
  const targets = ribbonPieceTargets();
  const floatX = [cmToX(r, 0), 258, 290];
  const moveFirst = reveal ? ease(t, 500, 2500) : 0;
  const moveSecond = reveal ? ease(t, 5500, 7500) : 0;
  const moves = [1, moveFirst, moveSecond];
  const pieces = targets.map((target, k) => {
    const lengthCm = target.toCm - target.fromCm;
    const joinedX = cmToX(r, target.fromCm);
    const p = moves[k];
    return {
      id: target.id,
      lengthCm,
      label: formatLength(lengthCm),
      leftX: k === 0 ? joinedX : lerp(floatX[k], joinedX, p),
      y: k === 0 ? RIBBON_LAYOUT.joinedY : lerp(RIBBON_LAYOUT.floatY, RIBBON_LAYOUT.joinedY, p),
      widthPx: lengthCm * r.pxPerCm,
      opacity: reveal ? 1 : ease(t, 4000 + k * 800, 4500 + k * 800),
    };
  });
  const stamps = reveal ? stampPair(t, 14600, null).map((s) => ({ ...s, kind: 'precise' as StampKind })) : [];
  return {
    kind: 'transfer',
    ruler: r,
    rulerOpacity: reveal ? 1 : ease(t, 300, 1000),
    card: {
      ...CARD_BASE,
      height: 112,
      header: `${RIBBON.owner}'s message`,
      status: reveal && t >= 14600 ? 'fixed' : 'neutral',
      opacity: reveal ? 1 : ease(t, 0, 800),
      tokens: [],
      stamps,
    },
    lines: reveal
      ? transferLines(ease(t, 2500, 3100), ease(t, 7500, 8100), ease(t, 14000, 14600))
      : transferLines(0, 0, 0),
    pieces,
    bracket: {
      fromX: cmToX(r, 0),
      toX: cmToX(r, RIBBON_MESSAGES.total),
      y: 152,
      label: formatLength(RIBBON_MESSAGES.total),
      opacity: reveal ? ease(t, 10000, 10800) : 0,
    },
  };
}

// ---------- 8f. Finale ----------

export interface FinaleState {
  kind: 'finale';
  rows: { id: string; title: string; detail: string; y: number; opacity: number }[];
  badgeOpacity: number;
}

export const FINALE_ROWS = [
  { id: 'row-units', title: 'Units', detail: `${formatLength(PENCIL.lengthCm)}, not just ${PENCIL.lengthCm}` },
  { id: 'row-labels', title: 'Labels', detail: 'each axis space = 1 student' },
  { id: 'row-equals', title: 'True equal signs', detail: STICKER_REPAIRED_TEXT },
] as const;

function finaleState(t: number): FinaleState {
  return {
    kind: 'finale',
    rows: FINALE_ROWS.map((row, k) => ({ ...row, y: 92 + k * 62, opacity: ease(t, 800 + k * 1500, 1300 + k * 1500) })),
    badgeOpacity: ease(t, 8500, 9200),
  };
}

// ---------- 8g. Dispatcher ----------

export type SceneState =
  | IntroState
  | RulerSceneState
  | GraphSceneState
  | EquationSceneState
  | TransferSceneState
  | FinaleState;

export function sceneState(id: SceneId, tRaw: number): SceneState {
  const t = clamp(tRaw, 0, SCENES[id].duration);
  switch (id) {
    case 'intro':
      return introState(t);
    case 'look-unit':
      return lookUnitState(t);
    case 'repair-unit':
      return repairUnitState(t);
    case 'eraser':
      return eraserState();
    case 'look-axis':
      return lookAxisState(t);
    case 'repair-axis':
      return repairAxisState(t);
    case 'look-equal':
      return lookEqualState(t);
    case 'repair-equal':
      return repairEqualState(t);
    case 'shells':
      return shellsState();
    case 'look-transfer':
      return transferState(t, false);
    case 'reveal-transfer':
      return transferState(t, true);
    case 'finale':
      return finaleState(t);
  }
}

// ============================================================================
// 9. Accessible descriptions (describe only what is visible; never name an answer)
// ============================================================================

function visibleTokenText(tokens: MessageToken[]): string {
  return tokens
    .filter((tok) => tok.opacity > 0.5)
    .sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y))
    .reduce<{ y: number | null; parts: string[] }>(
      (acc, tok) => {
        if (acc.y !== null && Math.abs(acc.y - tok.y) > 4) acc.parts.push('/');
        acc.parts.push(tok.text);
        acc.y = tok.y;
        return acc;
      },
      { y: null, parts: [] },
    )
    .parts.join(' ')
    .replace(/ \/ /g, ' / ');
}

function stampText(stamps: StampState[]): string {
  const shown = stamps.filter((s) => s.opacity > 0.5);
  if (shown.length === 0) return '';
  return `Stamp: ${TEXT.stamp[shown[shown.length - 1].kind]}.`;
}

export function describeScene(state: SceneState): string {
  switch (state.kind) {
    case 'intro': {
      const parts = ["A shop sign reads Math-Message Repair Shop. Juno the fixer stands by the counter."];
      const cards = state.jobCards.filter((c) => c.opacity > 0.5);
      if (cards.length) parts.push(`Job cards from: ${cards.map((c) => c.name).join(', ')}.`);
      const items = state.checklist.filter((c) => c.opacity > 0.5);
      if (items.length) parts.push(`A precise message has: ${items.map((c) => c.text).join(', ')}.`);
      if (state.stamp.opacity > 0.5) parts.push('A NEEDS REPAIR stamp marks broken messages.');
      return parts.join(' ');
    }
    case 'ruler': {
      const parts = [`${state.card.header}.`];
      const msg = visibleTokenText(state.card.tokens);
      if (msg && state.card.opacity > 0.5) parts.push(`Message: “${msg}”.`);
      const stamp = stampText(state.card.stamps);
      if (stamp) parts.push(stamp);
      parts.push(`A centimeter ruler with marks labeled 0 to ${state.ruler.maxCm}.`);
      if (state.item.opacity > 0.5) {
        const left = round(xToCm(state.ruler, state.item.leftX), 1);
        const right = round(xToCm(state.ruler, state.item.leftX + state.item.widthPx), 1);
        parts.push(`The ${state.item.noun} lies along the ruler from the ${left} mark to the ${right} mark.`);
      }
      const hops = state.hops.filter((h) => h.opacity > 0.5);
      if (hops.length) parts.push(`Spaces counted so far: ${hops.map((h) => h.index).join(', ')}.`);
      return parts.join(' ');
    }
    case 'graph': {
      const labels = state.ticks.map(displayedTickLabel);
      const parts = [
        `Tally chart: ${state.tally.filter((r) => r.opacity > 0.5).map((r) => `${r.label} ${r.count}`).join(', ') || 'not shown yet'}.`,
      ];
      if (state.graphOpacity > 0.5) {
        parts.push(
          `Bar graph titled ${GRAPH.title}. Side axis title: ${GRAPH.yAxisTitle}. Side axis numbers from the bottom: ${labels.join(', ')}. Bottom axis: ${GRAPH.xAxisTitle}.`,
        );
        const barText = state.bars
          .filter((b) => b.height > 1)
          .map((b) => `${b.label} bar top lines up with ${labels[gridIndexAtY(b.topY)] ?? 'no label'}`)
          .join('; ');
        if (barText) parts.push(`${barText}.`);
      }
      const stamp = stampText(state.stamps);
      if (stamp) parts.push(stamp);
      return parts.join(' ');
    }
    case 'equation': {
      const parts = [`${state.card.header}.`];
      const msg = visibleTokenText(state.card.tokens);
      if (msg) parts.push(`Message: “${msg}”.`);
      const checks = state.lineChecks.filter((c) => c.opacity > 0.5);
      if (checks.length) parts.push(`Lines checked true: ${checks.length}.`);
      const stamp = stampText(state.card.stamps);
      if (stamp) parts.push(stamp);
      const groups = state.groups.filter((g) => g.opacity > 0.5);
      if (groups.length) parts.push(`Groups of dots: ${groups.map((g) => `${g.count} ${g.label}`).join(', then ')}.`);
      const b = state.balance;
      if (b.opacity > 0.5 && b.left.opacity > 0.5 && b.right.opacity > 0.5) {
        const tilt = b.angle > 0.5 ? 'tips down on the right' : b.angle < -0.5 ? 'tips down on the left' : 'is level';
        parts.push(`A balance holds ${b.left.label} on the left and ${b.right.label} on the right. The balance ${tilt}.`);
        if (b.relation && b.relation.opacity > 0.5) parts.push(`Sign between the pans: ${b.relation.text}.`);
      }
      return parts.join(' ');
    }
    case 'transfer': {
      const parts = [`${state.card.header}.`];
      const lines = state.lines.filter((l) => l.opacity > 0.5).map((l) => l.text);
      if (lines.length) parts.push(`Message: “${lines.join(' / ')}”.`);
      const stamp = stampText(state.card.stamps);
      if (stamp) parts.push(stamp);
      parts.push(`A centimeter ruler with marks labeled 0 to ${state.ruler.maxCm}.`);
      const pieces = state.pieces.filter((p) => p.opacity > 0.5);
      const onRuler = pieces.filter((p) => Math.abs(p.y - RIBBON_LAYOUT.joinedY) < 1);
      const apart = pieces.filter((p) => Math.abs(p.y - RIBBON_LAYOUT.joinedY) >= 1);
      if (onRuler.length) {
        parts.push(
          `On the ruler: ${onRuler
            .map((p) => `the ${p.label} piece from the ${round(xToCm(state.ruler, p.leftX), 1)} mark to the ${round(xToCm(state.ruler, p.leftX + p.widthPx), 1)} mark`)
            .join('; ')}.`,
        );
      }
      if (apart.length) parts.push(`Set apart above the ruler: ${apart.map((p) => `a ${p.label} piece`).join(' and ')}.`);
      if (state.bracket.opacity > 0.5) parts.push(`A bracket shows the whole ribbon: ${state.bracket.label}.`);
      return parts.join(' ');
    }
    case 'finale': {
      const rows = state.rows.filter((r) => r.opacity > 0.5);
      const parts = [`${TEXT.finaleTitle}.`];
      if (rows.length) parts.push(rows.map((r) => `Checked: ${r.title}, ${r.detail}.`).join(' '));
      if (state.badgeOpacity > 0.5) parts.push(`Badge: ${TEXT.finaleBadge}`);
      return parts.join(' ');
    }
  }
}
