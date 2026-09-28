import { describe, expect, it } from 'vitest';
import { CHAPTERS, answerFor } from './script';
import {
  answerState,
  canGoNext,
  currentBeat,
  initialPlayerState,
  isComplete,
  isHolding,
  playerReducer,
  type PlayerAction,
  type PlayerState,
} from './player';

const run = (s: PlayerState, ...actions: PlayerAction[]) => actions.reduce(playerReducer, s);
const started = () => run(initialPlayerState, { type: 'start' });

/** Play the current beat to its end. */
function finishBeat(s: PlayerState): PlayerState {
  return playerReducer(s, { type: 'tick', dt: currentBeat(s).duration + 1 });
}

/** Advance until the current beat has a question (or the chapter ends). */
function toQuestion(s: PlayerState, id: string): PlayerState {
  for (let i = 0; i < 200; i++) {
    const b = currentBeat(s);
    if (b.question?.id === id) return s;
    s = finishBeat(s);
    if (isHolding(s)) s = playerReducer(s, { type: 'next' });
  }
  throw new Error(`never reached ${id}`);
}

describe('player state machine', () => {
  it('starts at chapter 1, beat 1, playing', () => {
    const s = started();
    expect(s).toMatchObject({ started: true, chapter: 0, beat: 0, elapsed: 0, playing: true });
  });

  it('ticks through beats and waits at a gate until the learner acts', () => {
    let s = started();
    s = finishBeat(s);
    expect(currentBeat(s).id).toBe('c1-think');
    s = finishBeat(s);
    expect(currentBeat(s).id).toBe('c1-gate1');
    s = finishBeat(s);
    s = run(s, { type: 'tick', dt: 10_000 }, { type: 'tick', dt: 10_000 });
    expect(currentBeat(s).id).toBe('c1-gate1');
    expect(isHolding(s)).toBe(true);
    s = playerReducer(s, { type: 'next' });
    expect(currentBeat(s).id).toBe('c1-fill1');
  });

  it('pause freezes the clock and resume continues it', () => {
    let s = run(started(), { type: 'tick', dt: 1000 });
    expect(s.elapsed).toBe(1000);
    s = run(s, { type: 'pause' }, { type: 'tick', dt: 1000 }, { type: 'tick', dt: 1000 });
    expect(s.elapsed).toBe(1000);
    expect(s.playing).toBe(false);
    s = run(s, { type: 'togglePlay' }, { type: 'tick', dt: 500 });
    expect(s.elapsed).toBe(1500);
  });

  it('waits at a question: Next is blocked until the answer is correct or revealed', () => {
    let s = toQuestion(started(), 'predict-5');
    s = finishBeat(s);
    expect(canGoNext(s)).toBe(false);
    for (let i = 0; i < 50; i++) s = run(s, { type: 'next' }, { type: 'tick', dt: 5000 });
    expect(currentBeat(s).id).toBe('c2-predict');

    s = playerReducer(s, { type: 'submit', questionId: 'predict-5', input: '' });
    expect(answerState(s, 'predict-5').attempts).toBe(0);

    s = playerReducer(s, { type: 'submit', questionId: 'predict-5', input: '24' });
    expect(answerState(s, 'predict-5')).toMatchObject({ status: 'unanswered', attempts: 1 });
    expect(answerState(s, 'predict-5').feedback?.message).toContain('only 4 more than 20');

    // reveal is not allowed after only one attempt
    s = playerReducer(s, { type: 'reveal', questionId: 'predict-5' });
    expect(answerState(s, 'predict-5').status).toBe('unanswered');

    s = playerReducer(s, { type: 'submit', questionId: 'predict-5', input: '25' });
    expect(answerState(s, 'predict-5').status).toBe('correct');
    // further submissions (double-clicks) are ignored
    s = playerReducer(s, { type: 'submit', questionId: 'predict-5', input: '99' });
    expect(answerState(s, 'predict-5')).toMatchObject({ status: 'correct', attempts: 2, input: '25' });
    expect(canGoNext(s)).toBe(true);
    s = playerReducer(s, { type: 'next' });
    expect(currentBeat(s).id).toBe('c2-held');
  });

  it('offers the model after two wrong attempts', () => {
    let s = toQuestion(started(), 'predict-5');
    s = run(s, { type: 'submit', questionId: 'predict-5', input: '24' }, { type: 'submit', questionId: 'predict-5', input: '30' }, { type: 'reveal', questionId: 'predict-5' });
    expect(answerState(s, 'predict-5').status).toBe('revealed');
    expect(answerState(s, 'predict-5').reveal).toContain('25');
    expect(canGoNext(s)).toBe(true);
  });

  it('ignores answers for a question that is not on screen', () => {
    const s = started();
    expect(playerReducer(s, { type: 'submit', questionId: 'predict-5', input: '25' })).toBe(s);
  });

  it('replay and chapter navigation restart the chapter and clear its answers', () => {
    let s = toQuestion(started(), 'predict-5');
    s = run(s, { type: 'submit', questionId: 'predict-5', input: '25' });
    const replayed = playerReducer(s, { type: 'replayChapter' });
    expect(replayed).toMatchObject({ chapter: 1, beat: 0, elapsed: 0, playing: true });
    expect(answerState(replayed, 'predict-5').status).toBe('unanswered');
    expect(replayed.visit).toBe(s.visit + 1);

    const jumped = run(s, { type: 'goToChapter', chapter: 4 }, { type: 'goToChapter', chapter: 1 });
    expect(jumped).toMatchObject({ chapter: 1, beat: 0 });
    expect(answerState(jumped, 'predict-5').status).toBe('unanswered');

    expect(playerReducer(s, { type: 'goToChapter', chapter: 99 })).toBe(s);
    expect(playerReducer(s, { type: 'goToChapter', chapter: -1 })).toBe(s);
  });

  it('back stays inside the chapter', () => {
    let s = run(started(), { type: 'back' });
    expect(s.beat).toBe(0);
    s = finishBeat(s);
    s = run(s, { type: 'back' });
    expect(s.beat).toBe(0);
  });

  it('reset returns to the title state', () => {
    const s = run(toQuestion(started(), 'predict-5'), { type: 'submit', questionId: 'predict-5', input: '25' }, { type: 'reset' });
    expect(s).toMatchObject({ started: false, chapter: 0, beat: 0, elapsed: 0, playing: false, answers: {} });
  });

  it('a full playthrough with correct answers reaches the end', () => {
    let s = started();
    for (let i = 0; i < 500 && !isComplete(s); i++) {
      const b = currentBeat(s);
      if (b.question && answerState(s, b.question.id).status === 'unanswered') {
        s = playerReducer(s, { type: 'submit', questionId: b.question.id, input: answerFor(b.question) });
      }
      s = finishBeat(s);
      if (isHolding(s) && canGoNext(s)) s = playerReducer(s, { type: 'next' });
    }
    expect(isComplete(s)).toBe(true);
    expect(s.chapter).toBe(CHAPTERS.length - 1);
    expect(['predict-5', 'check-pip', 'monitor-6', 'transfer-7'].every((id) => answerState(s, id).status === 'correct')).toBe(true);
  });

  it('survives thousands of random rapid actions without breaking its invariants', () => {
    let seed = 12345;
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    const actions: (() => PlayerAction)[] = [
      () => ({ type: 'next' }),
      () => ({ type: 'next' }),
      () => ({ type: 'back' }),
      () => ({ type: 'togglePlay' }),
      () => ({ type: 'tick', dt: rand() * 3000 }),
      () => ({ type: 'tick', dt: rand() * 3000 }),
      () => ({ type: 'replayChapter' }),
      () => ({ type: 'goToChapter', chapter: Math.floor(rand() * 7) - 1 }),
      () => ({ type: 'submit', questionId: currentBeatId(), input: String(Math.floor(rand() * 40)) }),
      () => ({ type: 'reveal', questionId: currentBeatId() }),
      () => ({ type: 'reset' }),
      () => ({ type: 'start' }),
    ];
    let s = initialPlayerState;
    const currentBeatId = () => currentBeat(s).question?.id ?? 'none';
    for (let i = 0; i < 20_000; i++) {
      s = playerReducer(s, actions[Math.floor(rand() * actions.length)]());
      const chapter = CHAPTERS[s.chapter];
      expect(chapter).toBeDefined();
      expect(s.beat).toBeGreaterThanOrEqual(0);
      expect(s.beat).toBeLessThan(chapter.beats.length);
      expect(s.elapsed).toBeGreaterThanOrEqual(0);
      expect(s.elapsed).toBeLessThanOrEqual(currentBeat(s).duration);
      // never past an unanswered question in the current chapter
      chapter.beats.slice(0, s.beat).forEach((b) => {
        if (b.question) expect(answerState(s, b.question.id).status).not.toBe('unanswered');
      });
    }
  });
});
