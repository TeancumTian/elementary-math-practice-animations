'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import { CHAPTERS, PHASES, type Phase } from '@/lesson/script';
import { computeFrame, describeFrame } from '@/lesson/frame';
import {
  answerState,
  canGoBack,
  canGoNext,
  currentBeat,
  initialPlayerState,
  isComplete,
  isHolding,
  isLastBeatOfChapter,
  isLastChapter,
  playerReducer,
  questionResolved,
  type PlayerAction,
  type PlayerState,
} from '@/lesson/player';
import type { LayoutName } from '@/model/repeatedReasoning';
import { Stage } from './Stage';
import { QuestionPanel } from './QuestionPanel';

/** Ignore a repeat of the same navigation within this window (double-clicks, key mashing). */
const NAV_GUARD_MS = 280;
/** Stage widths below this use the tall "narrow" layout from the model. */
const NARROW_BELOW = 560;

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

function useStageLayout(ref: React.RefObject<HTMLDivElement | null>): LayoutName {
  const [name, setName] = useState<LayoutName>('wide');
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = (w: number) => setName(w < NARROW_BELOW ? 'narrow' : 'wide');
    measure(el.getBoundingClientRect().width);
    const ro = new ResizeObserver((entries) => measure(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return name;
}

function useSystemReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

function useSpeed(): number {
  const [speed, setSpeed] = useState(1);
  useEffect(() => {
    const v = Number(new URLSearchParams(window.location.search).get('speed'));
    if (Number.isFinite(v) && v >= 0.25 && v <= 50) setSpeed(v);
  }, []);
  return speed;
}

/** Drives the clock with requestAnimationFrame while playback is active. */
function usePlaybackClock(active: boolean, speed: number, dispatch: React.Dispatch<PlayerAction>) {
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(250, Math.max(0, now - last));
      last = now;
      dispatch({ type: 'tick', dt: dt * speed });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active, speed, dispatch]);
}

function nextLabel(s: PlayerState): string {
  if (!s.started) return 'Start';
  const b = currentBeat(s);
  if (b.wait === 'question') return questionResolved(s, b.question) ? 'Continue' : 'Answer to continue';
  if (b.wait === 'gate') return b.actionLabel ?? 'Next';
  if (isLastBeatOfChapter(s)) return isLastChapter(s) ? 'The end' : 'Next chapter';
  return 'Next step';
}

export default function Lesson() {
  const [state, rawDispatch] = useReducer(playerReducer, initialPlayerState);
  const stageRef = useRef<HTMLDivElement>(null);
  const promptRef = useRef<HTMLElement>(null);
  const layout = useStageLayout(stageRef);
  const systemReduced = useSystemReducedMotion();
  const [motionOverride, setMotionOverride] = useState<boolean | null>(null);
  const reduced = motionOverride ?? systemReduced;
  const [captions, setCaptions] = useState(true);
  const speed = useSpeed();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const chapter = CHAPTERS[state.chapter];
  const beat = currentBeat(state);
  const holding = isHolding(state);
  const complete = isComplete(state);
  usePlaybackClock(state.started && state.playing && !holding, speed, rawDispatch);

  // Guard navigation against double-clicks and key mashing.
  const lastNav = useRef(0);
  const guarded = useCallback((action: PlayerAction) => {
    const now = performance.now();
    if (now - lastNav.current < NAV_GUARD_MS) return;
    lastNav.current = now;
    rawDispatch(action);
  }, []);
  const dispatch = rawDispatch;

  const frame = useMemo(
    () => (state.started ? computeFrame(beat, state.elapsed, layout, reduced) : computeFrame(beat, beat.duration, layout, true)),
    [beat, state.elapsed, state.started, layout, reduced],
  );
  const description = useMemo(() => describeFrame(frame), [frame]);

  // Move focus to a new question so keyboard and screen-reader users land on it.
  const questionKey = beat.question ? `${beat.question.id}-${state.visit}` : null;
  useEffect(() => {
    if (!questionKey) return;
    const el = promptRef.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
  }, [questionKey, reduced]);

  // Keyboard shortcuts (ignored while typing or when a focused control handles the key).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName ?? '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) return;
      const onControl = tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY';
      switch (e.key) {
        case ' ':
          if (onControl) return;
          e.preventDefault();
          if (!e.repeat) dispatch({ type: 'togglePlay' });
          return;
        case 'k':
        case 'K':
          if (!e.repeat) dispatch({ type: 'togglePlay' });
          return;
        case 'ArrowRight':
        case 'n':
        case 'N':
          e.preventDefault();
          if (!e.repeat) guarded({ type: 'next' });
          return;
        case 'ArrowLeft':
        case 'b':
        case 'B':
          e.preventDefault();
          if (!e.repeat) guarded({ type: 'back' });
          return;
        case 'r':
        case 'R':
          if (!e.repeat) guarded({ type: 'replayChapter' });
          return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch, guarded]);

  const q = beat.question;
  const answer = q ? answerState(state, q.id) : null;
  const next = nextLabel(state);
  const nextReady = state.started && holding && canGoNext(state);
  const phase: Phase | null = state.started ? beat.phase : null;

  return (
    <div className={`app ${reduced ? 'reduce-motion' : ''}`}>
      <header className="topbar">
        <div className="brand">
          <h1>Crates of Five</h1>
          <p className="tagline">
            Math Practice 8 (MP.8): Look for and express regularity in repeated reasoning · Grade 3
          </p>
        </div>
        <div className="settings" role="group" aria-label="Settings">
          <button type="button" className="btn btn-small" aria-pressed={reduced} onClick={() => setMotionOverride(!reduced)}>
            Reduce motion: {reduced ? 'On' : 'Off'}
          </button>
          <button type="button" className="btn btn-small" aria-pressed={captions} onClick={() => setCaptions((c) => !c)}>
            Captions: {captions ? 'On' : 'Off'}
          </button>
          <button type="button" className="btn btn-small" onClick={() => dispatch({ type: 'reset' })} data-testid="reset">
            Start over
          </button>
        </div>
      </header>

      <nav className="chapters" aria-label="Chapters">
        <ol>
          {CHAPTERS.map((c, i) => {
            const current = state.started && i === state.chapter;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  className={`chapter-btn ${current ? 'current' : ''}`}
                  aria-current={current ? 'step' : undefined}
                  aria-label={`Chapter ${i + 1}: ${c.title}`}
                  onClick={() => dispatch({ type: 'goToChapter', chapter: i })}
                >
                  <span className="chapter-num" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className="chapter-name" aria-hidden="true">
                    {c.short}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <main
        className="lesson"
        data-testid="lesson"
        data-hydrated={hydrated}
        data-started={state.started}
        data-chapter={state.chapter}
        data-beat={state.started ? beat.id : 'title'}
        data-playing={state.playing}
        data-holding={holding}
        data-complete={complete}
        data-elapsed={Math.round(state.elapsed)}
        data-reduced={reduced}
        data-layout={layout}
      >
        <div className="stage-wrap" ref={stageRef}>
          <Stage frame={frame} description={description} />
          {!state.started && (
            <div className="title-card">
              <p className="kicker">A short math story · about 3 minutes</p>
              <h2>Leo&apos;s Crates of Five</h2>
              <p>Pack crates of apples, spot what repeats, and check Pip the parrot&apos;s guess.</p>
              <button type="button" className="btn btn-primary btn-big" onClick={() => dispatch({ type: 'start' })}>
                <span aria-hidden="true">▶ </span>Start the story
              </button>
            </div>
          )}
        </div>

        <section className="panel" aria-label="Story and questions">
          <p className="chapter-heading">
            {state.started ? (
              <>
                Chapter {state.chapter + 1} of {CHAPTERS.length}: <strong>{chapter.title}</strong>
              </>
            ) : (
              <>{CHAPTERS.length} short chapters. Replay any of them.</>
            )}
          </p>
          <ol className="phases" aria-label="Lesson steps">
            {PHASES.map((ph) => (
              <li key={ph.id} className={ph.id === phase ? 'current' : ''} aria-current={ph.id === phase ? 'step' : undefined}>
                <span className="phase-icon" aria-hidden="true">
                  {ph.icon}
                </span>
                {ph.label}
              </li>
            ))}
          </ol>
          <div className={`caption-box ${captions ? '' : 'sr-only'}`}>
            <p className="caption" aria-live="polite" data-testid="caption">
              {state.started ? beat.caption : 'Press “Start the story” to begin. You can pause, replay, or jump to any chapter.'}
            </p>
          </div>

          {q && answer && (
            <QuestionPanel
              key={`${q.id}-${state.visit}`}
              question={q}
              answer={answer}
              promptRef={promptRef}
              onSubmit={(input) => dispatch({ type: 'submit', questionId: q.id, input })}
              onReveal={() => dispatch({ type: 'reveal', questionId: q.id })}
              onContinue={() => guarded({ type: 'next' })}
            />
          )}

          {complete && (
            <div className="complete" role="status">
              <p>
                <span aria-hidden="true">🎉 </span>
                <strong>Lesson complete!</strong> Replay any chapter, or press Start over.
              </p>
            </div>
          )}
        </section>

        <div className="controls" role="group" aria-label="Playback controls">
          <button type="button" className="btn" onClick={() => guarded({ type: 'replayChapter' })} disabled={!state.started}>
            <span aria-hidden="true">↺ </span>Replay chapter
          </button>
          <button type="button" className="btn" onClick={() => guarded({ type: 'back' })} disabled={!canGoBack(state)}>
            <span aria-hidden="true">◀ </span>Back
          </button>
          <button type="button" className="btn" onClick={() => dispatch({ type: 'togglePlay' })} data-testid="play-pause">
            {!state.started ? (
              <>
                <span aria-hidden="true">▶ </span>Play
              </>
            ) : state.playing ? (
              <>
                <span aria-hidden="true">❚❚ </span>Pause
              </>
            ) : (
              <>
                <span aria-hidden="true">▶ </span>Resume
              </>
            )}
          </button>
          <button
            type="button"
            className={`btn btn-next ${nextReady ? 'btn-primary is-ready' : ''}`}
            onClick={() => guarded({ type: 'next' })}
            disabled={!canGoNext(state)}
            data-testid="next"
          >
            {next} <span aria-hidden="true">▸</span>
          </button>
        </div>

        <details className="help">
          <summary>Keyboard shortcuts</summary>
          <ul>
            <li>
              <kbd>Space</kbd> or <kbd>K</kbd>: pause or resume
            </li>
            <li>
              <kbd>N</kbd> or <kbd>→</kbd>: next step or action
            </li>
            <li>
              <kbd>B</kbd> or <kbd>←</kbd>: back one step
            </li>
            <li>
              <kbd>R</kbd>: replay this chapter
            </li>
            <li>
              <kbd>Tab</kbd> moves between buttons; <kbd>Enter</kbd> checks an answer.
            </li>
          </ul>
        </details>
      </main>
    </div>
  );
}
