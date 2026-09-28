/**
 * Pure state machine for playback, navigation, and answers.
 * No DOM or timers here: the UI feeds it TICK actions from requestAnimationFrame.
 */
import {
  CHAPTERS,
  QUESTIONS,
  SCENES,
  checkAnswer,
  type OptionLetter,
  type QuestionId,
  type Step,
} from '../model/precision-model';

export interface QuestionProgress {
  selected: OptionLetter | null;
  /** Wrong options already checked (shown with a "Not yet" badge). */
  tried: OptionLetter[];
  solved: boolean;
  /** Feedback for the most recent check; cleared when a new option is selected. */
  result: { letter: OptionLetter; correct: boolean; feedback: string } | null;
}

export interface Prefs {
  captions: boolean;
  reducedMotion: boolean;
  motionSource: 'system' | 'user';
  readAloud: boolean;
}

export interface ShopState {
  started: boolean;
  chapter: number;
  step: number;
  /** Milliseconds played in the current scene step. */
  elapsed: number;
  paused: boolean;
  /** Changes on every navigation so stale animation frames are ignored. */
  token: number;
  answers: Partial<Record<QuestionId, QuestionProgress>>;
  prefs: Prefs;
}

export type Action =
  | { type: 'START' }
  | { type: 'NEXT' }
  | { type: 'BACK' }
  | { type: 'GOTO_CHAPTER'; index: number }
  | { type: 'REPLAY_CHAPTER' }
  | { type: 'RESET' }
  | { type: 'TOGGLE_PAUSE' }
  | { type: 'TICK'; dt: number; token: number }
  | { type: 'SELECT'; question: QuestionId; letter: OptionLetter }
  | { type: 'SUBMIT'; question: QuestionId }
  | { type: 'TOGGLE_CAPTIONS' }
  | { type: 'TOGGLE_READ_ALOUD' }
  | { type: 'TOGGLE_REDUCED_MOTION' }
  | { type: 'SYSTEM_REDUCED_MOTION'; reduce: boolean };

export const DEFAULT_PREFS: Prefs = {
  captions: true,
  reducedMotion: false,
  motionSource: 'system',
  readAloud: false,
};

export function initialState(prefs: Prefs = DEFAULT_PREFS): ShopState {
  return { started: false, chapter: 0, step: 0, elapsed: 0, paused: false, token: 0, answers: {}, prefs };
}

export function emptyProgress(): QuestionProgress {
  return { selected: null, tried: [], solved: false, result: null };
}

export function currentStep(state: ShopState): Step {
  return CHAPTERS[state.chapter].steps[state.step];
}

export function progressFor(state: ShopState, id: QuestionId): QuestionProgress {
  return state.answers[id] ?? emptyProgress();
}

export function sceneDuration(step: Step): number {
  return step.kind === 'scene' ? SCENES[step.scene].duration : 0;
}

export function isSceneFinished(state: ShopState): boolean {
  const step = currentStep(state);
  return step.kind === 'scene' && state.elapsed >= sceneDuration(step);
}

export function isLastStep(state: ShopState): boolean {
  return state.chapter === CHAPTERS.length - 1 && state.step === CHAPTERS[state.chapter].steps.length - 1;
}

/** Learner-controlled Next: always allowed on scenes, only after a correct answer on questions. */
export function canGoNext(state: ShopState): boolean {
  if (!state.started || isLastStep(state)) return false;
  const step = currentStep(state);
  return step.kind === 'scene' || progressFor(state, step.question).solved;
}

export function canGoBack(state: ShopState): boolean {
  return state.started && (state.chapter > 0 || state.step > 0);
}

export function canTogglePause(state: ShopState): boolean {
  return state.started && currentStep(state).kind === 'scene' && !isSceneFinished(state);
}

function moveTo(state: ShopState, chapter: number, step: number): ShopState {
  return { ...state, started: true, chapter, step, elapsed: 0, paused: false, token: state.token + 1 };
}

function clearChapterAnswers(state: ShopState, chapter: number): ShopState['answers'] {
  const answers = { ...state.answers };
  for (const step of CHAPTERS[chapter].steps) {
    if (step.kind === 'question') delete answers[step.question];
  }
  return answers;
}

export function reducer(state: ShopState, action: Action): ShopState {
  switch (action.type) {
    case 'START':
      if (state.started) return state;
      return moveTo(state, 0, 0);

    case 'NEXT': {
      if (!canGoNext(state)) return state;
      const steps = CHAPTERS[state.chapter].steps;
      return state.step + 1 < steps.length ? moveTo(state, state.chapter, state.step + 1) : moveTo(state, state.chapter + 1, 0);
    }

    case 'BACK': {
      if (!canGoBack(state)) return state;
      if (state.step > 0) return moveTo(state, state.chapter, state.step - 1);
      const prev = state.chapter - 1;
      return moveTo(state, prev, CHAPTERS[prev].steps.length - 1);
    }

    case 'GOTO_CHAPTER': {
      if (!Number.isInteger(action.index) || action.index < 0 || action.index >= CHAPTERS.length) return state;
      return moveTo(state, action.index, 0);
    }

    case 'REPLAY_CHAPTER': {
      if (!state.started) return state;
      return { ...moveTo(state, state.chapter, 0), answers: clearChapterAnswers(state, state.chapter) };
    }

    case 'RESET':
      return { ...initialState(state.prefs), token: state.token + 1 };

    case 'TOGGLE_PAUSE':
      if (!canTogglePause(state)) return state;
      return { ...state, paused: !state.paused };

    case 'TICK': {
      if (action.token !== state.token || !state.started || state.paused) return state;
      const step = currentStep(state);
      if (step.kind !== 'scene') return state;
      const duration = sceneDuration(step);
      if (state.elapsed >= duration) return state;
      const dt = Number.isFinite(action.dt) ? Math.max(0, action.dt) : 0;
      return { ...state, elapsed: Math.min(duration, state.elapsed + dt) };
    }

    case 'SELECT': {
      const step = currentStep(state);
      if (!state.started || step.kind !== 'question' || step.question !== action.question) return state;
      if (!QUESTIONS[action.question].options.some((o) => o.letter === action.letter)) return state;
      const prog = progressFor(state, action.question);
      if (prog.solved || prog.selected === action.letter) return state;
      return {
        ...state,
        answers: { ...state.answers, [action.question]: { ...prog, selected: action.letter, result: null } },
      };
    }

    case 'SUBMIT': {
      const step = currentStep(state);
      if (!state.started || step.kind !== 'question' || step.question !== action.question) return state;
      const prog = progressFor(state, action.question);
      if (prog.solved || prog.selected === null) return state;
      // A repeated check of the same choice (double-click, key repeat) changes nothing.
      if (prog.result && prog.result.letter === prog.selected) return state;
      const { correct, feedback } = checkAnswer(action.question, prog.selected);
      const tried = correct || prog.tried.includes(prog.selected) ? prog.tried : [...prog.tried, prog.selected];
      return {
        ...state,
        answers: {
          ...state.answers,
          [action.question]: { ...prog, tried, solved: correct, result: { letter: prog.selected, correct, feedback } },
        },
      };
    }

    case 'TOGGLE_CAPTIONS':
      return { ...state, prefs: { ...state.prefs, captions: !state.prefs.captions } };

    case 'TOGGLE_READ_ALOUD':
      return { ...state, prefs: { ...state.prefs, readAloud: !state.prefs.readAloud } };

    case 'TOGGLE_REDUCED_MOTION':
      return { ...state, prefs: { ...state.prefs, reducedMotion: !state.prefs.reducedMotion, motionSource: 'user' } };

    case 'SYSTEM_REDUCED_MOTION':
      if (state.prefs.motionSource === 'user' || state.prefs.reducedMotion === action.reduce) return state;
      return { ...state, prefs: { ...state.prefs, reducedMotion: action.reduce } };
  }
}
