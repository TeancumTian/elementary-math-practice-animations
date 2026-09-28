/**
 * Pure playback state machine. The UI dispatches actions; this reducer
 * decides what is allowed, so rapid or repeated input can never push the
 * lesson into an inconsistent state (for example past an unanswered question).
 */
import {
  checkGroupTotal,
  checkProposalChoice,
  revealGroupTotal,
  revealProposal,
  type Feedback,
} from '@/model/repeatedReasoning';
import { CHAPTERS, type Beat, type Question } from './script';

export interface AnswerState {
  status: 'unanswered' | 'correct' | 'revealed';
  attempts: number;
  input: string;
  feedback: Feedback | null;
  reveal: string | null;
}

export interface PlayerState {
  started: boolean;
  chapter: number;
  beat: number;
  /** Milliseconds into the current beat. */
  elapsed: number;
  playing: boolean;
  answers: Record<string, AnswerState>;
  /** Increments every time a chapter is (re)entered; used to reset question inputs. */
  visit: number;
}

export type PlayerAction =
  | { type: 'start' }
  | { type: 'togglePlay' }
  | { type: 'pause' }
  | { type: 'play' }
  | { type: 'tick'; dt: number }
  | { type: 'next' }
  | { type: 'back' }
  | { type: 'replayChapter' }
  | { type: 'goToChapter'; chapter: number }
  | { type: 'submit'; questionId: string; input: string }
  | { type: 'reveal'; questionId: string }
  | { type: 'reset' };

export const initialPlayerState: PlayerState = {
  started: false,
  chapter: 0,
  beat: 0,
  elapsed: 0,
  playing: false,
  answers: {},
  visit: 0,
};

export const REVEAL_AFTER_ATTEMPTS = 2;

export function currentBeat(s: PlayerState): Beat {
  return CHAPTERS[s.chapter].beats[s.beat];
}

export function isLastBeatOfChapter(s: PlayerState): boolean {
  return s.beat === CHAPTERS[s.chapter].beats.length - 1;
}

export function isLastChapter(s: PlayerState): boolean {
  return s.chapter === CHAPTERS.length - 1;
}

export function answerState(s: PlayerState, questionId: string): AnswerState {
  return s.answers[questionId] ?? { status: 'unanswered', attempts: 0, input: '', feedback: null, reveal: null };
}

export function questionResolved(s: PlayerState, q: Question | undefined): boolean {
  if (!q) return true;
  return answerState(s, q.id).status !== 'unanswered';
}

/** A beat that waits (gate, question, or the end of a chapter) stops the clock at its end. */
export function beatWaits(s: PlayerState): boolean {
  const b = currentBeat(s);
  return !!b.wait || isLastBeatOfChapter(s);
}

export function isHolding(s: PlayerState): boolean {
  return s.started && s.elapsed >= currentBeat(s).duration && beatWaits(s);
}

export function canGoNext(s: PlayerState): boolean {
  if (!s.started) return true;
  const b = currentBeat(s);
  if (b.wait === 'question' && !questionResolved(s, b.question)) return false;
  return !(isLastChapter(s) && isLastBeatOfChapter(s));
}

export function canGoBack(s: PlayerState): boolean {
  return s.started && s.beat > 0;
}

export function isComplete(s: PlayerState): boolean {
  return s.started && isLastChapter(s) && isLastBeatOfChapter(s) && s.elapsed >= currentBeat(s).duration;
}

function enterChapter(s: PlayerState, chapter: number): PlayerState {
  const c = Math.max(0, Math.min(CHAPTERS.length - 1, Math.trunc(chapter)));
  const ids = new Set(CHAPTERS[c].beats.flatMap((b) => (b.question ? [b.question.id] : [])));
  const answers = Object.fromEntries(Object.entries(s.answers).filter(([id]) => !ids.has(id)));
  return { ...s, started: true, chapter: c, beat: 0, elapsed: 0, playing: true, answers, visit: s.visit + 1 };
}

export function evaluate(q: Question, input: string): Feedback {
  return q.kind === 'number' ? checkGroupTotal(input, q.groups, q.context) : checkProposalChoice(input);
}

export function revealText(q: Question): string {
  return q.kind === 'number' ? revealGroupTotal(q.groups, q.context) : revealProposal();
}

export function playerReducer(s: PlayerState, a: PlayerAction): PlayerState {
  switch (a.type) {
    case 'start':
      return enterChapter({ ...initialPlayerState, visit: s.visit }, 0);

    case 'reset':
      return { ...initialPlayerState, visit: s.visit + 1 };

    case 'togglePlay':
      if (!s.started) return enterChapter({ ...initialPlayerState, visit: s.visit }, 0);
      return { ...s, playing: !s.playing };

    case 'pause':
      return s.playing ? { ...s, playing: false } : s;

    case 'play':
      if (!s.started) return enterChapter({ ...initialPlayerState, visit: s.visit }, 0);
      return s.playing ? s : { ...s, playing: true };

    case 'tick': {
      if (!s.started || !s.playing || !(a.dt > 0)) return s;
      const b = currentBeat(s);
      const elapsed = Math.min(b.duration, s.elapsed + a.dt);
      if (elapsed < b.duration) return { ...s, elapsed };
      if (beatWaits(s)) return elapsed === s.elapsed ? s : { ...s, elapsed };
      return { ...s, beat: s.beat + 1, elapsed: 0 };
    }

    case 'next': {
      if (!s.started) return enterChapter({ ...initialPlayerState, visit: s.visit }, 0);
      if (!canGoNext(s)) return s;
      if (!isLastBeatOfChapter(s)) return { ...s, beat: s.beat + 1, elapsed: 0, playing: true };
      return enterChapter(s, s.chapter + 1);
    }

    case 'back':
      if (!canGoBack(s)) return s;
      return { ...s, beat: s.beat - 1, elapsed: 0 };

    case 'replayChapter':
      if (!s.started) return s;
      return enterChapter(s, s.chapter);

    case 'goToChapter':
      if (!Number.isInteger(a.chapter) || a.chapter < 0 || a.chapter >= CHAPTERS.length) return s;
      return enterChapter(s, a.chapter);

    case 'submit': {
      const q = currentBeat(s).question;
      if (!s.started || !q || q.id !== a.questionId) return s;
      const prev = answerState(s, q.id);
      if (prev.status !== 'unanswered') return s;
      const feedback = evaluate(q, a.input);
      const next: AnswerState = feedback.attempt
        ? { ...prev, status: feedback.correct ? 'correct' : 'unanswered', attempts: prev.attempts + 1, input: a.input, feedback }
        : { ...prev, input: a.input, feedback };
      return { ...s, answers: { ...s.answers, [q.id]: next } };
    }

    case 'reveal': {
      const q = currentBeat(s).question;
      if (!s.started || !q || q.id !== a.questionId) return s;
      const prev = answerState(s, q.id);
      if (prev.status !== 'unanswered' || prev.attempts < REVEAL_AFTER_ATTEMPTS) return s;
      return { ...s, answers: { ...s.answers, [q.id]: { ...prev, status: 'revealed', reveal: revealText(q) } } };
    }
  }
}
