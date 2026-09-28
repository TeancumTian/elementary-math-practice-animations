"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore } from "react";
import { CHARACTERS, MAIN, PARADE, QUESTIONS, TRANSFER, type AdditionStage, type ArrayStage } from "@/lib/model";
import { BONUS_INDEX, WRAP_INDEX, type Chapter } from "@/lib/lesson";
import {
  EMPTY_ANSWER,
  bonusDone,
  canAdvance,
  chaptersFor,
  initialLessonState,
  isResolved,
  isUnlocked,
  lessonReducer,
  type AnswerStatus,
} from "@/lib/lessonState";
import { beatFromStage, locateBeat, sceneDuration, type Overlay, type VisualId } from "@/lib/timeline";
import { AdditionStageSvg } from "./AdditionStage";
import { ArrayStageSvg } from "./ArrayStage";
import { QuestionCard } from "./QuestionCard";
import { Icon } from "./Icon";

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReduced(cb: () => void) {
  const mq = window.matchMedia(REDUCED_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(REDUCED_QUERY).matches,
    () => false,
  );
}

const VISUAL_TITLES: Record<VisualId, string> = {
  main: `Place-value mat for ${MAIN.a} + ${MAIN.b}`,
  transfer: `Place-value mat for ${TRANSFER.a} + ${TRANSFER.b}`,
  array: "Robot parade array",
};

const CHARACTERS_LINE = `${CHARACTERS.a} and ${CHARACTERS.b} are building robots out of snap cubes.`;
const INTRO_CAPTION = `${CHARACTERS_LINE} Help them look for structure: a smart way things are organized. Press Start when you're ready.`;

interface View {
  visual: VisualId;
  from: string;
  to: string;
  overlay: Overlay;
  beatElapsed: number;
  moveMs: number;
  durationMs: number;
  staggerMs: number;
}

const COVER: View = {
  visual: "main",
  from: "scattered",
  to: "scattered",
  overlay: { reveal: false },
  beatElapsed: 0,
  moveMs: 0,
  durationMs: 1,
  staggerMs: 0,
};

function StageView({ view, reducedMotion }: { view: View; reducedMotion: boolean }) {
  if (view.visual === "array") {
    return (
      <ArrayStageSvg
        model={PARADE}
        from={view.from as ArrayStage}
        to={view.to as ArrayStage}
        overlay={view.overlay}
        beatElapsed={view.beatElapsed}
        moveMs={view.moveMs}
        staggerMs={view.staggerMs}
        reducedMotion={reducedMotion}
        title={VISUAL_TITLES.array}
      />
    );
  }
  return (
    <AdditionStageSvg
      model={view.visual === "main" ? MAIN : TRANSFER}
      from={view.from as AdditionStage}
      to={view.to as AdditionStage}
      overlay={view.overlay}
      beatElapsed={view.beatElapsed}
      moveMs={view.moveMs}
      durationMs={view.durationMs}
      reducedMotion={reducedMotion}
      title={VISUAL_TITLES[view.visual]}
    />
  );
}

function ChapterNav({
  chapters,
  current,
  started,
  unlocked,
  done,
  onGo,
}: {
  chapters: Chapter[];
  current: number;
  started: boolean;
  unlocked: (i: number) => boolean;
  done: (i: number) => boolean;
  onGo: (i: number) => void;
}) {
  const listRef = useRef<HTMLOListElement>(null);
  // Keep the current chapter visible in the horizontally scrolling list (without scrolling the page).
  useEffect(() => {
    const list = listRef.current;
    const btn = list?.querySelector<HTMLElement>("[aria-current='step']");
    if (!list || !btn) return;
    const l = list.getBoundingClientRect();
    const b = btn.getBoundingClientRect();
    if (b.left < l.left || b.right > l.right) list.scrollLeft += b.left - l.left - (l.width - b.width) / 2;
  }, [current, started]);
  return (
    <nav className="chapters" aria-label="Chapters">
      <ol ref={listRef}>
        {chapters.map((c, i) => {
          const locked = !started || !unlocked(i);
          const isCurrent = started && i === current;
          const isDone = started && done(i) && !isCurrent;
          return (
            <li key={c.id}>
              <button
                type="button"
                className={`chapter ${isCurrent ? "current" : ""} ${isDone ? "done" : ""}`}
                disabled={locked}
                aria-current={isCurrent ? "step" : undefined}
                onClick={() => onGo(i)}
                data-testid={`chapter-${c.id}`}
              >
                <span className="chapter-num" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="chapter-title">
                  {c.title}
                  {c.optional && <span className="chapter-optional"> · Grade 3</span>}
                </span>
                {locked && <Icon name="lock" size={14} />}
                {isDone && <Icon name="check" size={14} />}
                <span className="sr-only">{locked ? " (locked)" : isDone ? " (done)" : isCurrent ? " (current)" : ""}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default function LessonApp() {
  const [state, dispatch] = useReducer(lessonReducer, initialLessonState);
  const [captionsOn, setCaptionsOn] = useState(true);
  const [motionOverride, setMotionOverride] = useState<boolean | null>(null);
  const [narrate, setNarrate] = useState(false);
  const [speed, setSpeed] = useState(1);
  const systemReduced = usePrefersReducedMotion();
  const reducedMotion = motionOverride ?? systemReduced;

  const nextRef = useRef<HTMLButtonElement>(null);
  const startRef = useRef<HTMLButtonElement>(null);
  const finishRef = useRef<HTMLDivElement>(null);

  const isBonusDone = bonusDone(state);
  const chapters = useMemo(() => chaptersFor(state), [isBonusDone]); // eslint-disable-line react-hooks/exhaustive-deps
  const chapter = chapters[state.chapter];
  const step = chapter.steps[state.step];

  // --- Playback clock (one requestAnimationFrame loop, driven by reducer state) -------------
  const sceneLive = state.started && step.kind === "scene" && state.playing;
  useEffect(() => {
    if (!sceneLive) return;
    let raf = 0;
    let last: number | null = null;
    const frame = (now: number) => {
      if (last !== null) dispatch({ type: "tick", dt: Math.min(now - last, 250) * speed });
      last = now;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [sceneLive, speed, state.navId]);

  // Optional ?speed=N (1-20) for previews and automated tests.
  useEffect(() => {
    const s = Number(new URLSearchParams(window.location.search).get("speed"));
    if (Number.isFinite(s) && s >= 1 && s <= 20) setSpeed(s);
  }, []);

  // --- Derived view -------------------------------------------------------------------------
  let view: View = COVER;
  let caption = INTRO_CAPTION;
  let beatIndex = -1;
  let finished = false;
  if (state.started && step.kind === "scene") {
    const loc = locateBeat(step.beats, state.elapsed);
    const beat = step.beats[loc.index];
    beatIndex = loc.index;
    finished = state.elapsed >= sceneDuration(step.beats);
    caption = beat.caption;
    view = {
      visual: beat.visual,
      from: beatFromStage(step.beats, loc.index),
      to: beat.stage,
      overlay: beat.overlay,
      beatElapsed: loc.beatElapsed,
      moveMs: beat.moveMs,
      durationMs: beat.durationMs,
      staggerMs: beat.staggerMs,
    };
  } else if (state.started && step.kind === "question") {
    caption = QUESTIONS[step.questionId].prompt;
    view = { visual: step.visual, from: step.stage, to: step.stage, overlay: step.overlay, beatElapsed: 0, moveMs: 0, durationMs: 1, staggerMs: 0 };
  }

  const advance = canAdvance(state);
  const questionStep = state.started && step.kind === "question" ? step : null;
  const answer = questionStep ? (state.answers[questionStep.questionId] ?? EMPTY_ANSWER) : null;
  const atEnd = state.started && state.chapter === WRAP_INDEX && finished;

  // --- Actions ------------------------------------------------------------------------------
  const now = () => performance.now();
  const start = useCallback(() => dispatch({ type: "start", now: performance.now() }), []);
  const next = useCallback(() => dispatch({ type: "next", now: performance.now() }), []);
  const togglePause = useCallback(() => dispatch({ type: "togglePause" }), []);
  const replay = useCallback(() => dispatch({ type: "replay", now: performance.now() }), []);
  const reset = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    dispatch({ type: "reset" });
  }, []);

  // --- Keyboard shortcuts (ignored while typing or choosing an answer) ---------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      const k = e.key.toLowerCase();
      if (k === "p") togglePause();
      else if (k === "r") replay();
      else if (k === "n") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePause, replay, next]);

  // --- Focus management ---------------------------------------------------------------------
  useEffect(() => {
    if (!state.started) {
      if (state.navId > 0) startRef.current?.focus();
      return;
    }
    if (step.kind === "question") {
      const legend = document.getElementById("q-legend");
      legend?.focus({ preventScroll: true });
      legend?.scrollIntoView({ block: "nearest" });
    } else if (!document.activeElement || document.activeElement === document.body) {
      nextRef.current?.focus();
    }
  }, [state.navId]); // eslint-disable-line react-hooks/exhaustive-deps

  // When an answer becomes correct (or shown), move focus to Next.
  const lastStatus = useRef<{ q: string; status: AnswerStatus } | null>(null);
  useEffect(() => {
    if (!questionStep || !answer) {
      lastStatus.current = null;
      return;
    }
    const prev = lastStatus.current;
    const wasOpen = prev && prev.q === questionStep.questionId && prev.status !== "correct" && prev.status !== "revealed";
    if (wasOpen && isResolved(answer)) nextRef.current?.focus();
    lastStatus.current = { q: questionStep.questionId, status: answer.status };
  });

  // On phones the playback bar is sticky; make sure the celebration isn't hidden under it.
  useEffect(() => {
    if (atEnd) finishRef.current?.scrollIntoView({ block: "nearest" });
  }, [atEnd]);

  // --- Optional narration with the browser's built-in speech (off by default) --------------
  const spoken = state.started ? `${state.navId}:${beatIndex}` : "intro";
  useEffect(() => {
    if (!narrate || !("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    if (!state.started || (step.kind === "scene" && !state.playing)) return;
    const u = new SpeechSynthesisUtterance(caption);
    u.lang = "en-US";
    u.rate = 0.95;
    synth.speak(u);
  }, [narrate, spoken, state.playing]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  const phase = state.started ? chapter.phase : "Story";
  const title = state.started ? chapter.title : "Juno and Remy's Snap-Cube Robots";
  const grade = state.started ? chapter.grade : "Grade 2";

  return (
    <div
      className="app"
      data-testid="lesson"
      data-started={state.started ? "true" : "false"}
      data-chapter={state.started ? chapter.id : "cover"}
      data-step={state.started ? step.id : "cover"}
      data-step-kind={state.started ? step.kind : "cover"}
      data-beat={beatIndex}
      data-playing={sceneLive ? "true" : "false"}
      data-finished={finished ? "true" : "false"}
      data-motion={reducedMotion ? "reduced" : "full"}
    >
      <a className="skip-link" href="#panel">
        Skip to lesson controls
      </a>
      <header className="topbar">
        <div className="brand">
          <svg className="brand-mark" viewBox="0 0 40 40" aria-hidden="true">
            <rect x="4" y="6" width="32" height="7" rx="2" className="brand-stick" />
            <rect x="4" y="16" width="32" height="7" rx="2" className="brand-stick" />
            <rect x="4" y="27" width="7" height="7" rx="1.5" className="brand-one" />
            <rect x="14" y="27" width="7" height="7" rx="1.5" className="brand-one" />
          </svg>
          <div>
            <h1>Look for Structure!</h1>
            <p className="subtitle">Math Practice 7 · Grade 2 · Grade 3 bonus</p>
          </div>
        </div>
        <div className="settings" role="group" aria-label="Settings">
          <button type="button" className="toggle" aria-pressed={captionsOn} onClick={() => setCaptionsOn((v) => !v)} data-testid="toggle-captions">
            <Icon name="captions" /> Captions
          </button>
          <button
            type="button"
            className="toggle"
            aria-pressed={reducedMotion}
            onClick={() => setMotionOverride(!reducedMotion)}
            data-testid="toggle-motion"
          >
            <Icon name="motion" /> Reduce motion
          </button>
          <button type="button" className="toggle" aria-pressed={narrate} onClick={() => setNarrate((v) => !v)} data-testid="toggle-narration">
            <Icon name="speaker" /> Read aloud
          </button>
          <button type="button" className="toggle toggle-reset" onClick={reset} data-testid="reset">
            <Icon name="restart" /> Start over
          </button>
        </div>
      </header>

      <ChapterNav
        chapters={chapters}
        current={state.chapter}
        started={state.started}
        unlocked={(i) => isUnlocked(state, i)}
        done={(i) => i < state.furthest}
        onGo={(i) => dispatch({ type: "goto", chapter: i, now: now() })}
      />

      <main className="lesson">
        <section className="stage-card" aria-label="Animation">
          <div className="stage-head">
            <span className={`phase phase-${phase.toLowerCase().replace(/[^a-z]/g, "")}`}>{phase}</span>
            <h2>{title}</h2>
            <span className={`grade ${grade !== "Grade 2" ? "grade-3" : ""}`}>{grade}</span>
          </div>
          <div className="stage">
            <StageView view={view} reducedMotion={reducedMotion} />
          </div>
          {state.started && step.kind === "scene" && (
            <div className="beats" aria-hidden="true">
              {step.beats.map((b, i) => (
                <span key={b.id} className={`beat-dot ${i < beatIndex || finished ? "past" : ""} ${i === beatIndex && !finished ? "now" : ""}`} />
              ))}
            </div>
          )}
        </section>

        <section className="panel" id="panel" aria-label="Lesson">
          {!state.started && (
            <div className="intro">
              <p className="intro-lead">
                {CHARACTERS_LINE} Help them look for <strong>structure</strong>: a smart way things are organized.
              </p>
              <ol className="intro-steps" aria-label="How it works">
                <li>
                  <strong>Predict</strong> what will happen
                </li>
                <li>
                  <strong>Watch</strong> the cubes move
                </li>
                <li>
                  <strong>Explain</strong> why it works
                </li>
                <li>
                  <strong>Try</strong> a new problem
                </li>
              </ol>
              <button ref={startRef} type="button" className="btn btn-start" onClick={start} data-testid="start">
                <Icon name="play" size={24} /> Start the story
              </button>
              <p className="small">About three minutes of animation in short chapters. Questions wait for you.</p>
            </div>
          )}

          {atEnd && (
            <div className="finish" data-testid="finish" ref={finishRef}>
              <p className="finish-title">
                <Icon name="star" size={22} /> You found the structure!
              </p>
              <div className="finish-actions">
                {!isBonusDone && (
                  <button type="button" className="btn btn-quiet" onClick={() => dispatch({ type: "goto", chapter: BONUS_INDEX, now: now() })}>
                    Try the Grade 3 bonus
                  </button>
                )}
                <button type="button" className="btn btn-quiet" onClick={reset}>
                  <Icon name="restart" /> Start over
                </button>
              </div>
            </div>
          )}

          {state.started && step.kind === "scene" && (
            <div className="caption-box">
              <p className={`caption ${captionsOn ? "" : "sr-only"}`} role="status" aria-live="polite" data-testid="caption">
                {caption}
              </p>
              {!captionsOn && (
                <p className="caption-off" aria-hidden="true">
                  Captions are off.
                </p>
              )}
              {finished && !atEnd && (
                <p className="ready-note">
                  <Icon name="next" size={16} /> Tap <strong>Next</strong> when you&apos;re ready, or <strong>Replay</strong> to watch again.
                </p>
              )}
            </div>
          )}

          {questionStep && answer && (
            <QuestionCard
              key={questionStep.questionId}
              question={QUESTIONS[questionStep.questionId]}
              answer={answer}
              onSubmit={(response) => dispatch({ type: "submit", questionId: questionStep.questionId, response })}
              onShowMe={() => dispatch({ type: "showMe", questionId: questionStep.questionId })}
              onHint={() => dispatch({ type: "hint", questionId: questionStep.questionId })}
            />
          )}

          {state.started && (
            <div className="controls" role="group" aria-label="Playback">
              <button
                type="button"
                className="btn btn-control"
                onClick={togglePause}
                disabled={step.kind !== "scene" || finished}
                aria-keyshortcuts="P"
                data-testid="pause"
              >
                <Icon name={sceneLive || step.kind !== "scene" || finished ? "pause" : "play"} />
                {sceneLive || step.kind !== "scene" || finished ? "Pause" : "Resume"}
              </button>
              <button type="button" className="btn btn-control" onClick={replay} aria-keyshortcuts="R" data-testid="replay">
                <Icon name="replay" /> Replay
              </button>
              <button
                ref={nextRef}
                type="button"
                className={`btn btn-next ${advance && (finished || (questionStep && answer && isResolved(answer))) ? "ready" : ""}`}
                onClick={next}
                disabled={!advance}
                aria-keyshortcuts="N"
                data-testid="next"
              >
                Next <Icon name="next" />
              </button>
            </div>
          )}
          {state.started && state.chapter === BONUS_INDEX && (
            <p className="skip-row">
              This bonus is optional.{" "}
              <button type="button" className="btn btn-quiet btn-small" onClick={() => dispatch({ type: "skipBonus", now: now() })} data-testid="skip-bonus">
                Skip to the wrap-up
              </button>
            </p>
          )}
          {state.started && (
            <p className="keys-help">
              Keyboard: <kbd>P</kbd> pause or resume · <kbd>R</kbd> replay · <kbd>N</kbd> next
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
