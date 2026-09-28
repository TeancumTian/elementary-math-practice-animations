/**
 * The lesson script: short replayable chapters made of beats.
 *
 * Captions, questions, and scenes are composed only from the math model
 * (src/model/repeatedReasoning.ts). No number is typed by hand here — each one
 * comes from a model function, so the story can never disagree with the math.
 */
import {
  BUILD_GROUP_COUNTS,
  GROUP_SIZE,
  MONITOR_GROUPS,
  ORCHARD,
  PREDICT_GROUPS,
  PROPOSED_TERM,
  STICKERS,
  TRANSFER_GROUPS,
  type CountContext,
  claimHolds,
  equationLabel,
  multiplicationLabel,
  num,
  proposalFacts,
  proposalOptions,
  repeatedAdditionLabel,
  ruleSentence,
  runningTotals,
  stepLabel,
  totalFor,
} from '@/model/repeatedReasoning';

export type Phase = 'predict' | 'animate' | 'explain' | 'try';

export const PHASES: { id: Phase; label: string; icon: string }[] = [
  { id: 'predict', label: 'Predict', icon: '?' },
  { id: 'animate', label: 'Watch', icon: '▶' },
  { id: 'explain', label: 'Explain', icon: '≡' },
  { id: 'try', label: 'Try', icon: '✎' },
];

export type Focus =
  | { kind: 'crates'; crates: number[] }
  | { kind: 'cols'; cols: number[] }
  | { kind: 'totalsRow' }
  | { kind: 'slot'; crate: number; slot: number }
  | { kind: 'banner' }
  | { kind: 'sheets' }
  | { kind: 'runs' };

export interface OrchardScene {
  kind: 'orchard';
  /** Apples in crate 1, 2, … at the END of the beat. */
  apples: number[];
  /** An empty crate outline (the next crate to pack), showing its 5 empty spots. */
  emptyCrate?: number;
  /** Columns 1..totals show the model's total. */
  totals: number;
  /** Columns that show "?" (unknown, still to be found). */
  pending?: number[];
  /** Columns that show a learner's already-submitted prediction (pencil style). */
  predicted?: number[];
  /** Pip's proposed (wrong) term in column PROPOSED_TERM.groups. */
  guess?: 'shown' | 'crossed';
  /** "+5" jumps 1..arcs (jump k goes from column k to k + 1). */
  arcs: number;
  /** Rule cells "k × 5" for columns 1..rules. */
  rules: number;
  /** "Crate k: 5 apples" labels. */
  badges?: boolean;
  /** "Total = crates × 5" banner. */
  banner?: boolean;
  pip?: 'guess' | 'oops';
  /** Crate whose count-on counter is shown. */
  counter?: number;
  focus?: Focus;
}

export interface StickerScene {
  kind: 'stickers';
  sheets: number;
  runs: number;
  arcs: number;
  ruleLine: boolean;
  finale?: boolean;
  focus?: Focus;
}

export type Scene = OrchardScene | StickerScene;

export interface TimelineEntry {
  id: string;
  at: number;
  dur: number;
}

export type Question =
  | { id: string; kind: 'number'; prompt: string; groups: number; context: CountContext }
  | { id: string; kind: 'choice'; prompt: string; options: { id: string; text: string }[] };

export interface Beat {
  id: string;
  phase: Phase;
  caption: string;
  /** Milliseconds of playback (animation plus reading time). */
  duration: number;
  /** 'gate' waits for the learner's action button; 'question' waits for an answer. */
  wait?: 'gate' | 'question';
  actionLabel?: string;
  question?: Question;
  scene: Scene;
  timeline?: TimelineEntry[];
}

export interface Chapter {
  id: string;
  title: string;
  short: string;
  goal: string;
  beats: Beat[];
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const S = GROUP_SIZE;
const t = (g: number) => num(totalFor(g));
const fives = (g: number) => Array.from({ length: g }, () => S);
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

/** Apples drop one at a time into crate `crate`, slots from..to. */
function fill(crate: number, from: number, to: number, start = 300, step = 480, dur = 420): TimelineEntry[] {
  return range(from, to).map((slot, k) => ({ id: `apple-${crate}-${slot}`, at: start + k * step, dur }));
}

const orchard = (s: Omit<OrchardScene, 'kind'>): OrchardScene => ({ kind: 'orchard', ...s });

/* ------------------------------------------------------------------ */
/* Chapter 1 — Pack the Crates                                         */
/* ------------------------------------------------------------------ */

function buildChapter(): Chapter {
  const beats: Beat[] = [
    {
      id: 'c1-meet',
      phase: 'predict',
      caption: `Leo helps at Grandma June's apple stand. Every crate holds exactly ${num(S)} apples, one in each spot.`,
      duration: 6000,
      scene: orchard({ apples: [], emptyCrate: 1, totals: 0, arcs: 0, rules: 0, focus: { kind: 'crates', crates: [1] } }),
      timeline: [{ id: 'crate-1', at: 200, dur: 600 }],
    },
    {
      id: 'c1-think',
      phase: 'predict',
      caption: 'Predict: each time Leo packs one more crate, how will the total change? Keep your idea in mind.',
      duration: 5500,
      scene: orchard({ apples: [], emptyCrate: 1, totals: 0, arcs: 0, rules: 0 }),
    },
  ];

  for (const g of BUILD_GROUP_COUNTS) {
    const prev = totalFor(g - 1);
    const counted = range(prev + 1, totalFor(g)).map(num).join(', ');
    beats.push({
      id: `c1-gate${g}`,
      phase: 'animate',
      caption: g === 1 ? `Your turn! Tap “Pack crate ${num(g)}” to fill it.` : `Pack crate ${num(g)}.`,
      duration: 800,
      wait: 'gate',
      actionLabel: `Pack crate ${num(g)}`,
      scene: orchard({ apples: fives(g - 1), emptyCrate: g, totals: g - 1, arcs: 0, rules: 0, focus: { kind: 'crates', crates: [g] } }),
      timeline: g === 1 ? [] : [{ id: `crate-${g}`, at: 0, dur: 500 }],
    });
    beats.push({
      id: `c1-fill${g}`,
      phase: 'animate',
      caption:
        g === 1
          ? `Crate 1: ${counted} apples. Leo writes ${t(1)}.`
          : `Crate ${num(g)}: count on from ${num(prev)}: ${counted}. Leo writes ${t(g)}.`,
      duration: 4800,
      scene: orchard({ apples: fives(g), totals: g, arcs: 0, rules: 0, counter: g, focus: { kind: 'crates', crates: [g] } }),
      timeline: [...fill(g, 1, S), { id: `total-${g}`, at: 300 + S * 480 + 200, dur: 500 }],
    });
  }

  const four = BUILD_GROUP_COUNTS.length;
  beats.push({
    id: 'c1-wrap',
    phase: 'explain',
    caption: `Leo's board says ${runningTotals(four).map(num).join(', ')}. ${capitalizeWord(numberWord(four))} crates, and each one held the same ${num(S)} apples.`,
    duration: 6000,
    scene: orchard({ apples: fives(four), totals: four, arcs: 0, rules: 0, focus: { kind: 'totalsRow' } }),
  });

  return { id: 'build', title: 'Pack the Crates', short: 'Pack', goal: 'Build 1, 2, 3, and 4 equal groups of 5.', beats };
}

/* ------------------------------------------------------------------ */
/* Chapter 2 — Spot the Repeat                                         */
/* ------------------------------------------------------------------ */

function patternChapter(): Chapter {
  const four = BUILD_GROUP_COUNTS.length;
  const base = { apples: fives(four), totals: four, rules: 0 };
  const jumpBeats: Beat[] = range(1, four - 1).map((k) => ({
    id: `c2-jump${k}`,
    phase: 'animate',
    caption:
      k === 1
        ? `Look for what repeats. From ${t(1)} to ${t(2)}, the total jumps ${stepLabel()}.`
        : `From ${t(k)} to ${t(k + 1)}: ${stepLabel()} again${k === four - 1 ? '!' : '.'}`,
    duration: k === 1 ? 5000 : 3800,
    scene: orchard({ ...base, arcs: k, focus: { kind: 'cols', cols: [k, k + 1] } }),
    timeline: [{ id: `arc-${k}`, at: 400, dur: 900 }],
  }));

  return {
    id: 'pattern',
    title: 'Spot the Repeat',
    short: 'Repeat',
    goal: 'Notice the repeated +5 and predict the next total.',
    beats: [
      ...jumpBeats,
      {
        id: 'c2-why',
        phase: 'explain',
        caption: `The same step repeats: one more crate means ${num(S)} more apples, every time.`,
        duration: 6000,
        scene: orchard({ ...base, arcs: four - 1, focus: { kind: 'crates', crates: range(1, four) } }),
      },
      {
        id: 'c2-predict',
        phase: 'try',
        caption: `Predict: Leo will pack crate ${num(PREDICT_GROUPS)}. What will the total be?`,
        duration: 1200,
        wait: 'question',
        question: {
          id: 'predict-5',
          kind: 'number',
          prompt: `Leo will pack crate ${num(PREDICT_GROUPS)}. What will the total be?`,
          groups: PREDICT_GROUPS,
          context: ORCHARD,
        },
        scene: orchard({ ...base, arcs: four - 1, emptyCrate: PREDICT_GROUPS, pending: [PREDICT_GROUPS], focus: { kind: 'cols', cols: [PREDICT_GROUPS] } }),
        timeline: [
          { id: `crate-${PREDICT_GROUPS}`, at: 0, dur: 500 },
          { id: `pending-${PREDICT_GROUPS}`, at: 300, dur: 400 },
        ],
      },
      {
        id: 'c2-held',
        phase: 'explain',
        caption: `You predicted ${t(PREDICT_GROUPS)} by adding ${num(S)} to ${t(four)}. But is a pattern enough? Next, let's find out why adding ${num(S)} always works.`,
        duration: 6500,
        scene: orchard({ ...base, arcs: four - 1, emptyCrate: PREDICT_GROUPS, predicted: [PREDICT_GROUPS] }),
      },
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Chapter 3 — Why Times Five?                                         */
/* ------------------------------------------------------------------ */

function ruleChapter(): Chapter {
  const four = BUILD_GROUP_COUNTS.length;
  const base = { apples: fives(four), totals: four, arcs: four - 1, badges: true };
  const ruleBeats: Beat[] = range(1, four).map((g) => ({
    id: `c3-rule${g}`,
    phase: 'explain',
    caption:
      g === 1
        ? `1 crate is one group of ${num(S)}: ${equationLabel(1)}.`
        : `${num(g)} crates are ${numberWord(g)} ${num(S)}s: ${repeatedAdditionLabel(g)} = ${t(g)}, so ${multiplicationLabel(g)} = ${t(g)}.`,
    duration: g === 1 ? 4500 : 5200,
    scene: orchard({ ...base, rules: g, focus: { kind: 'crates', crates: range(1, g) } }),
    timeline: [{ id: `rule-${g}`, at: 500, dur: 500 }],
  }));

  return {
    id: 'rule',
    title: 'Why Times Five?',
    short: 'Rule',
    goal: 'Connect the pattern to 5 × the number of groups, and explain why.',
    beats: [
      {
        id: 'c3-inside',
        phase: 'explain',
        caption: `Why does ${stepLabel()} keep working? Look inside: every crate holds ${num(S)} apples.`,
        duration: 5500,
        scene: orchard({ ...base, rules: 0, focus: { kind: 'crates', crates: range(1, four) } }),
        timeline: range(1, four).map((g, k) => ({ id: `badge-${g}`, at: 400 + k * 350, dur: 400 })),
      },
      ...ruleBeats,
      {
        id: 'c3-rule',
        phase: 'explain',
        caption: `Here's the rule: ${ruleSentence()}. The number of crates tells how many ${num(S)}s to add.`,
        duration: 6000,
        scene: orchard({ ...base, rules: four, banner: true, focus: { kind: 'banner' } }),
        timeline: [{ id: 'banner', at: 300, dur: 600 }],
      },
      {
        id: 'c3-reason',
        phase: 'explain',
        caption: `A few examples can't prove a pattern by themselves. The reason is the equal groups: each new crate adds the same ${num(S)} apples.`,
        duration: 7000,
        scene: orchard({ ...base, rules: four, banner: true, focus: { kind: 'crates', crates: range(1, four) } }),
      },
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Chapter 4 — Check Pip's Guess                                       */
/* ------------------------------------------------------------------ */

function checkChapter(): Chapter {
  const four = BUILD_GROUP_COUNTS.length;
  const five = PREDICT_GROUPS;
  const six = MONITOR_GROUPS;
  const f = proposalFacts();
  const guess = num(PROPOSED_TERM.total);
  const before = { apples: fives(four), totals: four, arcs: four - 1, rules: four };

  return {
    id: 'check',
    title: "Check Pip's Guess",
    short: 'Check',
    goal: 'Check a wrong next term with the model, then keep checking results.',
    beats: [
      {
        id: 'c4-pip',
        phase: 'predict',
        caption: `Pip the parrot flies in with a guess: “${num(five)} crates make ${guess} apples!”`,
        duration: 6000,
        scene: orchard({ ...before, emptyCrate: five, guess: 'shown', pip: 'guess' }),
        timeline: [
          { id: 'pip', at: 0, dur: 900 },
          { id: 'bubble', at: 900, dur: 400 },
          { id: 'guess', at: 1500, dur: 500 },
        ],
      },
      {
        id: 'c4-check',
        phase: 'try',
        caption: `Check Pip's guess before Leo packs crate ${num(five)}. Is ${guess} right?`,
        duration: 1200,
        wait: 'question',
        question: {
          id: 'check-pip',
          kind: 'choice',
          prompt: `Is Pip's guess of ${guess} apples for ${num(five)} crates right? Pick the best answer.`,
          options: proposalOptions().map(({ id, text }) => ({ id, text })),
        },
        scene: orchard({ ...before, emptyCrate: five, guess: 'shown', pip: 'guess', focus: { kind: 'cols', cols: [five] } }),
      },
      {
        id: 'c4-gate5',
        phase: 'animate',
        caption: `Now test Pip's guess with real apples. Pack crate ${num(five)}.`,
        duration: 800,
        wait: 'gate',
        actionLabel: `Pack crate ${num(five)}`,
        scene: orchard({ ...before, emptyCrate: five, guess: 'shown', pip: 'guess', focus: { kind: 'crates', crates: [five] } }),
      },
      {
        id: 'c4-count',
        phase: 'animate',
        caption: `Count on from ${t(four)}: ${range(f.prev + 1, f.proposed).map(num).join(', ')}. Stop at ${guess}? One spot is still empty!`,
        duration: 6000,
        scene: orchard({ ...before, apples: [...fives(four), f.step], guess: 'shown', pip: 'guess', counter: five, focus: { kind: 'slot', crate: five, slot: S } }),
        timeline: [...fill(five, 1, f.step), { id: 'focus', at: 300 + f.step * 480 + 200, dur: 500 }],
      },
      {
        id: 'c4-fix',
        phase: 'animate',
        caption: `The last apple fills the spot: ${t(five)}. Pip's ${guess} was ${num(totalFor(five) - PROPOSED_TERM.total)} apple short.`,
        duration: 6000,
        scene: orchard({ ...before, apples: fives(five), totals: five, arcs: four, guess: 'crossed', pip: 'guess', counter: five, focus: { kind: 'cols', cols: [five] } }),
        timeline: [
          ...fill(five, S, S, 200),
          { id: 'cross', at: 900, dur: 500 },
          { id: `total-${five}`, at: 1500, dur: 500 },
          { id: `arc-${four}`, at: 2200, dur: 900 },
          { id: 'focus', at: 1500, dur: 400 },
        ],
      },
      {
        id: 'c4-agree',
        phase: 'explain',
        caption: `Two ways agree: ${t(four)} + ${num(S)} = ${t(five)}, and ${equationLabel(five)}.`,
        duration: 6000,
        scene: orchard({ ...before, apples: fives(five), totals: five, arcs: four, rules: five, guess: 'crossed', pip: 'oops', focus: { kind: 'cols', cols: [five] } }),
        timeline: [
          { id: `rule-${five}`, at: 400, dur: 500 },
          { id: 'bubble', at: 900, dur: 400 },
        ],
      },
      {
        id: 'c4-monitor',
        phase: 'try',
        caption: `Keep checking as you go. What will the total be after ${num(six)} crates?`,
        duration: 1200,
        wait: 'question',
        question: {
          id: 'monitor-6',
          kind: 'number',
          prompt: `Leo packs crate ${num(six)}. What will the total be after ${num(six)} crates?`,
          groups: six,
          context: ORCHARD,
        },
        scene: orchard({ ...before, apples: fives(five), totals: five, arcs: four, rules: five, guess: 'crossed', emptyCrate: six, pending: [six], focus: { kind: 'cols', cols: [six] } }),
        timeline: [
          { id: `crate-${six}`, at: 0, dur: 500 },
          { id: `pending-${six}`, at: 300, dur: 400 },
        ],
      },
      {
        id: 'c4-fill6',
        phase: 'animate',
        caption: `Crate ${num(six)}: ${range(totalFor(five) + 1, totalFor(six)).map(num).join(', ')}. Yes! ${t(five)} + ${num(S)} = ${t(six)}, and ${equationLabel(six)}.`,
        duration: 6500,
        scene: orchard({ ...before, apples: fives(six), totals: six, arcs: five, rules: six, guess: 'crossed', counter: six, focus: { kind: 'crates', crates: [six] } }),
        timeline: [
          ...fill(six, 1, S),
          { id: `total-${six}`, at: 300 + S * 480 + 200, dur: 500 },
          { id: `arc-${five}`, at: 300 + S * 480 + 500, dur: 800 },
          { id: `rule-${six}`, at: 300 + S * 480 + 900, dur: 500 },
        ],
      },
      {
        id: 'c4-reason',
        phase: 'explain',
        caption: `Every total is made of full ${num(S)}s, so it ends in 0 or ${num(S)}. That quick check catches a guess like ${guess}.`,
        duration: 7000,
        scene: orchard({ ...before, apples: fives(six), totals: six, arcs: five, rules: six, guess: 'crossed', focus: { kind: 'totalsRow' } }),
      },
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Chapter 5 — Your Turn (fresh transfer)                              */
/* ------------------------------------------------------------------ */

function transferChapter(): Chapter {
  const n = TRANSFER_GROUPS;
  const T = (g: number) => num(totalFor(g, STICKERS));
  const sheetsIn: TimelineEntry[] = range(1, n).map((k) => ({ id: `sheet-${k}`, at: 300 + (k - 1) * 380, dur: 450 }));
  const runsIn: TimelineEntry[] = range(1, n).flatMap((k) => [
    { id: `run-${k}`, at: 300 + (k - 1) * 650, dur: 400 },
    ...(k > 1 ? [{ id: `sarc-${k - 1}`, at: 300 + (k - 1) * 650 - 250, dur: 350 }] : []),
  ]);
  return {
    id: 'transfer',
    title: 'Your Turn',
    short: 'Try it',
    goal: 'Use the rule on a fresh problem and check that the answer is reasonable.',
    beats: [
      {
        id: 'c5-meet',
        phase: 'predict',
        caption: `Grandma June gives Leo sticker sheets. Each sheet has ${num(STICKERS.groupSize)} stars. Leo has ${num(n)} sheets.`,
        duration: 6500,
        scene: { kind: 'stickers', sheets: n, runs: 0, arcs: 0, ruleLine: false, focus: { kind: 'sheets' } },
        timeline: [...sheetsIn, { id: 'focus', at: 300 + n * 380, dur: 400 }],
      },
      {
        id: 'c5-ask',
        phase: 'try',
        caption: `How many stars are on ${num(n)} sheets? Use the repeat or the rule.`,
        duration: 1000,
        wait: 'question',
        question: {
          id: 'transfer-7',
          kind: 'number',
          prompt: `Leo has ${num(n)} sheets with ${num(STICKERS.groupSize)} stars on each. How many stars in all?`,
          groups: n,
          context: STICKERS,
        },
        scene: { kind: 'stickers', sheets: n, runs: 0, arcs: 0, ruleLine: false, focus: { kind: 'sheets' } },
      },
      {
        id: 'c5-count',
        phase: 'animate',
        caption: `Count by ${num(STICKERS.groupSize)}s, one sheet at a time: ${runningTotals(n, STICKERS).map(num).join(', ')}.`,
        duration: 6500,
        scene: { kind: 'stickers', sheets: n, runs: n, arcs: n - 1, ruleLine: false, focus: { kind: 'runs' } },
        timeline: runsIn,
      },
      {
        id: 'c5-rule',
        phase: 'explain',
        caption: `Rule check: ${equationLabel(n, STICKERS.groupSize)}. It ends in ${num(totalFor(n, STICKERS) % 10)}, and it is ${num(STICKERS.groupSize)} more than ${T(n - 1)}. Reasonable!`,
        duration: 6500,
        scene: { kind: 'stickers', sheets: n, runs: n, arcs: n - 1, ruleLine: true },
        timeline: [{ id: 'ruleline', at: 300, dur: 600 }],
      },
      {
        id: 'c5-finale',
        phase: 'explain',
        caption: `You noticed the repeat (${stepLabel()}), explained why (equal groups of ${num(S)}), and used the rule (groups × ${num(S)}). Great reasoning!`,
        duration: 7000,
        scene: { kind: 'stickers', sheets: n, runs: n, arcs: n - 1, ruleLine: true, finale: true },
        timeline: [{ id: 'finale', at: 200, dur: 900 }],
      },
    ],
  };
}

/* ------------------------------------------------------------------ */

function numberWord(n: number): string {
  return ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'][n] ?? num(n);
}

function capitalizeWord(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const CHAPTERS: Chapter[] = [buildChapter(), patternChapter(), ruleChapter(), checkChapter(), transferChapter()];

export const ALL_BEATS: { chapter: number; beat: number; data: Beat }[] = CHAPTERS.flatMap((c, ci) =>
  c.beats.map((b, bi) => ({ chapter: ci, beat: bi, data: b })),
);

/** Total playback time with no learner pauses (gates and questions count only their intro time). */
export function totalPlaybackMs(): number {
  return ALL_BEATS.reduce((sum, b) => sum + b.data.duration, 0);
}

/** The correct answer for a question, as the learner would type it (for tests and leak checks). */
export function answerFor(q: Question): string {
  if (q.kind === 'number') return num(totalFor(q.groups, q.context));
  return proposalOptions().find((o) => claimHolds(o.claim))!.id;
}
