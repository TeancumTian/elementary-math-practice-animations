import { describe, expect, it } from 'vitest';
import { CHAPTERS, QUESTIONS, SCENES, correctLetter, type QuestionId } from '../model/precision-model';
import {
  canGoNext,
  currentStep,
  initialState,
  progressFor,
  reducer,
  type Action,
  type ShopState,
} from './shop-state';

const run = (state: ShopState, ...actions: Action[]) => actions.reduce(reducer, state);
const started = () => run(initialState(), { type: 'START' });
const wrongLetter = (id: QuestionId) => QUESTIONS[id].options.find((o) => o.letter !== correctLetter(id))!.letter;

describe('playback', () => {
  it('starts on the welcome scene and plays only after START', () => {
    const s0 = initialState();
    expect(s0.started).toBe(false);
    expect(reducer(s0, { type: 'TICK', dt: 500, token: s0.token })).toBe(s0);
    const s1 = reducer(s0, { type: 'START' });
    expect(s1.started).toBe(true);
    expect(currentStep(s1)).toMatchObject({ kind: 'scene', scene: 'intro' });
    expect(reducer(s1, { type: 'TICK', dt: 500, token: s1.token }).elapsed).toBe(500);
  });

  it('pause freezes time; resume continues', () => {
    let s = run(started(), { type: 'TICK', dt: 1000, token: 1 });
    s = reducer(s, { type: 'TOGGLE_PAUSE' });
    expect(s.paused).toBe(true);
    expect(reducer(s, { type: 'TICK', dt: 1000, token: s.token }).elapsed).toBe(1000);
    s = reducer(s, { type: 'TOGGLE_PAUSE' });
    expect(reducer(s, { type: 'TICK', dt: 250, token: s.token }).elapsed).toBe(1250);
  });

  it('time is clamped to the scene length and ignores bad dt values', () => {
    const s = started();
    const end = run(s, { type: 'TICK', dt: 1e9, token: s.token });
    expect(end.elapsed).toBe(SCENES.intro.duration);
    expect(run(s, { type: 'TICK', dt: Number.NaN, token: s.token }).elapsed).toBe(0);
    expect(run(s, { type: 'TICK', dt: -50, token: s.token }).elapsed).toBe(0);
  });

  it('stale frames from a previous step are ignored (mid-animation navigation)', () => {
    let s = run(started(), { type: 'GOTO_CHAPTER', index: 1 }, { type: 'NEXT' }); // predict
    s = run(s, { type: 'SELECT', question: 'predict-unit', letter: correctLetter('predict-unit') }, { type: 'SUBMIT', question: 'predict-unit' }, { type: 'NEXT' });
    const oldToken = s.token;
    s = reducer(s, { type: 'TICK', dt: 5000, token: oldToken });
    expect(s.elapsed).toBe(5000);
    s = reducer(s, { type: 'GOTO_CHAPTER', index: 3 });
    expect(s.elapsed).toBe(0);
    expect(reducer(s, { type: 'TICK', dt: 700, token: oldToken }).elapsed).toBe(0);
    expect(currentStep(s)).toMatchObject({ scene: 'look-equal' });
  });
});

describe('learner-controlled navigation', () => {
  it('Next waits at every unanswered question, even when pressed many times', () => {
    let s = run(started(), { type: 'GOTO_CHAPTER', index: 1 });
    for (let i = 0; i < 30; i += 1) s = reducer(s, { type: 'NEXT' });
    expect(currentStep(s)).toMatchObject({ kind: 'question', question: 'predict-unit' });
    expect(canGoNext(s)).toBe(false);
  });

  it('a wrong answer does not unlock Next; a correct one does', () => {
    let s = run(started(), { type: 'GOTO_CHAPTER', index: 1 }, { type: 'NEXT' });
    s = run(s, { type: 'SELECT', question: 'predict-unit', letter: wrongLetter('predict-unit') }, { type: 'SUBMIT', question: 'predict-unit' });
    expect(canGoNext(s)).toBe(false);
    expect(progressFor(s, 'predict-unit').result?.correct).toBe(false);
    s = run(s, { type: 'SELECT', question: 'predict-unit', letter: correctLetter('predict-unit') }, { type: 'SUBMIT', question: 'predict-unit' });
    expect(canGoNext(s)).toBe(true);
  });

  it('Back and chapter jumps keep earlier answers; Replay chapter clears only that chapter', () => {
    let s = run(started(), { type: 'GOTO_CHAPTER', index: 1 }, { type: 'NEXT' });
    s = run(s, { type: 'SELECT', question: 'predict-unit', letter: correctLetter('predict-unit') }, { type: 'SUBMIT', question: 'predict-unit' });
    s = run(s, { type: 'GOTO_CHAPTER', index: 2 }, { type: 'NEXT' });
    s = run(s, { type: 'SELECT', question: 'predict-axis', letter: correctLetter('predict-axis') }, { type: 'SUBMIT', question: 'predict-axis' });
    s = run(s, { type: 'GOTO_CHAPTER', index: 1 }, { type: 'NEXT' });
    expect(progressFor(s, 'predict-unit').solved).toBe(true);
    s = reducer(s, { type: 'REPLAY_CHAPTER' });
    expect(currentStep(s)).toMatchObject({ scene: 'look-unit' });
    expect(progressFor(s, 'predict-unit').solved).toBe(false);
    expect(progressFor(s, 'predict-axis').solved).toBe(true);
    s = reducer(s, { type: 'BACK' });
    expect(currentStep(s)).toMatchObject({ scene: 'intro' });
  });

  it('Reset returns to the welcome screen, clears answers, and keeps preferences', () => {
    let s = run(started(), { type: 'TOGGLE_CAPTIONS' }, { type: 'GOTO_CHAPTER', index: 1 }, { type: 'NEXT' });
    s = run(s, { type: 'SELECT', question: 'predict-unit', letter: correctLetter('predict-unit') }, { type: 'SUBMIT', question: 'predict-unit' });
    s = reducer(s, { type: 'RESET' });
    expect(s.started).toBe(false);
    expect(s.answers).toEqual({});
    expect(s.prefs.captions).toBe(false);
    expect([s.chapter, s.step, s.elapsed]).toEqual([0, 0, 0]);
  });

  it('ignores invalid chapter indexes and actions for other questions', () => {
    const s = started();
    expect(reducer(s, { type: 'GOTO_CHAPTER', index: 99 })).toBe(s);
    expect(reducer(s, { type: 'GOTO_CHAPTER', index: -1 })).toBe(s);
    expect(reducer(s, { type: 'SELECT', question: 'transfer', letter: 'A' })).toBe(s);
    expect(reducer(s, { type: 'SUBMIT', question: 'transfer' })).toBe(s);
  });

  it('the whole path can be completed and the last step has no Next', () => {
    let s = started();
    let guard = 0;
    while (guard < 100) {
      guard += 1;
      const step = currentStep(s);
      if (step.kind === 'question') {
        s = run(s, { type: 'SELECT', question: step.question, letter: correctLetter(step.question) }, { type: 'SUBMIT', question: step.question });
      }
      if (!canGoNext(s)) break;
      s = reducer(s, { type: 'NEXT' });
    }
    expect(s.chapter).toBe(CHAPTERS.length - 1);
    expect(currentStep(s)).toMatchObject({ scene: 'finale' });
  });
});

describe('rapid input', () => {
  it('double-submitting the same wrong choice records it once', () => {
    let s = run(started(), { type: 'GOTO_CHAPTER', index: 1 }, { type: 'NEXT' });
    const w = wrongLetter('predict-unit');
    s = run(s, { type: 'SELECT', question: 'predict-unit', letter: w }, { type: 'SUBMIT', question: 'predict-unit' });
    const once = s;
    s = run(s, { type: 'SUBMIT', question: 'predict-unit' }, { type: 'SUBMIT', question: 'predict-unit' });
    expect(s).toBe(once);
    expect(progressFor(s, 'predict-unit').tried).toEqual([w]);
  });

  it('after solving, extra selects and submits change nothing', () => {
    let s = run(started(), { type: 'GOTO_CHAPTER', index: 1 }, { type: 'NEXT' });
    s = run(s, { type: 'SELECT', question: 'predict-unit', letter: correctLetter('predict-unit') }, { type: 'SUBMIT', question: 'predict-unit' });
    const solved = s;
    s = run(s, { type: 'SELECT', question: 'predict-unit', letter: wrongLetter('predict-unit') }, { type: 'SUBMIT', question: 'predict-unit' });
    expect(s).toBe(solved);
  });

  it('pause toggles are ignored on questions and after a scene ends', () => {
    let s = run(started(), { type: 'GOTO_CHAPTER', index: 1 }, { type: 'NEXT' });
    expect(reducer(s, { type: 'TOGGLE_PAUSE' })).toBe(s);
    s = run(started(), { type: 'TICK', dt: 1e9, token: 1 });
    expect(reducer(s, { type: 'TOGGLE_PAUSE' })).toBe(s);
  });

  it('system reduced-motion is followed until the learner chooses', () => {
    let s = reducer(initialState(), { type: 'SYSTEM_REDUCED_MOTION', reduce: true });
    expect(s.prefs.reducedMotion).toBe(true);
    s = reducer(s, { type: 'TOGGLE_REDUCED_MOTION' });
    expect(s.prefs).toMatchObject({ reducedMotion: false, motionSource: 'user' });
    s = reducer(s, { type: 'SYSTEM_REDUCED_MOTION', reduce: true });
    expect(s.prefs.reducedMotion).toBe(false);
  });
});
