import { forwardRef } from 'react';
import { QUESTIONS, correctLetter, type OptionLetter, type QuestionId } from '../model/precision-model';
import type { QuestionProgress } from '../state/shop-state';

interface QuestionPanelProps {
  id: QuestionId;
  progress: QuestionProgress;
  onSelect: (letter: OptionLetter) => void;
  onSubmit: () => void;
}

/**
 * Multiple choice with native radios. Nothing in the markup marks the right option
 * until the learner has submitted it: same classes, same attributes, no hints.
 */
export const QuestionPanel = forwardRef<HTMLHeadingElement, QuestionPanelProps>(function QuestionPanel(
  { id, progress, onSelect, onSubmit },
  headingRef,
) {
  const q = QUESTIONS[id];
  const solved = progress.solved;
  // Only computed after a correct submission, to label every option.
  const right = solved ? correctLetter(id) : null;
  const promptId = `${id}-prompt`;

  return (
    <section className="question" aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`} className="step-title" tabIndex={-1} ref={headingRef}>
        {q.stage}
      </h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <fieldset className="options">
          <legend id={promptId} className="prompt">
            {q.prompt}
          </legend>
          {q.options.map((o) => {
            const tried = progress.tried.includes(o.letter);
            const badgeId = `${id}-${o.letter}-badge`;
            let badge: string | null = null;
            let state = 'open';
            if (solved) {
              state = o.letter === right ? 'is-right' : 'is-wrong';
              badge = o.letter === right ? (o.claim.type === 'reason' ? '✓ Best answer' : '✓ Precise') : `✗ ${o.flaw}`;
            } else if (tried) {
              state = 'is-tried';
              badge = '✗ Not yet';
            }
            return (
              <div className="option" data-state={state} key={o.letter}>
                <label>
                  <input
                    type="radio"
                    name={id}
                    value={o.letter}
                    checked={progress.selected === o.letter}
                    disabled={solved}
                    onChange={() => onSelect(o.letter)}
                    aria-describedby={badge ? badgeId : undefined}
                  />
                  <span className="letter" aria-hidden="true">
                    {o.letter}
                  </span>
                  <span className="option-text">{o.text}</span>
                </label>
                {badge && (
                  <p className="badge" id={badgeId}>
                    {badge}
                  </p>
                )}
              </div>
            );
          })}
        </fieldset>
        <button type="submit" className="btn check" disabled={solved || progress.selected === null}>
          Check answer
        </button>
      </form>
      <div className="feedback" role="status" aria-live="polite" aria-atomic="true">
        {progress.result && (
          <p className={`msg ${progress.result.correct ? 'is-right' : 'is-wrong'}`}>
            <strong>{progress.result.correct ? '✓ Correct! ' : '✗ Not yet. '}</strong>
            {progress.result.feedback}
          </p>
        )}
      </div>
    </section>
  );
});
