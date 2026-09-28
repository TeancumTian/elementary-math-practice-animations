'use client';

import { useCallback, useEffect, useReducer, useRef } from 'react';
import {
  CHAPTERS,
  QUESTIONS,
  SCENES,
  TOTAL_ANIMATION_MS,
  checkAnswer,
  cueAt,
  reducedMotionTime,
  visualTime,
  type OptionLetter,
  type SceneId,
} from '../model/precision-model';
import {
  canGoBack,
  canGoNext,
  canTogglePause,
  currentStep,
  initialState,
  isLastStep,
  isSceneFinished,
  progressFor,
  reducer,
  sceneDuration,
  type Action,
} from '../state/shop-state';
import { QuestionPanel } from './QuestionPanel';
import { Stage } from './Stage';

function clock(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const HOTKEYS: Record<string, Action> = {
  n: { type: 'NEXT' },
  b: { type: 'BACK' },
  p: { type: 'TOGGLE_PAUSE' },
  r: { type: 'REPLAY_CHAPTER' },
};

export default function RepairShop() {
  const [state, dispatch] = useReducer(reducer, undefined, () => initialState());
  const step = currentStep(state);
  const chapter = CHAPTERS[state.chapter];
  const duration = sceneDuration(step);
  const finished = isSceneFinished(state);
  const running = state.started && step.kind === 'scene' && !state.paused && !finished;

  const nextRef = useRef<HTMLButtonElement>(null);
  const startRef = useRef<HTMLButtonElement>(null);
  const questionHeadingRef = useRef<HTMLHeadingElement>(null);

  // Animation clock: requestAnimationFrame -> TICK. The token drops frames from old steps.
  useEffect(() => {
    if (!running) return;
    const token = state.token;
    let raf = 0;
    let last: number | null = null;
    const loop = (now: number) => {
      if (last !== null) dispatch({ type: 'TICK', dt: Math.min(now - last, 100), token });
      last = now;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running, state.token]);

  // Follow the operating system's reduced-motion setting until the learner chooses.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => dispatch({ type: 'SYSTEM_REDUCED_MOTION', reduce: mq.matches });
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  // Keyboard shortcuts (letters only, so arrows/space/enter keep their normal jobs).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.defaultPrevented) return;
      const action = HOTKEYS[e.key.toLowerCase()];
      if (action) dispatch(action);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Move focus sensibly whenever the step changes.
  useEffect(() => {
    if (state.token === 0) return;
    if (!state.started) {
      startRef.current?.focus();
      return;
    }
    if (currentStep(state).kind === 'question') {
      questionHeadingRef.current?.focus();
    } else {
      const active = document.activeElement as HTMLElement | null;
      if (!active || active === document.body || (active as HTMLButtonElement).disabled) nextRef.current?.focus();
    }
    // Runs only when the step identity (token) changes.
  }, [state.token]); // eslint-disable-line react-hooks/exhaustive-deps

  const questionId = step.kind === 'question' ? step.question : null;
  const qProgress = questionId ? progressFor(state, questionId) : null;

  const onSubmit = useCallback(() => {
    if (!questionId || !qProgress || qProgress.solved || !qProgress.selected) return;
    const willSolve = checkAnswer(questionId, qProgress.selected).correct;
    dispatch({ type: 'SUBMIT', question: questionId });
    if (willSolve) requestAnimationFrame(() => nextRef.current?.focus());
  }, [questionId, qProgress]);

  const onSelect = useCallback(
    (letter: OptionLetter) => {
      if (questionId) dispatch({ type: 'SELECT', question: questionId, letter });
    },
    [questionId],
  );

  // What the stage shows.
  let visualScene: SceneId = 'intro';
  let visualT = SCENES.intro.duration; // welcome poster: the finished shop picture
  if (state.started && step.kind === 'scene') {
    visualScene = step.scene;
    visualT = state.elapsed;
  } else if (state.started && step.kind === 'question') {
    const v = QUESTIONS[step.question].visual;
    visualScene = v.scene;
    visualT = visualTime(v);
  }
  const playingScene = state.started && step.kind === 'scene';
  const displayT = playingScene && state.prefs.reducedMotion ? reducedMotionTime(visualScene, visualT) : visualT;
  const descriptionT = playingScene ? reducedMotionTime(visualScene, visualT) : visualT;

  const cue = playingScene ? cueAt(visualScene, state.elapsed) : null;
  let captionText = 'Press Start to open the shop.';
  if (state.started) {
    if (cue) captionText = cue.text;
    else if (qProgress?.solved) captionText = 'Nice work! Press Next when you are ready.';
    else captionText = 'Your turn! Choose an answer, then press Check answer.';
  }

  // Optional read-aloud using the browser's built-in speech (off by default).
  const speakText = !state.started
    ? null
    : cue
      ? cue.text
      : questionId && qProgress
        ? qProgress.result
          ? qProgress.result.feedback
          : `${QUESTIONS[questionId].prompt} ${QUESTIONS[questionId].options.map((o) => `${o.letter}: ${o.text}`).join(' ')}`
        : null;
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis;
    if (!state.prefs.readAloud || !speakText || state.paused) {
      synth.cancel();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(speakText);
    utterance.lang = 'en-US';
    utterance.rate = 0.95;
    synth.cancel();
    synth.speak(utterance);
    return () => synth.cancel();
  }, [speakText, state.prefs.readAloud, state.paused]);

  const pct = duration > 0 ? Math.round((Math.min(state.elapsed, duration) / duration) * 100) : 0;
  const totalMinutes = Math.round(TOTAL_ANIMATION_MS / 60000);
  const last = isLastStep(state);

  return (
    <div className={`app${state.prefs.reducedMotion ? ' reduce-motion' : ''}`}>
      <a className="skip-link" href="#activity">
        Skip to activity
      </a>
      <header className="top">
        <div className="brand">
          <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
            <rect width="40" height="40" rx="10" fill="#0f766e" />
            <path d="M12 28 L24 16 M22 12 a6 6 0 1 0 8 8" stroke="#fff" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          </svg>
          <div>
            <h1>Math-Message Repair Shop</h1>
            <p>Grade 2 · Attend to precision (MP.6)</p>
          </div>
        </div>
        <nav className="chapters" aria-label="Chapters">
          <ol>
            {CHAPTERS.map((c, i) => (
              <li key={c.id}>
                <button
                  type="button"
                  aria-current={state.started && i === state.chapter ? 'step' : undefined}
                  onClick={() => dispatch({ type: 'GOTO_CHAPTER', index: i })}
                >
                  {c.number > 0 && (
                    <span className="num" aria-hidden="true">
                      {c.number}
                    </span>
                  )}
                  <span className="sr-only">{c.number > 0 ? `Chapter ${c.number}: ` : ''}</span>
                  {c.navLabel}
                </button>
              </li>
            ))}
          </ol>
        </nav>
      </header>

      <main id="activity" className="layout">
        <section className="stage-area" aria-label="Animation">
          <div className="stage-card">
            <Stage scene={visualScene} t={displayT} descriptionT={descriptionT} reducedMotion={state.prefs.reducedMotion} />
            <p className={`caption${state.prefs.captions ? '' : ' sr-only'}`} aria-live="polite" data-testid="caption">
              {captionText}
            </p>
            {playingScene && (
              <div className="progress-row">
                <div
                  className="progress"
                  role="progressbar"
                  aria-label="Animation progress"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={pct}
                  aria-valuetext={`${clock(state.elapsed)} of ${clock(duration)}`}
                  data-elapsed={Math.round(state.elapsed)}
                >
                  <div className="progress-fill" style={{ width: `${pct}%` }} />
                </div>
                <span className="time" aria-hidden="true">
                  {clock(state.elapsed)} / {clock(duration)}
                </span>
              </div>
            )}
          </div>

        </section>

        <section className="panel" aria-label="Your turn">
          {state.started && (
            <ol className="stepper" aria-label={`Steps in ${chapter.title}`}>
              {chapter.steps.map((s, i) => (
                <li key={i} aria-current={i === state.step ? 'step' : undefined} className={i < state.step ? 'done' : i === state.step ? 'current' : undefined}>
                  {i < state.step && <span aria-hidden="true">✓ </span>}
                  {s.stage}
                </li>
              ))}
            </ol>
          )}

          {!state.started && (
            <div className="welcome">
              <h2>Welcome, fixer!</h2>
              <p>Juno&apos;s shop repairs math messages so everyone can understand them.</p>
              <button ref={startRef} type="button" className="btn primary big" onClick={() => dispatch({ type: 'START' })}>
                <span aria-hidden="true">▶ </span>Start
              </button>
              <ul>
                <li>Look at a broken message</li>
                <li>Predict what needs fixing</li>
                <li>Watch the repair</li>
                <li>Explain it, then try one yourself</li>
              </ul>
              <p className="muted">
                {CHAPTERS.length - 1} short jobs · about {totalMinutes} minutes of animation · questions wait for you
              </p>
            </div>
          )}

          {state.started && step.kind === 'scene' && (
            <div className="scene-info">
              <h2 className="step-title">{step.stage}</h2>
              <p className="scene-state" data-testid="scene-state">
                {state.paused ? '❚❚ Paused' : finished ? '✓ Finished' : '▶ Playing'}
              </p>
              <p className="muted">
                {chapter.number > 0 ? `Job ${chapter.number}: ${chapter.title}. ` : ''}
                {last ? 'You finished every job! Press Play again to start over.' : 'Watch the animation. Press Next when you are ready.'}
              </p>
            </div>
          )}

          {state.started && questionId && qProgress && (
            <QuestionPanel key={questionId} ref={questionHeadingRef} id={questionId} progress={qProgress} onSelect={onSelect} onSubmit={onSubmit} />
          )}

          {state.started && (
            <div className="next-row">
              {last ? (
                <button type="button" className="btn primary" onClick={() => dispatch({ type: 'RESET' })}>
                  Play again
                </button>
              ) : (
                <button
                  ref={nextRef}
                  type="button"
                  className={`btn primary next${step.kind === 'scene' && finished ? ' ready' : ''}`}
                  onClick={() => dispatch({ type: 'NEXT' })}
                  disabled={!canGoNext(state)}
                  aria-describedby={!canGoNext(state) ? 'next-hint' : undefined}
                >
                  Next<span aria-hidden="true"> ▶</span>
                </button>
              )}
              {!last && !canGoNext(state) && (
                <p id="next-hint" className="muted small">
                  Check a correct answer to go on.
                </p>
              )}
            </div>
          )}
        </section>

        <section className="controls-area" aria-label="Controls">
          <div className="controls" role="group" aria-label="Playback controls">
            <button type="button" className="btn" onClick={() => dispatch({ type: 'BACK' })} disabled={!canGoBack(state)}>
              <span aria-hidden="true">◀ </span>Back
            </button>
            <button type="button" className="btn" onClick={() => dispatch({ type: 'TOGGLE_PAUSE' })} disabled={!canTogglePause(state)}>
              {state.paused ? (
                <>
                  <span aria-hidden="true">▶ </span>Resume
                </>
              ) : (
                <>
                  <span aria-hidden="true">❚❚ </span>Pause
                </>
              )}
            </button>
            <button type="button" className="btn" onClick={() => dispatch({ type: 'REPLAY_CHAPTER' })} disabled={!state.started}>
              <span aria-hidden="true">↺ </span>Replay<span className="long-label"> chapter</span>
            </button>
            <button type="button" className="btn subtle" onClick={() => dispatch({ type: 'RESET' })}>
              Start over
            </button>
          </div>
          <div className="toggles" role="group" aria-label="Display options">
            <button type="button" className="toggle" aria-pressed={state.prefs.captions} onClick={() => dispatch({ type: 'TOGGLE_CAPTIONS' })}>
              <span aria-hidden="true">{state.prefs.captions ? '☑' : '☐'} </span>Captions
            </button>
            <button type="button" className="toggle" aria-pressed={state.prefs.reducedMotion} onClick={() => dispatch({ type: 'TOGGLE_REDUCED_MOTION' })}>
              <span aria-hidden="true">{state.prefs.reducedMotion ? '☑' : '☐'} </span>Reduce motion
            </button>
            <button type="button" className="toggle" aria-pressed={state.prefs.readAloud} onClick={() => dispatch({ type: 'TOGGLE_READ_ALOUD' })}>
              <span aria-hidden="true">{state.prefs.readAloud ? '☑' : '☐'} </span>Read aloud
            </button>
          </div>
          <p className="keys">
            Keys: <kbd>N</kbd> next · <kbd>B</kbd> back · <kbd>P</kbd> pause/resume · <kbd>R</kbd> replay chapter
          </p>
        </section>
      </main>
    </div>
  );
}
