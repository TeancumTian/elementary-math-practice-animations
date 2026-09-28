"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ATTEMPTS_BEFORE_SHOW_ME, type ChoiceQuestion, type NumberQuestion, type Question } from "@/lib/model";
import type { AnswerState } from "@/lib/lessonState";
import { Icon } from "./Icon";

interface Props {
  question: Question;
  answer: AnswerState;
  onSubmit: (response: string) => void;
  onShowMe: () => void;
  onHint: () => void;
}

const LETTERS = ["A", "B", "C", "D"];

function Feedback({ answer }: { answer: AnswerState }) {
  const { status, feedback } = answer;
  const ref = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  // New feedback scrolls into view (clear of the sticky playback bar on phones); nothing moves if it is already visible.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (feedback) ref.current?.scrollIntoView({ block: "nearest" });
  }, [feedback, answer.attempts, status]);
  let heading: string | null = null;
  let icon: "check" | "cross" | "bulb" | null = null;
  if (feedback && status === "correct") {
    heading = "Correct!";
    icon = "check";
  } else if (feedback && status === "revealed") {
    heading = "Here's how it works";
    icon = "bulb";
  } else if (feedback && status === "incorrect") {
    heading = "Not yet. Here's a clue:";
    icon = "cross";
  } else if (feedback) {
    heading = "Almost ready";
    icon = "bulb";
  }
  // The live region is always in the page (empty until the learner checks) so screen readers announce the result.
  return (
    <div ref={ref} className={`feedback feedback-${status}`} role="status" aria-live="polite" data-testid="feedback" data-status={status}>
      {feedback && heading && icon && (
        <>
          <p className="feedback-heading">
            <Icon name={icon} /> {heading}
          </p>
          <p className="feedback-text">{feedback}</p>
        </>
      )}
    </div>
  );
}

function ShowMe({ answer, onShowMe }: { answer: AnswerState; onShowMe: () => void }) {
  const resolved = answer.status === "correct" || answer.status === "revealed";
  if (resolved || answer.attempts < ATTEMPTS_BEFORE_SHOW_ME) return null;
  return (
    <button type="button" className="btn btn-quiet" onClick={onShowMe} data-testid="show-me">
      <Icon name="bulb" /> Show me how
    </button>
  );
}

function ChoiceCard({ question, answer, onSubmit, onShowMe }: Props & { question: ChoiceQuestion }) {
  const resolved = answer.status === "correct" || answer.status === "revealed";
  const [selected, setSelected] = useState<string>(answer.lastResponse ?? "");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(selected);
  };

  return (
    <form className="question" onSubmit={submit} data-testid="question" data-question={question.id}>
      <fieldset disabled={resolved}>
        <legend id="q-legend" tabIndex={-1} className="question-prompt">
          {question.prompt}
        </legend>
        <div className="choices">
          {question.choices.map((c, i) => {
            const tried = answer.wrongResponses.includes(c.id);
            const isAnswer = resolved && c.id === question.correctId;
            return (
              <label key={c.id} className={`choice ${selected === c.id ? "selected" : ""} ${tried ? "tried" : ""} ${isAnswer ? "answer" : ""}`}>
                <input type="radio" name={question.id} value={c.id} checked={selected === c.id} onChange={() => setSelected(c.id)} />
                <span className="choice-letter" aria-hidden="true">
                  {LETTERS[i]}
                </span>
                <span className="choice-text">{c.text}</span>
                {tried && (
                  <span className="choice-mark mark-wrong">
                    <Icon name="cross" size={16} /> not this one
                  </span>
                )}
                {isAnswer && (
                  <span className="choice-mark mark-right">
                    <Icon name="check" size={16} /> answer
                  </span>
                )}
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="question-actions">
        {!resolved && (
          <button type="submit" className="btn btn-check" data-testid="check">
            <Icon name="check" /> Check my answer
          </button>
        )}
        <ShowMe answer={answer} onShowMe={onShowMe} />
      </div>
      <Feedback answer={answer} />
    </form>
  );
}

const PAD = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

function NumberCard({ question, answer, onSubmit, onShowMe, onHint }: Props & { question: NumberQuestion }) {
  const resolved = answer.status === "correct" || answer.status === "revealed";
  const [value, setValue] = useState<string>(answer.status === "correct" ? (answer.lastResponse ?? "") : "");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(value);
  };
  const type = (d: string) => setValue((v) => (v + d).slice(0, 4));

  return (
    <form className="question" onSubmit={submit} data-testid="question" data-question={question.id}>
      <p id="q-legend" tabIndex={-1} className="question-prompt">
        {question.prompt}
      </p>
      <p className="equation-big" aria-hidden="true">
        {question.equation}
      </p>
      <div className="answer-row">
        <label htmlFor="answer-input" className="answer-label">
          Your answer
        </label>
        <input
          id="answer-input"
          className="answer-input"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          maxLength={4}
          value={value}
          disabled={resolved}
          aria-describedby="q-legend"
          onChange={(e) => setValue(e.target.value.replace(/\D/g, "").slice(0, 4))}
          data-testid="answer-input"
        />
      </div>
      <div className="keypad" role="group" aria-label="Number pad">
        {PAD.map((d) => (
          <button key={d} type="button" className="key" disabled={resolved} onClick={() => type(d)}>
            {d}
          </button>
        ))}
        <button type="button" className="key key-small" disabled={resolved} onClick={() => setValue("")} aria-label="Clear answer">
          Clear
        </button>
        <button type="button" className="key" disabled={resolved} onClick={() => type("0")}>
          0
        </button>
        <button type="button" className="key key-small" disabled={resolved} onClick={() => setValue((v) => v.slice(0, -1))} aria-label="Delete last digit">
          ⌫
        </button>
      </div>
      <div className="question-actions">
        {!resolved && (
          <button type="submit" className="btn btn-check" data-testid="check">
            <Icon name="check" /> Check my answer
          </button>
        )}
        {!resolved && !answer.hintShown && (
          <button type="button" className="btn btn-quiet" onClick={onHint} data-testid="hint">
            <Icon name="bulb" /> Need a hint?
          </button>
        )}
        <ShowMe answer={answer} onShowMe={onShowMe} />
      </div>
      {answer.hintShown && !resolved && (
        <p className="hint" data-testid="hint-text">
          <strong>Hint:</strong> {question.hint}
        </p>
      )}
      <Feedback answer={answer} />
    </form>
  );
}

export function QuestionCard(props: Props) {
  const { question } = props;
  return question.kind === "choice" ? <ChoiceCard {...props} question={question} /> : <NumberCard {...props} question={question} />;
}
