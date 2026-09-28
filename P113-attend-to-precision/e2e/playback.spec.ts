import { expect, test } from '@playwright/test';
import { CHAPTERS, SCENES, correctLetter } from '../src/model/precision-model';
import {
  answerCorrectly,
  caption,
  chapterButton,
  checkButton,
  elapsedMs,
  goToStep,
  nextButton,
  openApp,
  progressBar,
  stage,
  trackErrors,
} from './helpers';

test.describe('start, pause/resume, replay, chapters', () => {
  test('initial screen waits for Start, then the intro plays with captions', async ({ page }) => {
    const errors = trackErrors(page);
    await openApp(page);
    await expect(page.getByRole('heading', { name: 'Welcome, fixer!' })).toBeVisible();
    await expect(stage(page)).toHaveAttribute('data-scene', 'intro');
    await expect(progressBar(page)).toHaveCount(0);
    await expect(nextButton(page)).toHaveCount(0);
    await expect(caption(page)).toHaveText('Press Start to open the shop.');

    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await expect(caption(page)).toHaveText(SCENES.intro.cues[0].text);
    await expect(page.getByTestId('scene-state')).toContainText('Playing');
    await expect.poll(() => elapsedMs(page)).toBeGreaterThan(300);
    await expect(nextButton(page)).toBeFocused();
    expect(errors).toEqual([]);
  });

  test('pause freezes the animation; resume continues it', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await expect.poll(() => elapsedMs(page)).toBeGreaterThan(500);

    await page.getByRole('button', { name: 'Pause' }).click();
    await expect(page.getByTestId('scene-state')).toContainText('Paused');
    const frozen = await elapsedMs(page);
    const frozenT = await stage(page).getAttribute('data-display-t');
    await page.waitForTimeout(1200);
    expect(await elapsedMs(page)).toBe(frozen);
    expect(await stage(page).getAttribute('data-display-t')).toBe(frozenT);

    await page.getByRole('button', { name: 'Resume' }).click();
    await expect(page.getByTestId('scene-state')).toContainText('Playing');
    await expect.poll(() => elapsedMs(page)).toBeGreaterThan(frozen + 300);
  });

  test('a finished scene waits for the learner instead of auto-advancing', async ({ page }) => {
    await page.clock.install();
    await openApp(page);
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await page.clock.runFor(SCENES.intro.duration + 2000);
    await expect(page.getByTestId('scene-state')).toContainText('Finished');
    await expect(stage(page)).toHaveAttribute('data-scene', 'intro');
    await expect(caption(page)).toHaveText(SCENES.intro.cues.at(-1)!.text);
    await expect(page.getByRole('button', { name: 'Pause' })).toBeDisabled();
    await nextButton(page).click();
    await expect(stage(page)).toHaveAttribute('data-scene', 'look-unit');
  });

  test('questions wait: Next stays disabled until a correct answer is checked', async ({ page }) => {
    await openApp(page);
    await goToStep(page, 1, 1);
    await expect(nextButton(page)).toBeDisabled();
    await expect(checkButton(page)).toBeDisabled();
    await page.waitForTimeout(1500);
    await expect(page.locator('legend.prompt')).toBeVisible();
    await answerCorrectly(page, 'predict-unit');
    await expect(nextButton(page)).toBeEnabled();
    await expect(nextButton(page)).toBeFocused();
  });

  test('Replay chapter restarts the chapter and clears only its answers', async ({ page }) => {
    await openApp(page);
    await goToStep(page, 2, 2); // answers predict-axis
    await goToStep(page, 1, 2); // answers predict-unit, now in the repair animation
    await expect.poll(() => elapsedMs(page)).toBeGreaterThan(300);

    await page.getByRole('button', { name: 'Replay chapter' }).click();
    await expect(stage(page)).toHaveAttribute('data-scene', 'look-unit');
    expect(await elapsedMs(page)).toBeLessThan(1500);
    await nextButton(page).click();
    await expect(page.getByRole('radio', { checked: true })).toHaveCount(0);
    await expect(page.locator('.feedback .msg')).toHaveCount(0);
    await expect(nextButton(page)).toBeDisabled();

    // Chapter 2's answer survives.
    await chapterButton(page, 2).click();
    await nextButton(page).click();
    await expect(page.getByRole('radio', { checked: true })).toHaveCount(1);
    await expect(page.locator('.feedback')).toContainText('Correct!');
  });

  test('chapter navigation jumps to the start of every chapter', async ({ page }) => {
    await openApp(page);
    for (const [i, ch] of CHAPTERS.entries()) {
      await chapterButton(page, i).click();
      await expect(chapterButton(page, i)).toHaveAttribute('aria-current', 'step');
      const first = ch.steps[0];
      if (first.kind !== 'scene') throw new Error('chapters start with a scene');
      await expect(stage(page)).toHaveAttribute('data-scene', first.scene);
      await expect(page.locator('.stepper li[aria-current="step"]')).toHaveText(first.stage);
      await expect(page.locator('.stepper li')).toHaveCount(ch.steps.length);
    }
  });

  test('Back returns to the previous step and keeps a solved answer', async ({ page }) => {
    await openApp(page);
    await goToStep(page, 1, 2);
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.locator('legend.prompt')).toBeVisible();
    await expect(page.getByRole('radio', { checked: true })).toHaveCount(1);
    await expect(page.getByRole('radio', { checked: true })).toHaveAttribute('value', correctLetter('predict-unit'));
    await expect(nextButton(page)).toBeEnabled();
  });

  test('captions can be hidden and shown', async ({ page }) => {
    await openApp(page);
    const toggle = page.getByRole('button', { name: 'Captions' });
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(caption(page)).toBeVisible();
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(caption(page)).toHaveClass(/sr-only/);
    await toggle.click();
    await expect(caption(page)).not.toHaveClass(/sr-only/);
  });
});
