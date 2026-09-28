'use client';

import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react';
import type { Question } from '@/lesson/script';
import { REVEAL_AFTER_ATTEMPTS, type AnswerState } from '@/lesson/player';

interface Props {
  question: Question;
  answer: AnswerState;
  promptRef: RefObject<HTMLElement | null>;
  onSubmit: (input: string) => void;
  onReveal: () => void;
  onContinue: () => void;
}

const MAX_DIGITS = 3;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

export function QuestionPanel({ question, answer, promptRef, onSubmit, onReveal, onContinue }: Props) {
  const resolved = answer.status !== 'unanswered';
  const canReveal = !resolved && answer.attempts >= REVEAL_AFTER_ATTEMPTS;
  const continueRef = useRef<HTMLButtonElement>(null);
  const wasResolved = useRef(resolved);

  // Move focus to "Continue" the moment the question is resolved, so Enter moves on.
  useEffect(() => {
    if (resolved && !wasResolved.current) continueRef.current?.focus();
    wasResolved.current = resolved;
  }, [resolved]);

  return (
    <section className={`question ${resolved ? 'is-resolved' : ''}`} aria-labelledby={`${question.id}-label`} data-question={question.id}>
      <p className="question-kicker" id={`${question.id}-label`}>
        <span aria-hidden="true">✎ </span>
        {question.kind === 'choice' ? 'Check the guess' : 'Your turn'}
      </p>
      {question.kind === 'number' ? (
        <NumberQuestion question={question} answer={answer} resolved={resolved} promptRef={promptRef} onSubmit={onSubmit} />
      ) : (
        <ChoiceQuestion question={question} answer={answer} resolved={resolved} promptRef={promptRef} onSubmit={onSubmit} />
      )}

      <div className={`feedback ${answer.feedback ? (answer.feedback.correct ? 'ok' : answer.feedback.attempt ? 'bad' : 'info') : ''}`} role="status" aria-live="polite" data-testid="feedback">
        {answer.feedback &&
          (answer.feedback.correct ? (
            <p>
              <span className="mark" aria-hidden="true">✓</span> {answer.feedback.message}
            </p>
          ) : answer.feedback.attempt ? (
            <p>
              <span className="mark" aria-hidden="true">✗</span> <strong>Not yet.</strong> {answer.feedback.message}
              {!resolved && <> Try again.</>}
            </p>
          ) : (
            <p>{answer.feedback.message}</p>
          ))}
        {answer.reveal && (
          <p className="reveal">
            <span className="mark" aria-hidden="true">👀</span> {answer.reveal}
          </p>
        )}
      </div>

      <div className="question-actions">
        {canReveal && (
          <button type="button" className="btn" onClick={onReveal}>
            Show me with the model
          </button>
        )}
        {resolved && (
          <button type="button" className="btn btn-primary" ref={continueRef} onClick={onContinue} data-testid="continue">
            Continue <span aria-hidden="true">▸</span>
          </button>
        )}
      </div>
    </section>
  );
}

function NumberQuestion({
  question,
  answer,
  resolved,
  promptRef,
  onSubmit,
}: {
  question: Extract<Question, { kind: 'number' }>;
  answer: AnswerState;
  resolved: boolean;
  promptRef: RefObject<HTMLElement | null>;
  onSubmit: (input: string) => void;
}) {
  const [draft, setDraft] = useState('');
  // Once resolved, show the learner's submitted answer from the lesson state.
  const value = resolved ? answer.input : draft;

  // Clear the box in the same event as the submit, so fast typing can never mix with the old answer.
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (resolved) return;
    onSubmit(draft);
    setDraft('');
  };
  const setValue = setDraft;
  const press = (k: string) => {
    if (resolved) return;
    setValue((v) => (v + k).slice(0, MAX_DIGITS));
  };

  const inputId = `${question.id}-input`;
  return (
    <form className="number-question" onSubmit={submit} noValidate>
      <p className="prompt" ref={promptRef as RefObject<HTMLParagraphElement>} tabIndex={-1} id={`${question.id}-prompt`}>
        {question.prompt}
      </p>
      <div className="answer-row">
        <label htmlFor={inputId}>Total</label>
        <input
          id={inputId}
          name="answer"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          maxLength={MAX_DIGITS}
          value={value}
          disabled={resolved}
          aria-describedby={`${question.id}-prompt`}
          onChange={(e) => setValue(e.target.value.replace(/[^0-9]/g, '').slice(0, MAX_DIGITS))}
        />
        <button type="submit" className="btn btn-primary" disabled={resolved}>
          Check
        </button>
      </div>
      <div className="keypad" role="group" aria-label="Number pad">
        {KEYS.map((k) => (
          <button key={k} type="button" className="key" onClick={() => press(k)} disabled={resolved}>
            {k}
          </button>
        ))}
        <button type="button" className="key key-wide" onClick={() => setValue((v) => v.slice(0, -1))} disabled={resolved} aria-label="Delete last digit">
          ⌫
        </button>
      </div>
    </form>
  );
}

function ChoiceQuestion({
  question,
  answer,
  resolved,
  promptRef,
  onSubmit,
}: {
  question: Extract<Question, { kind: 'choice' }>;
  answer: AnswerState;
  resolved: boolean;
  promptRef: RefObject<HTMLElement | null>;
  onSubmit: (input: string) => void;
}) {
  const [selected, setSelected] = useState(resolved ? answer.input : '');
  const [tried, setTried] = useState<string[]>([]);
  const attempts = useRef(answer.attempts);

  useEffect(() => {
    if (answer.attempts !== attempts.current) {
      attempts.current = answer.attempts;
      if (answer.status === 'unanswered' && answer.input) setTried((t) => (t.includes(answer.input) ? t : [...t, answer.input]));
    }
  }, [answer.attempts, answer.status, answer.input]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!resolved) onSubmit(selected);
  };

  return (
    <form className="choice-question" onSubmit={submit} noValidate>
      <fieldset disabled={resolved}>
        <legend className="prompt" ref={promptRef as RefObject<HTMLLegendElement>} tabIndex={-1}>
          {question.prompt}
        </legend>
        {question.options.map((o) => {
          const isTried = tried.includes(o.id);
          const isChosenCorrect = resolved && answer.status === 'correct' && answer.input === o.id;
          return (
            <label key={o.id} className={`choice ${selected === o.id ? 'selected' : ''} ${isTried ? 'tried' : ''}`}>
              <input type="radio" name={question.id} value={o.id} checked={selected === o.id} onChange={() => setSelected(o.id)} />
              <span className="choice-text">{o.text}</span>
              {isTried && <span className="choice-tag">✗ tried</span>}
              {isChosenCorrect && <span className="choice-tag ok">✓ your answer</span>}
            </label>
          );
        })}
      </fieldset>
      <button type="submit" className="btn btn-primary" disabled={resolved}>
        Check
      </button>
    </form>
  );
}
