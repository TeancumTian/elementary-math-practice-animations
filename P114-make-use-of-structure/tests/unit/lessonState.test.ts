import { describe, expect, it } from "vitest";
import { QUESTIONS, type QuestionId } from "@/lib/model";
import { BONUS_INDEX, WRAP_INDEX } from "@/lib/lesson";
import {
  NEXT_DEBOUNCE_MS,
  canAdvance,
  chaptersFor,
  currentStep,
  initialLessonState,
  isUnlocked,
  lessonReducer,
  sceneFinished,
  type LessonAction,
  type LessonState,
} from "@/lib/lessonState";
import { sceneDuration } from "@/lib/timeline";

const CORRECT: Record<QuestionId, string> = {
  "predict-ten": "b",
  "predict-total": "80",
  "explain-same": "c",
  "explain-structure": "a",
  "transfer-total": "60",
  "array-total": "12",
  "array-same": "b",
  "array-structure": "c",
};

let clock = 0;
const later = (ms = NEXT_DEBOUNCE_MS + 1) => (clock += ms);

function run(state: LessonState, ...actions: LessonAction[]): LessonState {
  return actions.reduce(lessonReducer, state);
}

function started(): LessonState {
  clock = 0;
  return run(initialLessonState, { type: "start", now: later() });
}

/** Answer the current question correctly (if any) and press Next. */
function step(state: LessonState): LessonState {
  const s = currentStep(state);
  let st = state;
  if (s.kind === "question") st = run(st, { type: "submit", questionId: s.questionId, response: CORRECT[s.questionId] });
  return run(st, { type: "next", now: later() });
}

function stepId(state: LessonState): string {
  return currentStep(state).id;
}

describe("start, play, pause, replay", () => {
  it("does nothing until Start", () => {
    const s = run(initialLessonState, { type: "next", now: 5000 }, { type: "tick", dt: 500 }, { type: "togglePause" });
    expect(s).toEqual(initialLessonState);
  });

  it("start plays the first scene; ticks advance time and stop at the end", () => {
    let s = started();
    expect(s).toMatchObject({ started: true, chapter: 0, step: 0, playing: true, elapsed: 0 });
    s = run(s, { type: "tick", dt: 1000 });
    expect(s.elapsed).toBe(1000);
    const scene = currentStep(s);
    if (scene.kind !== "scene") throw new Error("expected a scene");
    const total = sceneDuration(scene.beats);
    s = run(s, { type: "tick", dt: total * 2 });
    expect(s.elapsed).toBe(total);
    expect(s.playing).toBe(false);
    expect(sceneFinished(s)).toBe(true);
  });

  it("pause freezes the clock and resume continues from the same place", () => {
    let s = run(started(), { type: "tick", dt: 700 }, { type: "togglePause" });
    expect(s.playing).toBe(false);
    s = run(s, { type: "tick", dt: 5000 });
    expect(s.elapsed).toBe(700);
    s = run(s, { type: "togglePause" }, { type: "tick", dt: 300 });
    expect(s).toMatchObject({ playing: true, elapsed: 1000 });
  });

  it("replay restarts the current scene", () => {
    const s = run(started(), { type: "tick", dt: 4000 }, { type: "togglePause" }, { type: "replay", now: later() });
    expect(s).toMatchObject({ chapter: 0, step: 0, elapsed: 0, playing: true });
  });

  it("replay on a question goes back to the start of that chapter and keeps answers", () => {
    let s = step(started()); // at predict-ten
    s = run(s, { type: "submit", questionId: "predict-ten", response: "b" });
    s = run(s, { type: "next", now: later() }, { type: "replay", now: later() });
    expect(stepId(s)).toBe("q-predict-ten");
    expect(s.answers["predict-ten"]?.status).toBe("correct");
  });
});

describe("learner-controlled navigation", () => {
  it("waits at questions: Next is refused until the answer is correct or shown", () => {
    let s = step(started());
    expect(stepId(s)).toBe("q-predict-ten");
    expect(canAdvance(s)).toBe(false);
    s = run(s, { type: "next", now: later() });
    expect(stepId(s)).toBe("q-predict-ten");
    s = run(s, { type: "submit", questionId: "predict-ten", response: "a" });
    expect(canAdvance(s)).toBe(false);
    s = run(s, { type: "submit", questionId: "predict-ten", response: "b" }, { type: "next", now: later() });
    expect(stepId(s)).toBe("q-predict-total");
  });

  it("ignores a second Next that arrives too quickly (double-click, key repeat)", () => {
    const s = started();
    const t = later();
    const after = run(s, { type: "next", now: t }, { type: "next", now: t + 30 });
    expect(stepId(after)).toBe("q-predict-ten");
    expect(after.navId).toBe(s.navId + 1);
  });

  it("key mashing cannot skip past an unanswered question", () => {
    let s = started();
    for (let i = 0; i < 200; i++) s = run(s, { type: "next", now: later(37) });
    expect(stepId(s)).toBe("q-predict-ten");
  });

  it("locks chapters beyond the furthest one reached; goto works mid-animation", () => {
    let s = started();
    expect(isUnlocked(s, 1)).toBe(false);
    s = run(s, { type: "goto", chapter: 3, now: later() });
    expect(s.chapter).toBe(0);
    s = step(step(step(s))); // meet → predict-ten → predict-total → snap scene
    expect(stepId(s)).toBe("snap-scene");
    s = run(s, { type: "tick", dt: 2500 });
    expect(s.playing).toBe(true);
    s = run(s, { type: "goto", chapter: 0, now: later() });
    expect(s).toMatchObject({ chapter: 0, step: 0, elapsed: 0, playing: true });
    s = run(s, { type: "goto", chapter: 2, now: later() });
    expect(s).toMatchObject({ chapter: 2, step: 0, elapsed: 0, playing: true });
  });

  it("walks the full lesson with the bonus and ends at the wrap-up", () => {
    let s = started();
    const seen: string[] = [stepId(s)];
    for (let i = 0; i < 40 && s.chapter !== WRAP_INDEX; i++) {
      s = step(s);
      seen.push(stepId(s));
    }
    expect(seen).toEqual([
      "meet-scene",
      "q-predict-ten",
      "q-predict-total",
      "snap-scene",
      "q-explain-same",
      "q-explain-structure",
      "try-intro",
      "q-transfer-total",
      "try-check",
      "bonus-intro",
      "q-array-total",
      "bonus-regroup",
      "q-array-same",
      "q-array-structure",
      "wrap-scene",
    ]);
    expect(s.chapter).toBe(WRAP_INDEX);
    expect(canAdvance(s)).toBe(false);
    // The wrap-up recap now includes the robot parade.
    const wrap = chaptersFor(s)[WRAP_INDEX].steps[0];
    expect(wrap.kind === "scene" && wrap.beats[1].visual).toBe("array");
  });

  it("can skip the optional bonus", () => {
    let s = started();
    while (s.chapter < BONUS_INDEX) s = step(s);
    s = run(s, { type: "skipBonus", now: later() });
    expect(s.chapter).toBe(WRAP_INDEX);
    expect(isUnlocked(s, BONUS_INDEX)).toBe(true);
    const wrap = chaptersFor(s)[WRAP_INDEX].steps[0];
    expect(wrap.kind === "scene" && wrap.beats[1].visual).toBe("main");
  });

  it("reset returns to the cover with every answer cleared", () => {
    let s = step(step(started()));
    s = run(s, { type: "submit", questionId: "predict-total", response: "70" });
    s = run(s, { type: "reset" });
    expect({ ...s, navId: 0 }).toEqual(initialLessonState);
  });
});

describe("answer attempts and feedback", () => {
  const atTotal = () => step(step(started()));

  it("gives specific feedback and counts distinct attempts only", () => {
    let s = atTotal();
    s = run(s, { type: "submit", questionId: "predict-total", response: "70" });
    expect(s.answers["predict-total"]).toMatchObject({ status: "incorrect", attempts: 1 });
    expect(s.answers["predict-total"]?.feedback).toContain("Don't forget the new ten");
    // Same wrong answer again (double-click / Enter mashing): not a new attempt.
    s = run(s, { type: "submit", questionId: "predict-total", response: "70" }, { type: "submit", questionId: "predict-total", response: " 70 " });
    expect(s.answers["predict-total"]?.attempts).toBe(1);
    // Blank input is not graded.
    s = run(s, { type: "submit", questionId: "predict-total", response: "" });
    expect(s.answers["predict-total"]).toMatchObject({ attempts: 1, feedback: expect.stringContaining("Type a number") });
    s = run(s, { type: "submit", questionId: "predict-total", response: "710" });
    expect(s.answers["predict-total"]).toMatchObject({ attempts: 2, wrongResponses: ["70", "710"] });
  });

  it("offers Show me only after two wrong attempts", () => {
    let s = atTotal();
    s = run(s, { type: "submit", questionId: "predict-total", response: "70" }, { type: "showMe", questionId: "predict-total" });
    expect(s.answers["predict-total"]?.status).toBe("incorrect");
    s = run(s, { type: "submit", questionId: "predict-total", response: "90" }, { type: "showMe", questionId: "predict-total" });
    expect(s.answers["predict-total"]).toMatchObject({ status: "revealed", feedback: QUESTIONS["predict-total"].reveal });
    expect(canAdvance(s)).toBe(true);
  });

  it("locks the answer once correct", () => {
    let s = run(atTotal(), { type: "submit", questionId: "predict-total", response: "80" });
    s = run(s, { type: "submit", questionId: "predict-total", response: "70" });
    expect(s.answers["predict-total"]).toMatchObject({ status: "correct", attempts: 1 });
  });

  it("ignores submissions for a question that is not on screen", () => {
    const s = run(atTotal(), { type: "submit", questionId: "transfer-total", response: "60" });
    expect(s.answers["transfer-total"]).toBeUndefined();
  });

  it("hints can be opened once and don't count as attempts", () => {
    const s = run(atTotal(), { type: "hint", questionId: "predict-total" }, { type: "hint", questionId: "predict-total" });
    expect(s.answers["predict-total"]).toMatchObject({ hintShown: true, attempts: 0, status: "unanswered" });
  });
});
