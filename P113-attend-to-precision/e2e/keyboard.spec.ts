import { expect, test, type Page } from '@playwright/test';
import { QUESTIONS, correctLetter, type OptionLetter, type QuestionId } from '../src/model/precision-model';
import { elapsedMs, feedback, nextButton, openApp, stage, trackErrors } from './helpers';

async function focusedText(page: Page) {
  return page.evaluate(() => (document.activeElement?.textContent ?? '').trim());
}

/** Choose an option with arrow keys (native radio group), then submit with Enter on "Check answer". */
async function chooseByKeyboard(page: Page, q: QuestionId, letter: OptionLetter) {
  const letters = QUESTIONS[q].options.map((o) => o.letter);
  const target = letters.indexOf(letter);
  const checked = await page.evaluate(() => {
    const el = document.querySelector<HTMLInputElement>('.options input:checked');
    return el ? el.value : null;
  });
  const onRadio = await page.evaluate(() => (document.activeElement as HTMLInputElement | null)?.type === 'radio');
  if (!onRadio) {
    // From the heading, Tab enters the group; from the Check button, Shift+Tab goes back to it.
    const onCheck = (await focusedText(page)) === 'Check answer';
    await page.keyboard.press(onCheck ? 'Shift+Tab' : 'Tab');
  }
  if (checked === null) {
    if (target === 0) await page.keyboard.press('Space');
    else for (let i = 0; i < target; i += 1) await page.keyboard.press('ArrowDown');
  } else {
    const from = letters.indexOf(checked as OptionLetter);
    const steps = (target - from + letters.length) % letters.length;
    for (let i = 0; i < steps; i += 1) await page.keyboard.press('ArrowDown');
  }
  await expect(page.locator(`.options input[value="${letter}"]`)).toBeChecked();
  await page.keyboard.press('Tab');
  expect(await focusedText(page)).toBe('Check answer');
  await page.keyboard.press('Enter');
}

test('keyboard only: start, shortcuts, and a whole job with wrong and right answers', async ({ page }) => {
  const errors = trackErrors(page);
  await openApp(page);

  // Tab from the top of the page to Start.
  let found = false;
  for (let i = 0; i < 25 && !found; i += 1) {
    await page.keyboard.press('Tab');
    found = (await focusedText(page)).endsWith('Start') && !(await focusedText(page)).includes('over');
  }
  expect(found).toBe(true);
  await page.keyboard.press('Enter');
  await expect(stage(page)).toHaveAttribute('data-scene', 'intro');
  await expect(nextButton(page)).toBeFocused();

  // P pauses and resumes.
  await page.keyboard.press('p');
  await expect(page.getByTestId('scene-state')).toContainText('Paused');
  const frozen = await elapsedMs(page);
  await page.waitForTimeout(500);
  expect(await elapsedMs(page)).toBe(frozen);
  await page.keyboard.press('p');
  await expect(page.getByTestId('scene-state')).toContainText('Playing');

  // Enter on the focused Next button, then the N shortcut.
  await page.keyboard.press('Enter');
  await expect(stage(page)).toHaveAttribute('data-scene', 'look-unit');
  await page.keyboard.press('n');
  await expect(page.getByRole('heading', { name: 'Predict' })).toBeFocused();

  const job: QuestionId[] = ['predict-unit', 'explain-unit', 'try-unit'];
  for (const q of job) {
    const right = correctLetter(q);
    const wrong = QUESTIONS[q].options.find((o) => o.letter !== right)!;
    await chooseByKeyboard(page, q, wrong.letter);
    await expect(feedback(page)).toContainText(wrong.feedback);
    await expect(nextButton(page)).toBeDisabled();
    await chooseByKeyboard(page, q, right);
    await expect(feedback(page)).toContainText('Correct!');
    await expect(nextButton(page)).toBeFocused();
    await page.keyboard.press('Enter');
    if (q === 'predict-unit') {
      await expect(stage(page)).toHaveAttribute('data-scene', 'repair-unit');
      await page.keyboard.press('n');
    }
    if (q !== 'try-unit') await expect(page.locator('legend.prompt')).toHaveText(QUESTIONS[job[job.indexOf(q) + 1]].prompt);
  }
  // After the Try question, Next leads into the fruit-graph job.
  await expect(stage(page)).toHaveAttribute('data-scene', 'look-axis');

  // B goes back; R replays the chapter.
  await page.keyboard.press('b');
  await expect(page.locator('legend.prompt')).toHaveText(QUESTIONS['try-unit'].prompt);
  await page.keyboard.press('r');
  await expect(stage(page)).toHaveAttribute('data-scene', 'look-unit');
  expect(errors).toEqual([]);
});

test('skip link and visible focus', async ({ page }) => {
  await openApp(page);
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to activity' });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press('Tab');
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement as Element).outlineStyle);
  expect(outline).not.toBe('none');
});
