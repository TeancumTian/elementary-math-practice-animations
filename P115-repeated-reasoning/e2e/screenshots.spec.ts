import { expect, test } from '@playwright/test';
import { advanceTo, answerNumber, clickNext, goToChapter, lesson, openLesson, startStory, waitHolding } from './helpers';

/**
 * Captures the initial, intermediate, and final states at the project's
 * viewport (desktop 1280×800, mobile 390×844) into screenshots/.
 * Reduced motion makes every state land exactly on its final frame.
 */
test.describe('state screenshots', () => {
  test.use({ reducedMotion: 'reduce' });

  test('initial, intermediate, and final states', async ({ page, isMobile }, info) => {
    const shot = (name: string) =>
      page.screenshot({ path: `screenshots/${info.project.name}-${name}.png`, fullPage: isMobile });

    await openLesson(page, 20);
    await shot('01-initial-title');

    await startStory(page);
    await advanceTo(page, 'c1-gate3');
    await waitHolding(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot('02-intermediate-building');

    await goToChapter(page, 2);
    await advanceTo(page, 'c2-predict');
    await waitHolding(page);
    await answerNumber(page, '24');
    await expect(page.getByTestId('feedback')).toContainText('only 4 more than 20');
    await shot('03-intermediate-predict-feedback');

    await goToChapter(page, 4);
    await advanceTo(page, 'c4-check');
    await page.getByLabel('No. 24 is only 4 more than 20, but one more crate adds 5.').check();
    await page.getByRole('button', { name: 'Check', exact: true }).click();
    await page.getByTestId('continue').click();
    await advanceTo(page, 'c4-gate5');
    await waitHolding(page);
    await page.waitForTimeout(350); // let the double-click guard expire
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('n'); // pack crate 5 …
    await page.keyboard.press('Space'); // … and freeze on "stop at 24?"
    await expect(lesson(page)).toHaveAttribute('data-beat', 'c4-count');
    await expect(lesson(page)).toHaveAttribute('data-playing', 'false');
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot('04-intermediate-pip-check');

    await page.getByTestId('play-pause').click(); // resume
    await advanceTo(page, 'c4-monitor');
    await answerNumber(page, '30');
    await page.getByTestId('continue').click();
    await advanceTo(page, 'c4-reason');
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot('05-intermediate-six-crates');

    await goToChapter(page, 5);
    await advanceTo(page, 'c5-ask');
    await answerNumber(page, '35');
    await page.getByTestId('continue').click();
    await advanceTo(page, 'c5-finale');
    await expect(lesson(page)).toHaveAttribute('data-complete', 'true');
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot('06-final');
  });
});

test.describe('mid-animation screenshot', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('apples falling into crate 2', async ({ page, isMobile }, info) => {
    await openLesson(page, 2);
    await goToChapter(page, 1);
    await advanceTo(page, 'c1-gate2');
    await waitHolding(page);
    await clickNext(page); // start filling crate 2
    await expect.poll(async () => Number(await lesson(page).getAttribute('data-elapsed')), { intervals: [50] }).toBeGreaterThan(1150);
    await page.getByTestId('play-pause').click(); // freeze mid-drop
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `screenshots/${info.project.name}-07-mid-animation.png`, fullPage: isMobile });
  });
});
