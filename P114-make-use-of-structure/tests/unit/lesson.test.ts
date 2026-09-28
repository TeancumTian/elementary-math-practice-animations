import { describe, expect, it } from "vitest";
import { ADDITION_STAGES, ARRAY_STAGES, MAIN, PARADE, QUESTIONS, TRANSFER, layoutAddition, layoutArray } from "@/lib/model";
import { BONUS_INDEX, buildChapters, type Chapter } from "@/lib/lesson";
import {
  beatFromStage,
  easeInOutCubic,
  locateBeat,
  moveProgress,
  progressiveCount,
  readingTimeMs,
  sceneDuration,
  type Beat,
  type Overlay,
  type VisualId,
} from "@/lib/timeline";

const hasNumber = (text: string, n: number) => new RegExp(`(?<!\\d)${n}(?!\\d)`).test(text);

function visualTexts(visual: VisualId, stage: string, overlay: Overlay): string[] {
  if (visual === "array") {
    const l = layoutArray(PARADE, stage as (typeof ARRAY_STAGES)[number], overlay.reveal);
    return [l.footer, l.description];
  }
  const l = layoutAddition(visual === "main" ? MAIN : TRANSFER, stage as (typeof ADDITION_STAGES)[number], overlay.reveal);
  return [
    l.footer,
    l.equation,
    l.description,
    ...l.rowLabels.map((r) => r.value),
    ...l.countLabels.map((c) => c.text),
    ...l.cells.flatMap((c) => (c.chip ? [c.chip.text] : [])),
  ];
}

const allBeats = (chapters: Chapter[]): Beat[] => chapters.flatMap((c) => c.steps.flatMap((s) => (s.kind === "scene" ? s.beats : [])));

describe("lesson structure", () => {
  const chapters = buildChapters({ bonusDone: true });

  it("follows predict → animate → explain → try, then an optional Grade 3 bonus", () => {
    expect(chapters.map((c) => c.phase)).toEqual(["Story", "Predict", "Watch", "Explain", "Try", "Bonus", "Wrap-up"]);
    expect(chapters[BONUS_INDEX]).toMatchObject({ id: "bonus", optional: true, grade: "Grade 3 bonus" });
    expect(chapters.filter((c) => c.optional)).toHaveLength(1);
  });

  it("uses every question exactly once", () => {
    const used = chapters.flatMap((c) => c.steps.flatMap((s) => (s.kind === "question" ? [s.questionId] : [])));
    expect([...used].sort()).toEqual(Object.keys(QUESTIONS).sort());
  });

  it("every beat names a real stage for its visual", () => {
    for (const b of allBeats(chapters)) {
      const stages: readonly string[] = b.visual === "array" ? ARRAY_STAGES : ADDITION_STAGES;
      expect(stages).toContain(b.stage);
      if (b.from) expect(stages).toContain(b.from);
    }
  });

  it("each beat leaves time to finish moving and to read the caption", () => {
    for (const b of allBeats(chapters)) {
      const lastStart = b.visual === "array" ? (PARADE.total - 1) * b.staggerMs : 0;
      expect(b.moveMs + lastStart).toBeLessThanOrEqual(b.durationMs - 1500);
      expect(b.durationMs).toBeGreaterThanOrEqual(readingTimeMs(b.caption));
    }
  });

  it("runs about 2-4 minutes without learner pauses, split into short chapters", () => {
    const full = sceneDuration(allBeats(chapters));
    const core = sceneDuration(allBeats(buildChapters({ bonusDone: false }).filter((c) => !c.optional)));
    expect(full).toBeGreaterThanOrEqual(120_000);
    expect(full).toBeLessThanOrEqual(240_000);
    expect(core).toBeGreaterThanOrEqual(100_000);
    for (const c of chapters) {
      const scenes = c.steps.flatMap((s) => (s.kind === "scene" ? [sceneDuration(s.beats)] : []));
      for (const d of scenes) expect(d).toBeLessThanOrEqual(60_000);
    }
  });

  it("captions state the verification facts using the model's numbers", () => {
    const captions = allBeats(chapters).map((b) => b.caption);
    expect(captions).toContain("48 + 32 = 80. The ones made a new ten, so the tens combined to 80. We never added or lost a single cube!");
    expect(captions.some((c) => c.includes("8 ones + 2 ones = 10 ones"))).toBe(true);
    expect(captions.some((c) => c.includes("Snap! 10 ones make 1 ten"))).toBe(true);
    expect(captions.some((c) => c.includes("4 + 4 + 4 = 12 robots"))).toBe(true);
    expect(captions.some((c) => c.includes("3 + 3 + 3 + 3 = 12 robots"))).toBe(true);
  });
});

describe("no answer leaks before submission", () => {
  for (const bonusDone of [false, true]) {
    const chapters = buildChapters({ bonusDone });
    for (const chapter of chapters) {
      chapter.steps.forEach((step, stepIndex) => {
        if (step.kind !== "question") return;
        const q = QUESTIONS[step.questionId];
        if (q.kind !== "number") return;
        it(`${step.questionId}: nothing on screen or earlier in its chapter shows ${q.answer} (bonusDone=${bonusDone})`, () => {
          // The picture shown while the question waits.
          expect(step.overlay.reveal).toBe(false);
          for (const t of visualTexts(step.visual, step.stage, step.overlay)) expect(hasNumber(t, q.answer)).toBe(false);
          for (const t of [q.prompt, q.equation, q.hint]) expect(hasNumber(t, q.answer)).toBe(false);
          // Scenes the learner can reach before answering (earlier steps in the same chapter).
          for (const prior of chapter.steps.slice(0, stepIndex)) {
            if (prior.kind !== "scene") continue;
            for (const b of prior.beats) {
              expect(b.overlay.reveal).toBe(false);
              expect(hasNumber(b.caption, q.answer)).toBe(false);
              for (const t of visualTexts(b.visual, b.stage, b.overlay)) expect(hasNumber(t, q.answer)).toBe(false);
            }
          }
        });
      });
    }
  }

  it("the chapters before the first total question never mention 80", () => {
    const chapters = buildChapters({ bonusDone: false });
    for (const b of allBeats(chapters.slice(0, 2))) {
      expect(hasNumber(b.caption, 80)).toBe(false);
      for (const t of visualTexts(b.visual, b.stage, b.overlay)) expect(hasNumber(t, 80)).toBe(false);
    }
  });

  it("the wrap-up doesn't mention the robot total if the bonus was skipped", () => {
    const wrap = buildChapters({ bonusDone: false }).at(-1)!;
    for (const b of allBeats([wrap])) {
      expect(b.visual).not.toBe("array");
      expect(hasNumber(b.caption, PARADE.total)).toBe(false);
    }
  });
});

describe("timeline helpers", () => {
  const beats = buildChapters({ bonusDone: true })[2].steps[0];
  if (beats.kind !== "scene") throw new Error("expected scene");

  it("locates beats by elapsed time and clamps at the ends", () => {
    expect(locateBeat(beats.beats, -50)).toMatchObject({ index: 0, beatElapsed: 0, finished: false });
    const first = beats.beats[0].durationMs;
    expect(locateBeat(beats.beats, first)).toMatchObject({ index: 1, beatElapsed: 0 });
    const total = sceneDuration(beats.beats);
    expect(locateBeat(beats.beats, total + 999)).toMatchObject({ index: beats.beats.length - 1, finished: true });
  });

  it("moves from the previous beat's stage", () => {
    expect(beatFromStage(beats.beats, 1)).toBe("apart");
    expect(beatFromStage(beats.beats, 2)).toBe("onesTogether");
  });

  it("reduced motion jumps straight to the end of each move", () => {
    expect(moveProgress(0, 1000, 0, true)).toBe(1);
    expect(moveProgress(0, 1000, 0, false)).toBe(0);
    expect(moveProgress(500, 1000, 0, false)).toBeCloseTo(0.5);
    expect(moveProgress(2000, 1000, 0, false)).toBe(1);
  });

  it("eases smoothly and counts by tens one label at a time", () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    expect(progressiveCount(0, 5000, 8)).toBe(1);
    expect(progressiveCount(4000, 5000, 8)).toBe(8);
    expect(progressiveCount(99999, 5000, 8)).toBe(8);
  });
});
