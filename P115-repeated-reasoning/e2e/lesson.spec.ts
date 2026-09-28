import { expect, test } from '@playwright/test';
import {
  advanceTo,
  answerNumber,
  beatId,
  caption,
  clickNext,
  collectErrors,
  feedback,
  goToChapter,
  lesson,
  nextButton,
  openLesson,
  reachableText,
  startStory,
  waitHolding,
  wholeWord,
} from './helpers';

test.describe('start and playback', () => {
  test('title screen, then Start begins chapter 1 and waits at the first gate', async ({ page }) => {
    const errors = collectErrors(page);
    await openLesson(page);
    await expect(page.getByRole('heading', { name: "Leo's Crates of Five" })).toBeVisible();
    await expect(caption(page)).toContainText('Press “Start the story”');
    await expect(page.locator('nav[aria-label="Chapters"] [aria-current="step"]')).toHaveCount(0);

    await startStory(page);
    await expect(lesson(page)).toHaveAttribute('data-beat', 'c1-meet');
    await expect(caption(page)).toContainText('Every crate holds exactly 5 apples');
    await expect(page.getByRole('button', { name: 'Chapter 1: Pack the Crates' })).toHaveAttribute('aria-current', 'step');
    await expect(page.getByRole('heading', { name: "Leo's Crates of Five" })).toHaveCount(0);

    // plays on by itself, then waits for the learner at "Pack crate 1"
    await expect(lesson(page)).toHaveAttribute('data-beat', 'c1-gate1');
    await waitHolding(page);
    await expect(nextButton(page)).toHaveText(/Pack crate 1/);
    await page.waitForTimeout(400);
    await expect(lesson(page)).toHaveAttribute('data-beat', 'c1-gate1');
    expect(errors).toEqual([]);
  });

  test('pause freezes playback and resume continues it', async ({ page }) => {
    await openLesson(page, 1);
    await startStory(page);
    await page.waitForTimeout(400);
    const playPause = page.getByTestId('play-pause');
    await expect(playPause).toHaveText(/Pause/);
    await playPause.click();
    await expect(lesson(page)).toHaveAttribute('data-playing', 'false');
    await expect(playPause).toHaveText(/Resume/);
    const frozen = await lesson(page).getAttribute('data-elapsed');
    await page.waitForTimeout(800);
    await expect(lesson(page)).toHaveAttribute('data-elapsed', frozen!);

    await playPause.click();
    await expect(lesson(page)).toHaveAttribute('data-playing', 'true');
    await expect.poll(async () => Number(await lesson(page).getAttribute('data-elapsed'))).toBeGreaterThan(Number(frozen) + 200);
  });

  test('learners build four crates and the board records 5, 10, 15, 20', async ({ page }) => {
    await openLesson(page);
    await startStory(page);
    await advanceTo(page, 'c1-wrap');
    await expect(page.locator('g.apple')).toHaveCount(20);
    const totals = page.locator('[data-cell^="total-"]');
    await expect(totals).toHaveText(['5', '10', '15', '20']);
    await expect(caption(page)).toContainText("Leo's board says 5, 10, 15, 20");
  });

  test('replay restarts the chapter and clears its answers', async ({ page }) => {
    await openLesson(page);
    await goToChapter(page, 2);
    await advanceTo(page, 'c2-predict');
    await answerNumber(page, '25');
    await expect(feedback(page)).toContainText('✓');
    await page.getByRole('button', { name: 'Replay chapter' }).click();
    await expect(lesson(page)).toHaveAttribute('data-beat', 'c2-jump1');
    await advanceTo(page, 'c2-predict');
    await expect(page.getByLabel('Total', { exact: true })).toHaveValue('');
    await expect(feedback(page)).toHaveText('');
    await expect(nextButton(page)).toBeDisabled();
  });

  test('chapter navigation jumps to each chapter, even mid-animation', async ({ page }) => {
    await openLesson(page, 4);
    const titles = ['Pack the Crates', 'Spot the Repeat', 'Why Times Five?', "Check Pip's Guess", 'Your Turn'];
    const firstBeats = ['c1-meet', 'c2-jump1', 'c3-inside', 'c4-pip', 'c5-meet'];
    for (const n of [3, 5, 2, 4, 1]) {
      await goToChapter(page, n);
      await expect(lesson(page)).toHaveAttribute('data-beat', firstBeats[n - 1]);
      await expect(page.locator('.chapter-heading')).toContainText(titles[n - 1]);
      await expect(page.getByRole('button', { name: `Chapter ${n}: ${titles[n - 1]}` })).toHaveAttribute('aria-current', 'step');
    }
    await expect(page.locator('svg.stage-svg')).toHaveAttribute('data-scene', 'orchard');

    // start packing crate 1, then jump away while apples are still falling
    await advanceTo(page, 'c1-gate1');
    await clickNext(page);
    await expect(lesson(page)).toHaveAttribute('data-beat', 'c1-fill1');
    await goToChapter(page, 4);
    await expect(lesson(page)).toHaveAttribute('data-beat', 'c4-pip');
    await expect(page.locator('g.apple')).toHaveCount(20);
    await expect(page.locator('g.crate')).toHaveCount(5);
    await goToChapter(page, 5);
    await expect(page.locator('svg.stage-svg')).toHaveAttribute('data-scene', 'stickers');
    await expect(page.locator('g.apple')).toHaveCount(0);
  });
});

test.describe('questions and feedback', () => {
  test('specific corrective feedback for the predicted fifth total, then the model on request', async ({ page }) => {
    await openLesson(page);
    await goToChapter(page, 2);
    await advanceTo(page, 'c2-predict');
    await waitHolding(page);
    await expect(nextButton(page)).toBeDisabled();
    await expect(nextButton(page)).toHaveText(/Answer to continue/);

    await answerNumber(page, '');
    await expect(feedback(page)).toContainText('Type a number first');

    await answerNumber(page, '24');
    await expect(feedback(page)).toContainText('Not yet.');
    await expect(feedback(page)).toContainText('24 is only 4 more than 20');
    await expect(feedback(page)).toContainText('not 4');
    await expect(page.getByRole('button', { name: 'Show me with the model' })).toHaveCount(0);

    await answerNumber(page, '30');
    await expect(feedback(page)).toContainText('one crate too many');
    await expect(nextButton(page)).toBeDisabled();

    await page.getByRole('button', { name: 'Show me with the model' }).click();
    await expect(feedback(page)).toContainText('20 + 5 = 25');
    await expect(page.getByTestId('continue')).toBeFocused();
    await expect(nextButton(page)).toBeEnabled();
    await page.getByTestId('continue').click();
    await expect(lesson(page)).toHaveAttribute('data-beat', 'c2-held');
  });

  test('checking Pip’s wrong next term (24) with specific feedback for each wrong reason', async ({ page }) => {
    await openLesson(page);
    await goToChapter(page, 4);
    await advanceTo(page, 'c4-check');
    await expect(page.locator('[data-cell="guess"]')).toHaveText('24');

    await page.getByRole('button', { name: 'Check', exact: true }).click();
    await expect(feedback(page)).toContainText('Choose an answer first');

    await page.getByLabel('Yes. The totals go up by 4 each time.').check();
    await page.getByRole('button', { name: 'Check', exact: true }).click();
    await expect(feedback(page)).toContainText('Every jump is +5, not +4');
    await expect(page.locator('.choice.tried')).toHaveCount(1);

    await page.getByLabel('Yes. 24 is more than 20, so it fits.').check();
    await page.getByRole('button', { name: 'Check', exact: true }).click();
    await expect(feedback(page)).toContainText('Bigger is not enough');

    await page.getByLabel('No. 24 is only 4 more than 20, but one more crate adds 5.').check();
    await page.getByRole('button', { name: 'Check', exact: true }).click();
    await expect(feedback(page)).toContainText('Right!');
    await page.getByTestId('continue').click();

    // test the claim with the model: stop at 24, one empty spot, then 25
    await expect(lesson(page)).toHaveAttribute('data-beat', 'c4-gate5');
    await waitHolding(page);
    await expect(nextButton(page)).toHaveText(/Pack crate 5/);
    await clickNext(page);
    await expect(lesson(page)).toHaveAttribute('data-beat', 'c4-count');
    await expect(page.locator('g.counter')).toHaveText('24');
    await advanceTo(page, 'c4-fix');
    await expect(page.locator('[data-cell="total-5"]')).toHaveText('25');

    // keep monitoring: the sixth total
    await advanceTo(page, 'c4-monitor');
    await answerNumber(page, '25');
    await expect(feedback(page)).toContainText('25 is the total for 5 crates');
    await answerNumber(page, '30');
    await expect(feedback(page)).toContainText('25 + 5 = 30');
    await page.getByTestId('continue').click();
    await expect(lesson(page)).toHaveAttribute('data-beat', 'c4-fill6');
  });

  test('fresh transfer question: 7 sticker sheets of 5 stars', async ({ page }) => {
    await openLesson(page);
    await goToChapter(page, 5);
    await advanceTo(page, 'c5-ask');
    await expect(page.locator('g.sheet')).toHaveCount(7);
    await expect(page.locator('g.sheet path')).toHaveCount(35);
    await answerNumber(page, '12');
    await expect(feedback(page)).toContainText('12 is 7 + 5');
    await answerNumber(page, '34');
    await expect(feedback(page)).toContainText('end in 0 or 5');
    await answerNumber(page, '35');
    await expect(feedback(page)).toContainText('30 + 5 = 35');
    await page.getByTestId('continue').click();
    await advanceTo(page, 'c5-finale');
    await expect(page.locator('svg.stage-svg')).toContainText('7 × 5 = 35 stars');
    await expect(lesson(page)).toHaveAttribute('data-complete', 'true');
    await expect(page.getByText('Lesson complete!')).toBeVisible();
    await expect(nextButton(page)).toBeDisabled();
  });

  test('full playthrough from Start to the end', async ({ page }) => {
    const errors = collectErrors(page);
    await openLesson(page, 30);
    await startStory(page);
    const answers: Record<string, string> = { 'c2-predict': '25', 'c4-monitor': '30', 'c5-ask': '35' };
    for (let guard = 0; guard < 400; guard++) {
      if ((await lesson(page).getAttribute('data-complete')) === 'true') break;
      const id = await beatId(page);
      const holding = (await lesson(page).getAttribute('data-holding')) === 'true';
      if (holding && answers[id] && (await page.getByTestId('continue').count()) === 0) {
        await answerNumber(page, answers[id]);
        await page.getByTestId('continue').click();
      } else if (holding && id === 'c4-check' && (await page.getByTestId('continue').count()) === 0) {
        await page.getByLabel('No. 24 is only 4 more than 20, but one more crate adds 5.').check();
        await page.getByRole('button', { name: 'Check', exact: true }).click();
        await page.getByTestId('continue').click();
      } else if (holding && (await nextButton(page).isEnabled())) {
        await clickNext(page);
      } else {
        await page.waitForTimeout(50);
      }
    }
    await expect(lesson(page)).toHaveAttribute('data-complete', 'true');
    await expect(lesson(page)).toHaveAttribute('data-beat', 'c5-finale');
    expect(errors).toEqual([]);
  });
});

test.describe('input methods', () => {
  test('keyboard only', async ({ page }) => {
    await openLesson(page, 8);
    // Tab to the Start button and press Enter
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Tab');
      if ((await page.evaluate(() => document.activeElement?.textContent ?? '')).includes('Start the story')) break;
    }
    await page.keyboard.press('Enter');
    await expect(lesson(page)).toHaveAttribute('data-started', 'true');

    // Space pauses and resumes when focus is not on a control
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('Space');
    await expect(lesson(page)).toHaveAttribute('data-playing', 'false');
    await page.keyboard.press('Space');
    await expect(lesson(page)).toHaveAttribute('data-playing', 'true');

    // N packs crates at gates
    await expect(lesson(page)).toHaveAttribute('data-beat', 'c1-gate1');
    await waitHolding(page);
    await page.keyboard.press('n');
    await page.keyboard.press('Space'); // pause mid-fill so the next checks are deterministic
    await expect(lesson(page)).toHaveAttribute('data-beat', 'c1-fill1');
    await expect(lesson(page)).toHaveAttribute('data-playing', 'false');
    // B goes back, R replays the chapter
    await page.waitForTimeout(350);
    await page.keyboard.press('b');
    await expect(lesson(page)).toHaveAttribute('data-beat', 'c1-gate1');
    await page.waitForTimeout(350);
    await page.keyboard.press('r');
    await expect(lesson(page)).toHaveAttribute('data-beat', 'c1-meet');

    // Jump to chapter 2 with the keyboard and answer the question
    await page.getByRole('button', { name: 'Chapter 2: Spot the Repeat' }).focus();
    await page.keyboard.press('Enter');
    await expect(lesson(page)).toHaveAttribute('data-chapter', '1');
    await expect(lesson(page)).toHaveAttribute('data-beat', 'c2-predict', { timeout: 15_000 });
    await expect(page.locator('#predict-5-prompt')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Total', { exact: true })).toBeFocused();
    await page.keyboard.type('24');
    await page.keyboard.press('Enter');
    await expect(feedback(page)).toContainText('only 4 more than 20');
    await page.keyboard.type('25');
    await page.keyboard.press('Enter');
    await expect(feedback(page)).toContainText('✓');
    await expect(page.getByTestId('continue')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(lesson(page)).toHaveAttribute('data-beat', 'c2-held');

    // The choice question with arrow keys
    await page.getByRole('button', { name: "Chapter 4: Check Pip's Guess" }).focus();
    await page.keyboard.press('Enter');
    await expect(lesson(page)).toHaveAttribute('data-beat', 'c4-check', { timeout: 15_000 });
    await page.keyboard.press('Tab'); // first radio
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(page.getByLabel('No. 24 is only 4 more than 20, but one more crate adds 5.')).toBeChecked();
    await page.keyboard.press('Enter');
    await expect(feedback(page)).toContainText('Right!');
  });

  test('touch: tap to build, tap the keypad, tap to navigate', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'touch runs on the mobile project');
    await openLesson(page);
    await expect(lesson(page)).toHaveAttribute('data-layout', 'narrow');
    await page.getByRole('button', { name: 'Start the story' }).tap();
    await expect(lesson(page)).toHaveAttribute('data-beat', 'c1-gate1');
    await waitHolding(page);
    await nextButton(page).tap();
    await expect(lesson(page)).toHaveAttribute('data-beat', 'c1-fill1');

    await page.getByRole('button', { name: 'Chapter 2: Spot the Repeat' }).tap();
    await advanceTo(page, 'c2-predict');
    const pad = page.getByRole('group', { name: 'Number pad' });
    await pad.getByRole('button', { name: '2', exact: true }).tap();
    await pad.getByRole('button', { name: '4', exact: true }).tap();
    await pad.getByRole('button', { name: 'Delete last digit' }).tap();
    await pad.getByRole('button', { name: '5', exact: true }).tap();
    await expect(page.getByLabel('Total', { exact: true })).toHaveValue('25');
    await page.getByRole('button', { name: 'Check', exact: true }).tap();
    await expect(feedback(page)).toContainText('✓');
    await page.getByTestId('continue').tap();
    await expect(lesson(page)).toHaveAttribute('data-beat', 'c2-held');

    // no horizontal scrolling at phone width
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe('reset and rapid input', () => {
  test('Start over resets everything to the title screen', async ({ page }) => {
    await openLesson(page);
    await goToChapter(page, 2);
    await advanceTo(page, 'c2-predict');
    await answerNumber(page, '24');
    await page.getByTestId('reset').click();
    await expect(lesson(page)).toHaveAttribute('data-started', 'false');
    await expect(lesson(page)).toHaveAttribute('data-chapter', '0');
    await expect(page.getByRole('button', { name: 'Start the story' })).toBeVisible();
    await expect(caption(page)).toContainText('Press “Start the story”');
    await expect(page.locator('nav[aria-label="Chapters"] [aria-current="step"]')).toHaveCount(0);
    await expect(page.getByTestId('feedback')).toHaveCount(0);

    await startStory(page);
    await expect(lesson(page)).toHaveAttribute('data-beat', 'c1-meet');
    await goToChapter(page, 2);
    await advanceTo(page, 'c2-predict');
    await expect(feedback(page)).toHaveText('');
    await expect(page.getByRole('button', { name: 'Show me with the model' })).toHaveCount(0);
  });

  test('double-clicks, key mashing, and rapid navigation keep the lesson consistent', async ({ page }) => {
    const errors = collectErrors(page);
    await openLesson(page, 20);
    await startStory(page);
    await expect(lesson(page)).toHaveAttribute('data-beat', 'c1-gate1');
    await waitHolding(page);

    // a double-click on "Pack crate 1" packs only one crate
    await nextButton(page).dblclick();
    await expect(lesson(page)).toHaveAttribute('data-beat', 'c1-fill1');
    await page.waitForTimeout(150);
    expect(['c1-fill1', 'c1-gate2']).toContain(await beatId(page));

    // mashing N can never skip past an unanswered question
    await goToChapter(page, 2);
    for (let i = 0; i < 40; i++) await page.keyboard.press(i % 7 === 0 ? 'ArrowRight' : 'n');
    await expect(lesson(page)).toHaveAttribute('data-beat', 'c2-predict', { timeout: 10_000 });
    for (let i = 0; i < 20; i++) await page.keyboard.press('n');
    await page.waitForTimeout(300);
    await expect(lesson(page)).toHaveAttribute('data-beat', 'c2-predict');

    // a double-click on Check submits once
    await page.getByLabel('Total', { exact: true }).fill('25');
    await page.getByRole('button', { name: 'Check', exact: true }).dblclick();
    await expect(feedback(page)).toContainText('✓');
    await expect(feedback(page).locator('p')).toHaveCount(1);

    // mixed key mashing (space, back, next, replay) leaves a valid state
    const keys = ['Space', 'n', 'b', 'r', 'ArrowLeft', 'ArrowRight', 'k', 'n', 'Space'];
    for (let i = 0; i < 45; i++) await page.keyboard.press(keys[i % keys.length]);
    // Space on the focused Continue button may legitimately move on; the state must still be valid
    const chapterNow = Number(await lesson(page).getAttribute('data-chapter'));
    expect(await beatId(page)).toMatch(new RegExp(`^c${chapterNow + 1}-`));
    expect(chapterNow).toBeGreaterThanOrEqual(1);

    // rapid chapter hopping mid-animation ends on the last chapter clicked, cleanly
    await goToChapter(page, 1);
    await advanceTo(page, 'c1-gate1');
    await clickNext(page);
    const nav = page.locator('nav[aria-label="Chapters"] button');
    for (const n of [3, 4, 2, 5, 1]) await nav.nth(n - 1).click();
    await expect(lesson(page)).toHaveAttribute('data-chapter', '0');
    await expect(lesson(page)).toHaveAttribute('data-beat', /^c1-(meet|think|gate1)$/);
    await expect(page.locator('g.apple')).toHaveCount(0);
    await expect(page.locator('g.crate')).toHaveCount(1);

    // rapid Replay clicks
    const replay = page.getByRole('button', { name: 'Replay chapter' });
    for (let i = 0; i < 5; i++) await replay.click();
    await expect(lesson(page)).toHaveAttribute('data-chapter', '0');
    expect(errors).toEqual([]);
  });
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('honors prefers-reduced-motion: final states appear at once, no CSS animations', async ({ page }) => {
    await openLesson(page, 1);
    await expect(lesson(page)).toHaveAttribute('data-reduced', 'true');
    await expect(page.getByRole('button', { name: /Reduce motion: On/ })).toHaveAttribute('aria-pressed', 'true');
    await startStory(page);
    await expect(lesson(page)).toHaveAttribute('data-beat', 'c1-gate1', { timeout: 20_000 });
    await waitHolding(page);
    await clickNext(page);
    // all five apples are already in their spots on the very first frame of the beat
    await expect(lesson(page)).toHaveAttribute('data-beat', 'c1-fill1');
    expect(Number(await lesson(page).getAttribute('data-elapsed'))).toBeLessThan(1500);
    await expect(page.locator('g.apple')).toHaveCount(5);
    const offsets = await page.$$eval('g.crate[data-id="crate-1"]', (crates) =>
      crates.map((c) => c.getAttribute('transform')),
    );
    expect(offsets).toEqual(['translate(0 0)']);
    const apples = await page.$$eval('g.apple', (els) => els.map((e) => [e.getAttribute('transform'), e.getAttribute('opacity')]));
    const slots = await page.$$eval('g.crate[data-id="crate-1"] > circle', (els) => els.map((e) => `translate(${e.getAttribute('cx')} ${e.getAttribute('cy')})`));
    expect(apples.map((a) => a[0])).toEqual(slots);
    expect(apples.every((a) => a[1] === '1')).toBe(true);
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  });

  test('the in-app toggle can turn reduced motion off and on', async ({ page }) => {
    await openLesson(page);
    const toggle = page.getByRole('button', { name: /Reduce motion/ });
    await toggle.click();
    await expect(lesson(page)).toHaveAttribute('data-reduced', 'false');
    await toggle.click();
    await expect(lesson(page)).toHaveAttribute('data-reduced', 'true');
  });
});

test.describe('no answer leaks before submission', () => {
  const cases = [
    { chapter: 2, beat: 'c2-predict', answer: '25' },
    { chapter: 4, beat: 'c4-monitor', answer: '30', pip: true },
    { chapter: 5, beat: 'c5-ask', answer: '35' },
  ];
  for (const c of cases) {
    test(`${c.beat}: ${c.answer} is not in the DOM text, aria labels, or live regions until submitted`, async ({ page }) => {
      await openLesson(page);
      await goToChapter(page, c.chapter);
      if (c.pip) {
        await advanceTo(page, 'c4-check');
        const text = await reachableText(page);
        expect(text).not.toMatch(wholeWord('25'));
        expect(await page.locator('[data-correct], [data-answer]').count()).toBe(0);
        await page.getByLabel('No. 24 is only 4 more than 20, but one more crate adds 5.').check();
        await page.getByRole('button', { name: 'Check', exact: true }).click();
        await page.getByTestId('continue').click();
      }
      await advanceTo(page, c.beat);
      await waitHolding(page);
      // sample several times while the question waits
      for (let i = 0; i < 3; i++) {
        const text = await reachableText(page);
        expect(text).not.toMatch(wholeWord(c.answer));
        await page.waitForTimeout(150);
      }
      // a wrong attempt's feedback does not leak it either
      await answerNumber(page, '1');
      await expect(feedback(page)).toContainText('Not yet');
      expect(await reachableText(page)).not.toMatch(wholeWord(c.answer));

      // after a correct submission the answer appears (so the check above is meaningful)
      await answerNumber(page, c.answer);
      await expect(feedback(page)).toContainText('✓');
      expect(await reachableText(page)).toMatch(wholeWord(c.answer));
    });
  }
});
