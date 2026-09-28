import { expect, test, type Page } from '@playwright/test';
import {
  ERASER,
  PENCIL,
  QUESTIONS,
  QUESTION_IDS,
  RIBBON_MESSAGES,
  SHELL_MESSAGES,
  correctLetter,
  formatChain,
  formatLength,
  fruit,
  type QuestionId,
} from '../src/model/precision-model';

/** Phrases that would give an answer away if they appeared anywhere outside the option labels. */
const REVEALS: Record<QuestionId, string[]> = {
  'predict-unit': [formatLength(PENCIL.lengthCm)],
  'explain-unit': [],
  'try-unit': [formatLength(ERASER.lengthCm)],
  'predict-axis': ['skip', 'missing'],
  'explain-axis': [],
  'try-axis': [`${fruit('grapes').count} students`],
  'predict-equal': ['not equal', 'tips', 'in all'],
  'explain-equal': [],
  'try-equal': [formatChain(SHELL_MESSAGES.repaired[0]), formatChain(SHELL_MESSAGES.repaired[1])],
  transfer: [formatLength(RIBBON_MESSAGES.total), formatChain(RIBBON_MESSAGES.repaired[1]), 'PRECISE'],
};
import { answer, goToQuestion, openApp } from './helpers';

interface LeakReport {
  textNodesWithAnswer: { text: string; inOptionLabel: boolean }[];
  textNodesWithSuccess: string[];
  attributesWithAnswer: string[];
  liveRegionsWithAnswer: string[];
  suspiciousMarkers: number;
  optionSignatures: string[];
  revealsOutsideOptions: string[];
}

async function leakReport(page: Page, id: QuestionId): Promise<LeakReport> {
  const q = QUESTIONS[id];
  const right = q.options.find((o) => o.letter === correctLetter(id))!;
  return page.evaluate(
    ({ answerText, success, reveals }) => {
      const revealsOutsideOptions: string[] = [];
      const textNodesWithAnswer: { text: string; inOptionLabel: boolean }[] = [];
      const textNodesWithSuccess: string[] = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const text = n.textContent ?? '';
        if (text.includes(answerText)) {
          textNodesWithAnswer.push({ text, inOptionLabel: !!n.parentElement?.closest('.option label') });
        }
        if (text.includes(success)) textNodesWithSuccess.push(text);
        if (!n.parentElement?.closest('.option label')) {
          for (const r of reveals) if (text.includes(r)) revealsOutsideOptions.push(`${r} in “${text}”`);
        }
      }
      const attributesWithAnswer: string[] = [];
      for (const el of document.querySelectorAll('*')) {
        // Attributes that browsers or assistive tech can turn into text (not class names or geometry).
        const exposed = el.getAttributeNames().filter((n) => /^(aria-|data-)/.test(n) || ['title', 'alt', 'value', 'label', 'placeholder'].includes(n));
        for (const name of exposed) {
          const v = el.getAttribute(name) ?? '';
          if (v.includes(answerText) || v.includes(success)) attributesWithAnswer.push(`${el.tagName}[${name}]`);
          for (const r of reveals) if (v.includes(r)) revealsOutsideOptions.push(`${r} in ${el.tagName}[${name}]`);
        }
      }
      const live = [...document.querySelectorAll('[aria-live], [role="status"], [role="alert"]')].map((e) => e.textContent ?? '');
      const suspiciousMarkers = document.querySelectorAll(
        '[class*="correct" i], [data-correct], [data-answer], [data-right], [aria-label*="correct" i], [aria-label*="answer" i]',
      ).length;
      const optionSignatures = [...document.querySelectorAll('.option')].map((el) => {
        const input = el.querySelector('input')!;
        return JSON.stringify({
          cls: el.className,
          state: el.getAttribute('data-state'),
          inputAttrs: input.getAttributeNames().sort(),
          label: el.querySelector('label')!.className,
          badge: el.querySelector('.badge')?.textContent ?? null,
        });
      });
      return {
        textNodesWithAnswer,
        textNodesWithSuccess,
        attributesWithAnswer,
        liveRegionsWithAnswer: live.filter((t) => t.includes(answerText) || t.includes(success)),
        suspiciousMarkers,
        optionSignatures,
        revealsOutsideOptions,
      };
    },
    { answerText: right.text, success: q.success, reveals: REVEALS[id] },
  );
}

function expectNoLeak(report: LeakReport, optionCount: number, allSame: boolean) {
  // The right option's words appear once: inside its own option label, like every other option.
  expect(report.textNodesWithAnswer).toHaveLength(1);
  expect(report.textNodesWithAnswer[0].inOptionLabel).toBe(true);
  expect(report.textNodesWithSuccess).toEqual([]);
  expect(report.attributesWithAnswer).toEqual([]);
  expect(report.liveRegionsWithAnswer).toEqual([]);
  expect(report.suspiciousMarkers).toBe(0);
  expect(report.revealsOutsideOptions).toEqual([]);
  expect(report.optionSignatures).toHaveLength(optionCount);
  if (allSame) expect(new Set(report.optionSignatures).size).toBe(1);
}

for (const id of QUESTION_IDS) {
  test(`${id}: no answer leak in text, aria, or live regions before a correct submission`, async ({ page }) => {
    await openApp(page);
    await goToQuestion(page, id);
    const q = QUESTIONS[id];
    const right = correctLetter(id);

    expectNoLeak(await leakReport(page, id), q.options.length, true);

    // A wrong submission must not reveal the right option either.
    const wrong = q.options.find((o) => o.letter !== right)!;
    await answer(page, id, wrong.letter);
    await expect(page.locator('.feedback .msg')).toBeVisible();
    const after = await leakReport(page, id);
    expectNoLeak(after, q.options.length, false);
    const rightSig = after.optionSignatures[q.options.findIndex((o) => o.letter === right)];
    const untried = after.optionSignatures.filter((_, i) => q.options[i].letter !== wrong.letter);
    expect(untried.every((s) => s === rightSig)).toBe(true);
  });
}
