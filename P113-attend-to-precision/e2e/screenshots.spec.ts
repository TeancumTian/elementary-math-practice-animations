import { expect, test } from '@playwright/test';
import { QUESTIONS, SCENES, correctLetter } from '../src/model/precision-model';
import { answer, feedback, goToQuestion, goToStep, openApp, stage } from './helpers';

/** Saves the initial, intermediate, and final states for visual review (see VERIFICATION.md). */
test('capture initial, intermediate, and final states', async ({ page }, info) => {
  test.setTimeout(120_000);
  const tag = info.project.name;
  const shot = (name: string) => page.screenshot({ path: `screenshots/${tag}-${name}.png`, fullPage: true });
  const noSideScroll = async () =>
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

  await page.clock.install();
  await openApp(page);
  await noSideScroll();
  await shot('1-initial');

  // Intermediate A: a question after one wrong try (specific feedback visible, answer not revealed).
  await goToQuestion(page, 'try-unit');
  const wrong = QUESTIONS['try-unit'].options.find((o) => o.letter !== correctLetter('try-unit'))!;
  await answer(page, 'try-unit', wrong.letter);
  await expect(feedback(page)).toContainText(wrong.feedback);
  await noSideScroll();
  await shot('2-intermediate-feedback');

  // Intermediate B: mid-animation, the balance tipping for 8 + 2 vs 10 + 3 (paused).
  await goToStep(page, 3, 2);
  await page.clock.runFor(8500);
  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(stage(page).locator('[data-relation="not equal"]')).toBeVisible();
  await noSideScroll();
  await shot('3-intermediate-balance');

  // Intermediate C: the repaired graph with the reading line.
  await goToStep(page, 2, 2);
  await page.clock.runFor(SCENES['repair-axis'].duration + 500);
  await noSideScroll();
  await shot('4-intermediate-graph-repaired');

  // Final: the wrap-up checklist after the transfer problem.
  await goToStep(page, 4, 3);
  await page.clock.runFor(SCENES.finale.duration + 500);
  await expect(stage(page).locator('[data-badge="done"]')).toBeVisible();
  await noSideScroll();
  await shot('5-final');
});
