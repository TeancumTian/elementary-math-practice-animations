import { expect, type Page } from '@playwright/test';
import {
  CHAPTERS,
  QUESTIONS,
  correctLetter,
  type OptionLetter,
  type QuestionId,
} from '../src/model/precision-model';

export const chapterNav = (page: Page) => page.getByRole('navigation', { name: 'Chapters' });
export const chapterButton = (page: Page, index: number) => chapterNav(page).getByRole('button').nth(index);
export const nextButton = (page: Page) => page.getByRole('button', { name: 'Next', exact: true });
export const checkButton = (page: Page) => page.getByRole('button', { name: 'Check answer' });
export const stage = (page: Page) => page.locator('figure.stage');
export const feedback = (page: Page) => page.locator('.feedback');
export const caption = (page: Page) => page.getByTestId('caption');
export const progressBar = (page: Page) => page.getByRole('progressbar', { name: 'Animation progress' });

export function optionText(q: QuestionId, letter: OptionLetter): string {
  const o = QUESTIONS[q].options.find((opt) => opt.letter === letter);
  if (!o) throw new Error(`No option ${letter} in ${q}`);
  return o.text;
}

export const radio = (page: Page, q: QuestionId, letter: OptionLetter) =>
  page.getByRole('radio', { name: optionText(q, letter), exact: true });

export async function openApp(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeVisible();
}

export async function sceneOf(page: Page) {
  return stage(page).getAttribute('data-scene');
}

export async function elapsedMs(page: Page): Promise<number> {
  return Number(await progressBar(page).getAttribute('data-elapsed'));
}

export async function answer(page: Page, q: QuestionId, letter: OptionLetter) {
  await radio(page, q, letter).check();
  await checkButton(page).click();
}

export async function answerCorrectly(page: Page, q: QuestionId) {
  await answer(page, q, correctLetter(q));
  await expect(feedback(page)).toContainText('Correct!');
}

export function locate(q: QuestionId): { chapter: number; step: number } {
  for (let c = 0; c < CHAPTERS.length; c += 1) {
    const s = CHAPTERS[c].steps.findIndex((st) => st.kind === 'question' && st.question === q);
    if (s >= 0) return { chapter: c, step: s };
  }
  throw new Error(`Question ${q} not found`);
}

/** Jump to a chapter and walk to a step, skipping scenes and answering earlier questions correctly. */
export async function goToStep(page: Page, chapter: number, step: number) {
  await chapterButton(page, chapter).click();
  for (let i = 0; i < step; i += 1) {
    const st = CHAPTERS[chapter].steps[i];
    if (st.kind === 'question') {
      await expect(page.getByRole('radio').first()).toBeVisible();
      const solved = await page.locator('.feedback .is-right').count();
      if (!solved) await answerCorrectly(page, st.question);
    }
    await nextButton(page).click();
  }
  const target = CHAPTERS[chapter].steps[step];
  if (target.kind === 'scene') await expect(stage(page)).toHaveAttribute('data-scene', target.scene);
  else await expect(page.locator('legend.prompt')).toHaveText(QUESTIONS[target.question].prompt);
}

export async function goToQuestion(page: Page, q: QuestionId) {
  const { chapter, step } = locate(q);
  await goToStep(page, chapter, step);
}

/** Collects console errors and uncaught page errors for a test. */
export function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}
