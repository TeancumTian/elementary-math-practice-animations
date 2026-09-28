import { expect, test } from '@playwright/test';
import { SCENES } from '../src/model/precision-model';
import { caption, goToStep, nextButton, openApp, stage } from './helpers';

test.describe('prefers-reduced-motion: reduce', () => {
  test.use({ reducedMotion: 'reduce' });

  test('pictures jump to each caption’s finished state; nothing tweens', async ({ page }) => {
    await page.clock.install();
    await openApp(page);
    const toggle = page.getByRole('button', { name: 'Reduce motion' });
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await page.clock.runFor(200);
    await expect(stage(page)).toHaveAttribute('data-motion', 'reduced');
    await expect(stage(page)).toHaveAttribute('data-display-t', String(SCENES.intro.cues[0].end));

    await goToStep(page, 1, 2); // repair-unit
    const cues = SCENES['repair-unit'].cues;
    await page.clock.runFor(200);
    await expect(stage(page)).toHaveAttribute('data-display-t', String(cues[0].end));
    await expect(caption(page)).toHaveText(cues[0].text);

    // Just after the counting caption starts, all hops are already fully drawn (no motion).
    await page.clock.runFor(cues[1].start - 200 + 150);
    await expect(caption(page)).toHaveText(cues[1].text);
    await expect(stage(page)).toHaveAttribute('data-display-t', String(cues[1].end));
    const hopOpacities = await stage(page).locator('[data-hop]').evaluateAll((els) => els.map((e) => e.getAttribute('opacity')));
    expect(hopOpacities).toEqual(['1', '1', '1', '1', '1', '1', '1']);

    // Captions keep their normal timing.
    await page.clock.runFor(cues[1].end - cues[1].start);
    await expect(caption(page)).toHaveText(cues[2].text);

    // CSS animations are off (the Next "nudge" does not pulse).
    await page.clock.runFor(SCENES['repair-unit'].duration);
    await expect(page.getByTestId('scene-state')).toContainText('Finished');
    const anim = await nextButton(page).evaluate((el) => getComputedStyle(el).animationName);
    expect(anim).toBe('none');
  });
});

test('learners can switch reduced motion on and off', async ({ page }) => {
  await openApp(page);
  const toggle = page.getByRole('button', { name: 'Reduce motion' });
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(stage(page)).toHaveAttribute('data-motion', 'full');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(stage(page)).toHaveAttribute('data-motion', 'reduced');
  await toggle.click();
  await expect(stage(page)).toHaveAttribute('data-motion', 'full');
});
