import { expect, test } from '@playwright/test';
import { QUESTIONS, correctLetter } from '../src/model/precision-model';
import { chapterButton, checkButton, elapsedMs, feedback, nextButton, openApp, optionText, stage, trackErrors } from './helpers';

test('touch: tap to start, answer, get feedback, and control playback', async ({ page }) => {
  const errors = trackErrors(page);
  await openApp(page);
  await page.getByRole('button', { name: 'Start', exact: true }).tap();
  await expect(stage(page)).toHaveAttribute('data-scene', 'intro');

  await chapterButton(page, 1).tap();
  await expect(stage(page)).toHaveAttribute('data-scene', 'look-unit');
  await nextButton(page).tap();

  const q = 'predict-unit';
  const right = correctLetter(q);
  const wrong = QUESTIONS[q].options.find((o) => o.letter !== right)!;
  await page.getByText(wrong.text, { exact: true }).tap();
  await expect(page.locator(`.options input[value="${wrong.letter}"]`)).toBeChecked();
  await checkButton(page).tap();
  await expect(feedback(page)).toContainText(wrong.feedback);

  await page.getByText(optionText(q, right), { exact: true }).tap();
  await checkButton(page).tap();
  await expect(feedback(page)).toContainText('Correct!');
  await nextButton(page).tap();
  await expect(stage(page)).toHaveAttribute('data-scene', 'repair-unit');

  await expect.poll(() => elapsedMs(page)).toBeGreaterThan(300);
  await page.getByRole('button', { name: 'Pause' }).tap();
  const frozen = await elapsedMs(page);
  await page.waitForTimeout(600);
  expect(await elapsedMs(page)).toBe(frozen);
  await page.getByRole('button', { name: 'Resume' }).tap();
  await expect.poll(() => elapsedMs(page)).toBeGreaterThan(frozen);

  await page.getByRole('button', { name: 'Replay chapter' }).tap();
  await expect(stage(page)).toHaveAttribute('data-scene', 'look-unit');
  expect(errors).toEqual([]);
});

test('touch targets are at least 44px tall', async ({ page }) => {
  await openApp(page);
  await chapterButton(page, 1).tap();
  await nextButton(page).tap();
  const small = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('button, .option label, a.skip-link:focus')]
      .filter((el) => el.offsetParent !== null)
      .map((el) => ({ text: (el.textContent ?? '').trim(), h: el.getBoundingClientRect().height }))
      .filter((b) => b.h < 44),
  );
  expect(small).toEqual([]);
});
