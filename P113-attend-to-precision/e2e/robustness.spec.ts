import { expect, test } from '@playwright/test';
import { CHAPTERS, QUESTIONS, correctLetter } from '../src/model/precision-model';
import {
  caption,
  chapterButton,
  checkButton,
  elapsedMs,
  feedback,
  goToQuestion,
  goToStep,
  nextButton,
  openApp,
  radio,
  stage,
  trackErrors,
} from './helpers';

test('double-clicking Check records one attempt and one feedback message', async ({ page }) => {
  const errors = trackErrors(page);
  await openApp(page);
  await goToQuestion(page, 'predict-unit');
  const right = correctLetter('predict-unit');
  const wrong = QUESTIONS['predict-unit'].options.find((o) => o.letter !== right)!;

  await radio(page, 'predict-unit', wrong.letter).check();
  await checkButton(page).dblclick();
  await expect(page.locator('.feedback .msg')).toHaveCount(1);
  await expect(page.locator('.badge')).toHaveCount(1);
  await expect(feedback(page)).toContainText(wrong.feedback);

  await radio(page, 'predict-unit', right).check();
  await checkButton(page).dblclick();
  await expect(feedback(page)).toContainText('Correct!');
  // Still on the question: double-clicking Check never skips ahead.
  await expect(page.locator('legend.prompt')).toHaveText(QUESTIONS['predict-unit'].prompt);
  expect(errors).toEqual([]);
});

test('double-clicking Next on a scene cannot jump past a waiting question', async ({ page }) => {
  await openApp(page);
  await chapterButton(page, 1).click();
  await nextButton(page).dblclick();
  await expect(page.locator('legend.prompt')).toHaveText(QUESTIONS['predict-unit'].prompt);
  await expect(nextButton(page)).toBeDisabled();
});

test('key mashing leaves the app consistent and usable', async ({ page }) => {
  const errors = trackErrors(page);
  await openApp(page);
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  const mash = 'nnnnppppnbbrrnnpnpnnnrbbnnppnnnnnpbrnnnnn'.split('');
  for (const key of mash) await page.keyboard.press(key);
  for (let i = 0; i < 30; i += 1) await page.keyboard.press(i % 2 ? 'N' : 'n');

  await expect(page.locator('.stepper li[aria-current="step"]')).toHaveCount(1);
  await expect(stage(page)).toHaveAttribute('data-scene', /.+/);
  // N-mashing stops at the first unanswered question.
  await expect(page.locator('legend.prompt')).toHaveText(QUESTIONS['predict-unit'].prompt);
  await expect(nextButton(page)).toBeDisabled();

  // Still fully usable afterwards.
  await radio(page, 'predict-unit', correctLetter('predict-unit')).check();
  await checkButton(page).click();
  await expect(feedback(page)).toContainText('Correct!');
  expect(errors).toEqual([]);
});

test('navigating in the middle of an animation resets cleanly', async ({ page }) => {
  const errors = trackErrors(page);
  await openApp(page);
  await goToStep(page, 1, 2); // repair-unit animation
  await expect.poll(() => elapsedMs(page)).toBeGreaterThan(2500);

  await chapterButton(page, 3).click();
  await expect(stage(page)).toHaveAttribute('data-scene', 'look-equal');
  expect(await elapsedMs(page)).toBeLessThan(1500);
  await expect(page.locator('[data-ruler]')).toHaveCount(0);
  await expect(caption(page)).toHaveText(/Sam counted stickers/);

  // Pause mid-animation, then jump: the new scene plays from 0, unpaused.
  await page.getByRole('button', { name: 'Pause' }).click();
  await chapterButton(page, 2).click();
  await expect(stage(page)).toHaveAttribute('data-scene', 'look-axis');
  await expect(page.getByTestId('scene-state')).toContainText('Playing');
  await expect.poll(() => elapsedMs(page)).toBeGreaterThan(200);

  // Back from a chapter's first scene goes to the previous chapter's last step.
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.locator('legend.prompt')).toHaveText(QUESTIONS['try-unit'].prompt);
  expect(errors).toEqual([]);
});

test('a storm of chapter clicks ends on the last one clicked', async ({ page }) => {
  await openApp(page);
  const order = [3, 1, 4, 2, 0, 4, 1, 3, 2, 2, 4, 0, 1, 3];
  for (const i of order) await chapterButton(page, i).click({ delay: 0 });
  const last = order[order.length - 1];
  const first = CHAPTERS[last].steps[0];
  if (first.kind !== 'scene') throw new Error('chapters start with a scene');
  await expect(stage(page)).toHaveAttribute('data-scene', first.scene);
  await expect(chapterButton(page, last)).toHaveAttribute('aria-current', 'step');
  await expect(page.locator('nav[aria-label="Chapters"] [aria-current="step"]')).toHaveCount(1);
});

test('Start over resets everything to the first screen', async ({ page }) => {
  await openApp(page);
  await goToQuestion(page, 'try-unit');
  const wrong = QUESTIONS['try-unit'].options.find((o) => o.letter !== correctLetter('try-unit'))!;
  await radio(page, 'try-unit', wrong.letter).check();
  await checkButton(page).click();
  await expect(page.locator('.feedback .msg')).toBeVisible();

  await page.getByRole('button', { name: 'Start over' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome, fixer!' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeFocused();
  await expect(caption(page)).toHaveText('Press Start to open the shop.');
  await expect(page.locator('nav[aria-label="Chapters"] [aria-current="step"]')).toHaveCount(0);

  await goToStep(page, 1, 1);
  await expect(page.getByRole('radio', { checked: true })).toHaveCount(0);
  await expect(page.locator('.feedback .msg')).toHaveCount(0);
  await expect(nextButton(page)).toBeDisabled();
});
