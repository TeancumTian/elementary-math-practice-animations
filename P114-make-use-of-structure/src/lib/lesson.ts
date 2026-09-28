/**
 * lesson.ts — the story and teaching sequence (predict → animate → explain → try).
 * Every number in a caption is read from the math model; nothing is typed in by hand.
 */
import {
  CHARACTERS,
  MAIN,
  PARADE,
  TRANSFER,
  countByTens,
  placeValueLabel,
  plural,
  repeatedAddition,
  type QuestionId,
} from "./model";
import { DEFAULT_MOVE_MS, readingTimeMs, type Beat, type Overlay, type VisualId } from "./timeline";

export interface SceneStep {
  kind: "scene";
  id: string;
  beats: Beat[];
}

export interface QuestionStep {
  kind: "question";
  id: string;
  questionId: QuestionId;
  visual: VisualId;
  stage: string;
  overlay: Overlay;
}

export type Step = SceneStep | QuestionStep;

export type ChapterId = "meet" | "predict" | "snap" | "explain" | "try" | "bonus" | "wrap";

export interface Chapter {
  id: ChapterId;
  title: string;
  /** The teaching move this chapter makes. */
  phase: "Story" | "Predict" | "Watch" | "Explain" | "Try" | "Bonus" | "Wrap-up";
  grade: "Grade 2" | "Grade 3 bonus";
  optional: boolean;
  steps: Step[];
}

const A = CHARACTERS.a;
const B = CHARACTERS.b;

interface BeatInput {
  id: string;
  visual: VisualId;
  stage: string;
  from?: string;
  caption: string;
  overlay: Overlay;
  moveMs?: number;
  staggerMs?: number;
  minMs?: number;
}

function beat(input: BeatInput): Beat {
  const moveMs = input.moveMs ?? DEFAULT_MOVE_MS;
  return {
    id: input.id,
    visual: input.visual,
    stage: input.stage,
    from: input.from,
    caption: input.caption,
    durationMs: Math.max(readingTimeMs(input.caption), input.minMs ?? 0),
    moveMs,
    staggerMs: input.staggerMs ?? 0,
    overlay: input.overlay,
  };
}

const hidden: Overlay = { reveal: false };
const shown: Overlay = { reveal: true };

function tensCountCaption(tens: number): string {
  return `Count by tens: ${countByTens(tens).join(", ")}.`;
}

export interface LessonOptions {
  /** Changes one wrap-up caption so it never mentions bonus results the learner has not found yet. */
  bonusDone: boolean;
}

export function buildChapters({ bonusDone }: LessonOptions): Chapter[] {
  const m = MAIN;
  const t = TRANSFER;
  const p = PARADE;

  const meet: Chapter = {
    id: "meet",
    title: "Meet the Cubes",
    phase: "Story",
    grade: "Grade 2",
    optional: false,
    steps: [
      {
        kind: "scene",
        id: "meet-scene",
        beats: [
          beat({
            id: "meet-1",
            visual: "main",
            from: "scattered",
            stage: "apart",
            moveMs: 2200,
            caption: `${A} and ${B} love to build robots out of snap cubes. Ten cubes snap together to make one ten-stick.`,
            overlay: hidden,
          }),
          beat({
            id: "meet-2",
            visual: "main",
            stage: "apart",
            caption: `${A} has ${m.a} cubes: ${plural(m.pvA.tens, "ten-stick")} and ${plural(m.pvA.ones, "loose cube")}. That's ${placeValueLabel(m.a)}.`,
            overlay: { ...hidden, focus: "rowA" },
          }),
          beat({
            id: "meet-3",
            visual: "main",
            stage: "apart",
            caption: `${B} has ${m.b} cubes: ${plural(m.pvB.tens, "ten-stick")} and ${plural(m.pvB.ones, "loose cube")}. That's ${placeValueLabel(m.b)}.`,
            overlay: { ...hidden, focus: "rowB" },
          }),
          beat({
            id: "meet-4",
            visual: "main",
            stage: "apart",
            caption: "They want to build one giant robot together. How many cubes do they have in all?",
            overlay: hidden,
          }),
          beat({
            id: "meet-5",
            visual: "main",
            stage: "apart",
            caption: "Counting every cube one by one would take a long time! Let's look for structure: a smart way the cubes are organized.",
            overlay: { ...hidden, focus: "ones" },
          }),
        ],
      },
    ],
  };

  const predict: Chapter = {
    id: "predict",
    title: "Predict",
    phase: "Predict",
    grade: "Grade 2",
    optional: false,
    steps: [
      { kind: "question", id: "q-predict-ten", questionId: "predict-ten", visual: "main", stage: "apart", overlay: { ...hidden, focus: "ones" } },
      { kind: "question", id: "q-predict-total", questionId: "predict-total", visual: "main", stage: "apart", overlay: hidden },
    ],
  };

  const snap: Chapter = {
    id: "snap",
    title: "Snap a Ten",
    phase: "Watch",
    grade: "Grade 2",
    optional: false,
    steps: [
      {
        kind: "scene",
        id: "snap-scene",
        beats: [
          beat({ id: "snap-1", visual: "main", stage: "apart", caption: "Let's test your prediction. Look at the ones first.", overlay: { ...shown, focus: "ones" } }),
          beat({
            id: "snap-2",
            visual: "main",
            stage: "onesTogether",
            moveMs: 1500,
            caption: `Slide all the loose cubes into the Total row: ${m.pvA.ones} ones + ${m.pvB.ones} ones = ${m.onesSum} ones. The ten-frame is full!`,
            overlay: { ...shown, focus: "ones" },
          }),
          beat({
            id: "snap-3",
            visual: "main",
            stage: "snapTen",
            caption: `Snap! ${m.onesSum} ones make 1 ten. It's the same ${m.onesSum} cubes, just grouped as one ten-stick.`,
            overlay: { ...shown, focus: "newTen" },
          }),
          beat({
            id: "snap-4",
            visual: "main",
            stage: "tradeTen",
            moveMs: 1300,
            caption: `The new ten moves over to the tens place. There ${m.leftoverOnes === 1 ? "is" : "are"} ${plural(m.leftoverOnes, "loose one")} left.`,
            overlay: { ...shown, focus: "newTen" },
          }),
          beat({
            id: "snap-5",
            visual: "main",
            stage: "tensTogether",
            moveMs: 1500,
            caption: `Now the tens combine: ${m.pvA.tens} tens + ${m.pvB.tens} tens + 1 new ten = ${plural(m.pvSum.tens, "ten")}.`,
            overlay: { ...shown, focus: "tens", counts: "none" },
          }),
          beat({
            id: "snap-6",
            visual: "main",
            stage: "tensTogether",
            caption: tensCountCaption(m.pvSum.tens),
            minMs: 5200,
            overlay: { ...shown, counts: "progressive" },
          }),
          beat({
            id: "snap-7",
            visual: "main",
            stage: "tensTogether",
            caption: `${m.a} + ${m.b} = ${m.sum}. The ones made a new ten, so the tens combined to ${m.sum}. We never added or lost a single cube!`,
            overlay: { ...shown, counts: "all", equation: true },
          }),
        ],
      },
    ],
  };

  const explain: Chapter = {
    id: "explain",
    title: "Explain",
    phase: "Explain",
    grade: "Grade 2",
    optional: false,
    steps: [
      { kind: "question", id: "q-explain-same", questionId: "explain-same", visual: "main", stage: "snapTen", overlay: { ...shown, focus: "newTen" } },
      {
        kind: "question",
        id: "q-explain-structure",
        questionId: "explain-structure",
        visual: "main",
        stage: "tensTogether",
        overlay: { ...shown, counts: "all", equation: true },
      },
    ],
  };

  const tryIt: Chapter = {
    id: "try",
    title: "Your Turn",
    phase: "Try",
    grade: "Grade 2",
    optional: false,
    steps: [
      {
        kind: "scene",
        id: "try-intro",
        beats: [
          beat({
            id: "try-1",
            visual: "transfer",
            from: "scattered",
            stage: "apart",
            moveMs: 2000,
            caption: `The next day, ${A} has ${t.a} cubes and ${B} has ${t.b} cubes. Snap, snap! They sort them into tens and ones.`,
            overlay: hidden,
          }),
          beat({
            id: "try-2",
            visual: "transfer",
            stage: "apart",
            caption: "Your turn to use structure. Look at the ones before you add.",
            overlay: { ...hidden, focus: "ones" },
          }),
        ],
      },
      { kind: "question", id: "q-transfer-total", questionId: "transfer-total", visual: "transfer", stage: "apart", overlay: hidden },
      {
        kind: "scene",
        id: "try-check",
        beats: [
          beat({
            id: "try-3",
            visual: "transfer",
            from: "apart",
            stage: "onesTogether",
            moveMs: 1400,
            caption: `Let's check with cubes: ${t.pvA.ones} ones + ${t.pvB.ones} ones = ${t.onesSum} ones.`,
            overlay: { ...shown, focus: "ones" },
          }),
          beat({ id: "try-4", visual: "transfer", stage: "snapTen", caption: `Snap! ${t.onesSum} ones make 1 new ten.`, overlay: { ...shown, focus: "newTen" } }),
          beat({ id: "try-5", visual: "transfer", stage: "tradeTen", caption: "The new ten moves over to the tens place.", overlay: { ...shown, focus: "newTen" } }),
          beat({
            id: "try-6",
            visual: "transfer",
            stage: "tensTogether",
            moveMs: 1400,
            caption: `${t.pvA.tens} tens + ${t.pvB.tens} tens + 1 new ten = ${plural(t.pvSum.tens, "ten")}. ${tensCountCaption(t.pvSum.tens)}`,
            overlay: { ...shown, counts: "progressive" },
          }),
          beat({
            id: "try-7",
            visual: "transfer",
            stage: "tensTogether",
            caption: `${t.a} + ${t.b} = ${t.sum}. The same structure worked again!`,
            overlay: { ...shown, counts: "all", equation: true },
          }),
        ],
      },
    ],
  };

  const rowsSum = repeatedAddition(p.cols, p.rows);
  const colsSum = repeatedAddition(p.rows, p.cols);

  const bonus: Chapter = {
    id: "bonus",
    title: "Robot Parade",
    phase: "Bonus",
    grade: "Grade 3 bonus",
    optional: true,
    steps: [
      {
        kind: "scene",
        id: "bonus-intro",
        beats: [
          beat({
            id: "bonus-1",
            visual: "array",
            from: "offstage",
            stage: "array",
            moveMs: 1300,
            staggerMs: 90,
            caption: `Bonus for Grade 3! ${A} and ${B} built a team of little robots. Here comes the robot parade!`,
            overlay: hidden,
          }),
          beat({
            id: "bonus-2",
            visual: "array",
            stage: "array",
            caption: `The robots stand in an array. There are ${plural(p.rows, "equal row")}, and each row has ${p.cols} robots.`,
            overlay: { ...hidden, focus: "rows" },
          }),
          beat({
            id: "bonus-3",
            visual: "array",
            stage: "array",
            caption: `Look again. There are ${plural(p.cols, "equal column")}, and each column has ${p.rows} robots.`,
            overlay: { ...hidden, focus: "columns" },
          }),
        ],
      },
      { kind: "question", id: "q-array-total", questionId: "array-total", visual: "array", stage: "array", overlay: hidden },
      {
        kind: "scene",
        id: "bonus-regroup",
        beats: [
          beat({
            id: "bonus-4",
            visual: "array",
            from: "array",
            stage: "rows",
            caption: `Group the robots by rows: ${rowsSum} = ${p.total} robots.`,
            overlay: { ...shown, focus: "rows" },
          }),
          beat({
            id: "bonus-5",
            visual: "array",
            stage: "columns",
            moveMs: 1400,
            caption: `Now regroup the very same robots by columns: ${colsSum} = ${p.total} robots.`,
            overlay: { ...shown, focus: "columns" },
          }),
          beat({
            id: "bonus-6",
            visual: "array",
            stage: "columns",
            caption: `Rows or columns, it's still ${p.total} robots. ${plural(p.rows, "row")} of ${p.cols} is the same as ${plural(p.cols, "column")} of ${p.rows}: ${p.rows} × ${p.cols} = ${p.cols} × ${p.rows}.`,
            overlay: { ...shown, focus: "columns" },
          }),
        ],
      },
      { kind: "question", id: "q-array-same", questionId: "array-same", visual: "array", stage: "columns", overlay: { ...shown, focus: "columns" } },
      { kind: "question", id: "q-array-structure", questionId: "array-structure", visual: "array", stage: "rows", overlay: { ...shown, focus: "rows" } },
    ],
  };

  const wrap: Chapter = {
    id: "wrap",
    title: "Wrap-Up",
    phase: "Wrap-up",
    grade: "Grade 2",
    optional: false,
    steps: [
      {
        kind: "scene",
        id: "wrap-scene",
        beats: [
          beat({
            id: "wrap-1",
            visual: "main",
            stage: "tensTogether",
            caption: `You looked for structure and used it! ${m.pvA.ones} ones + ${m.pvB.ones} ones made a new ten, so ${m.a} + ${m.b} = ${m.sum}.`,
            overlay: { ...shown, counts: "all", equation: true },
          }),
          bonusDone
            ? beat({
                id: "wrap-2",
                visual: "array",
                stage: "columns",
                caption: `In the robot parade, equal rows and equal columns both showed ${p.total} robots.`,
                overlay: { ...shown, focus: "columns" },
              })
            : beat({
                id: "wrap-2",
                visual: "main",
                stage: "tensTogether",
                caption: "Want a challenge? The Grade 3 Robot Parade bonus is ready whenever you are.",
                overlay: { ...shown, counts: "all", focus: "tens" },
              }),
          beat({
            id: "wrap-3",
            visual: "main",
            stage: "tensTogether",
            caption: `When a problem looks big, ask: "How is it organized?" Groups of ten, equal rows, and equal columns can make it easier.`,
            overlay: { ...shown, counts: "all", equation: true },
          }),
        ],
      },
    ],
  };

  return [meet, predict, snap, explain, tryIt, bonus, wrap];
}

export const CHAPTER_IDS: ChapterId[] = ["meet", "predict", "snap", "explain", "try", "bonus", "wrap"];
export const BONUS_INDEX = CHAPTER_IDS.indexOf("bonus");
export const WRAP_INDEX = CHAPTER_IDS.indexOf("wrap");
export const BONUS_QUESTIONS: QuestionId[] = ["array-total", "array-same", "array-structure"];
