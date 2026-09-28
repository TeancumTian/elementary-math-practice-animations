/**
 * lessonState.ts — the pure reducer that drives the whole experience.
 * Timestamps are passed in with actions, so the reducer stays deterministic and testable.
 */
import { ATTEMPTS_BEFORE_SHOW_ME, QUESTIONS, checkChoice, type QuestionId } from "./model";
import { BONUS_INDEX, BONUS_QUESTIONS, WRAP_INDEX, buildChapters, type Chapter, type Step } from "./lesson";
import { sceneDuration } from "./timeline";

export type AnswerStatus = "unanswered" | "incorrect" | "correct" | "revealed";

export interface AnswerState {
  status: AnswerStatus;
  /** Checked attempts (empty or repeated submissions don't count). */
  attempts: number;
  lastResponse: string | null;
  /** Distinct wrong responses, so each can be marked "not this one". */
  wrongResponses: string[];
  feedback: string | null;
  hintShown: boolean;
}

export interface LessonState {
  started: boolean;
  chapter: number;
  step: number;
  /** Milliseconds into the current scene. */
  elapsed: number;
  playing: boolean;
  /** Highest chapter index the learner has reached; chapters beyond it are locked. */
  furthest: number;
  answers: Partial<Record<QuestionId, AnswerState>>;
  /** When the current step began (for ignoring accidental double "Next"). */
  enteredAt: number;
  /** Increments on every navigation, so effects can react to "a new step began". */
  navId: number;
}

export type LessonAction =
  | { type: "start"; now: number }
  | { type: "tick"; dt: number }
  | { type: "togglePause" }
  | { type: "replay"; now: number }
  | { type: "next"; now: number }
  | { type: "goto"; chapter: number; now: number }
  | { type: "submit"; questionId: QuestionId; response: string }
  | { type: "showMe"; questionId: QuestionId }
  | { type: "hint"; questionId: QuestionId }
  | { type: "skipBonus"; now: number }
  | { type: "reset" };

/** Two "Next" presses closer together than this count as one (double-click, key repeat). */
export const NEXT_DEBOUNCE_MS = 400;

export const EMPTY_ANSWER: AnswerState = {
  status: "unanswered",
  attempts: 0,
  lastResponse: null,
  wrongResponses: [],
  feedback: null,
  hintShown: false,
};

export const initialLessonState: LessonState = {
  started: false,
  chapter: 0,
  step: 0,
  elapsed: 0,
  playing: false,
  furthest: 0,
  answers: {},
  enteredAt: 0,
  navId: 0,
};

export function isResolved(a: AnswerState | undefined): boolean {
  return a?.status === "correct" || a?.status === "revealed";
}

export function bonusDone(state: LessonState): boolean {
  return BONUS_QUESTIONS.every((q) => isResolved(state.answers[q]));
}

export function chaptersFor(state: LessonState): Chapter[] {
  return buildChapters({ bonusDone: bonusDone(state) });
}

export function currentStep(state: LessonState): Step {
  return chaptersFor(state)[state.chapter].steps[state.step];
}

export function isUnlocked(state: LessonState, chapter: number): boolean {
  return chapter >= 0 && chapter <= state.furthest;
}

/** Can the learner move on? Questions wait for a correct (or shown) answer. */
export function canAdvance(state: LessonState): boolean {
  if (!state.started) return false;
  const chapters = chaptersFor(state);
  const step = chapters[state.chapter].steps[state.step];
  if (step.kind === "question" && !isResolved(state.answers[step.questionId])) return false;
  const lastChapter = state.chapter === chapters.length - 1;
  const lastStep = state.step === chapters[state.chapter].steps.length - 1;
  return !(lastChapter && lastStep);
}

export function sceneFinished(state: LessonState): boolean {
  const step = currentStep(state);
  return step.kind === "scene" && state.elapsed >= sceneDuration(step.beats);
}

function enter(state: LessonState, chapter: number, step: number, now: number): LessonState {
  const target = chaptersFor(state)[chapter].steps[step];
  return {
    ...state,
    chapter,
    step,
    elapsed: 0,
    playing: target.kind === "scene",
    furthest: Math.max(state.furthest, chapter),
    enteredAt: now,
    navId: state.navId + 1,
  };
}

export function lessonReducer(state: LessonState, action: LessonAction): LessonState {
  switch (action.type) {
    case "start":
      if (state.started) return state;
      return enter({ ...state, started: true }, 0, 0, action.now);

    case "reset":
      return { ...initialLessonState, navId: state.navId + 1 };

    case "tick": {
      if (!state.started || !state.playing || action.dt <= 0) return state;
      const step = currentStep(state);
      if (step.kind !== "scene") return { ...state, playing: false };
      const total = sceneDuration(step.beats);
      const elapsed = Math.min(total, state.elapsed + action.dt);
      return { ...state, elapsed, playing: elapsed < total };
    }

    case "togglePause": {
      if (!state.started) return state;
      const step = currentStep(state);
      if (step.kind !== "scene" || state.elapsed >= sceneDuration(step.beats)) return state;
      return { ...state, playing: !state.playing };
    }

    case "replay": {
      if (!state.started) return state;
      const step = currentStep(state);
      // On a scene: replay that scene. On a question: replay the chapter from its start.
      return step.kind === "scene" ? enter(state, state.chapter, state.step, action.now) : enter(state, state.chapter, 0, action.now);
    }

    case "next": {
      if (!canAdvance(state)) return state;
      if (action.now - state.enteredAt < NEXT_DEBOUNCE_MS) return state;
      const chapters = chaptersFor(state);
      if (state.step < chapters[state.chapter].steps.length - 1) return enter(state, state.chapter, state.step + 1, action.now);
      return enter(state, state.chapter + 1, 0, action.now);
    }

    case "goto": {
      if (!state.started || !isUnlocked(state, action.chapter)) return state;
      return enter(state, action.chapter, 0, action.now);
    }

    case "skipBonus": {
      if (!state.started || state.chapter !== BONUS_INDEX) return state;
      return enter(state, WRAP_INDEX, 0, action.now);
    }

    case "submit": {
      const step = currentStep(state);
      if (!state.started || step.kind !== "question" || step.questionId !== action.questionId) return state;
      const q = QUESTIONS[action.questionId];
      const prev = state.answers[action.questionId] ?? EMPTY_ANSWER;
      if (isResolved(prev)) return state;
      const response = action.response.trim();
      // Re-checking the same wrong answer (double-click, Enter mashing) is not a new attempt.
      if (prev.status === "incorrect" && response === prev.lastResponse) return state;

      let correct: boolean;
      let feedback: string;
      if (q.kind === "number") {
        const result = q.check(response);
        if (!result.valid) {
          return { ...state, answers: { ...state.answers, [q.id]: { ...prev, feedback: result.feedback } } };
        }
        correct = result.correct;
        feedback = result.feedback;
      } else {
        if (!q.choices.some((c) => c.id === response)) {
          return { ...state, answers: { ...state.answers, [q.id]: { ...prev, feedback: "Pick one answer, then press Check." } } };
        }
        ({ correct, feedback } = checkChoice(q, response));
      }
      const next: AnswerState = {
        ...prev,
        status: correct ? "correct" : "incorrect",
        attempts: prev.attempts + 1,
        lastResponse: response,
        wrongResponses: correct || prev.wrongResponses.includes(response) ? prev.wrongResponses : [...prev.wrongResponses, response],
        feedback,
      };
      // A resolved answer re-arms Next immediately: the double-press guard only protects against repeated Next presses.
      return { ...state, answers: { ...state.answers, [q.id]: next }, enteredAt: correct ? Number.NEGATIVE_INFINITY : state.enteredAt };
    }

    case "showMe": {
      const prev = state.answers[action.questionId];
      if (!prev || isResolved(prev) || prev.attempts < ATTEMPTS_BEFORE_SHOW_ME) return state;
      const q = QUESTIONS[action.questionId];
      return {
        ...state,
        answers: { ...state.answers, [q.id]: { ...prev, status: "revealed", feedback: q.reveal } },
        enteredAt: Number.NEGATIVE_INFINITY,
      };
    }

    case "hint": {
      const prev = state.answers[action.questionId] ?? EMPTY_ANSWER;
      if (prev.hintShown) return state;
      return { ...state, answers: { ...state.answers, [action.questionId]: { ...prev, hintShown: true } } };
    }
  }
}
