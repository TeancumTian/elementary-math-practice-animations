import { expect, test } from '@playwright/test';
import { QUESTIONS, QUESTION_IDS, SCENES, correctLetter } from '../src/model/precision-model';
import { answer, feedback, goToQuestion, nextButton, openApp, stage } from './helpers';

for (const id of QUESTION_IDS) {
  test(`${id}: each wrong choice gets its own corrective feedback; the right one unlocks Next`, async ({ page }) => {
    await openApp(page);
    await goToQuestion(page, id);
    const q = QUESTIONS[id];
    const right = correctLetter(id);
    const wrong = q.options.filter((o) => o.letter !== right);

    for (const o of wrong) {
      await answer(page, id, o.letter);
      await expect(feedback(page)).toContainText('Not yet.');
      await expect(feedback(page)).toContainText(o.feedback);
      await expect(page.locator(`[id="${id}-${o.letter}-badge"]`)).toHaveText('✗ Not yet');
      await expect(nextButton(page)).toBeDisabled();
    }

    await answer(page, id, right);
    await expect(feedback(page)).toContainText('Correct!');
    await expect(feedback(page)).toContainText(q.success);
    await expect(nextButton(page)).toBeEnabled();
    // After solving, every faulty option is labeled with what is wrong with it.
    for (const o of wrong) await expect(page.locator(`[id="${id}-${o.letter}-badge"]`)).toHaveText(`✗ ${o.flaw}`);
    await expect(page.locator(`[id="${id}-${right}-badge"]`)).toContainText('✓');
    await expect(page.getByRole('radio', { disabled: false })).toHaveCount(0);
  });
}

test('transfer: a fresh ribbon problem, then the repair animation and wrap-up', async ({ page }) => {
  await page.clock.install();
  await openApp(page);
  await goToQuestion(page, 'transfer');
  const prompt = page.locator('legend.prompt');
  await expect(prompt).toContainText("Ella's ribbon is 9 cm long");
  await expect(prompt).not.toContainText('8 + 2');
  await expect(page.getByRole('heading', { name: 'New problem' })).toBeVisible();

  const q = QUESTIONS.transfer;
  const noUnit = q.options.find((o) => o.text.endsWith('14 long.'))!;
  const falseChain = q.options.find((o) => o.text.startsWith('9 + 1 = 10 + 4'))!;
  const badSum = q.options.find((o) => o.text.includes('= 15'))!;
  await answer(page, 'transfer', noUnit.letter);
  await expect(feedback(page)).toContainText('A precise length needs its unit.');
  await answer(page, 'transfer', falseChain.letter);
  await expect(feedback(page)).toContainText('those two sides are not equal');
  await answer(page, 'transfer', badSum.letter);
  await expect(feedback(page)).toContainText('count on 4 from 10');
  await answer(page, 'transfer', correctLetter('transfer'));
  await expect(feedback(page)).toContainText('Correct!');

  await nextButton(page).click();
  await expect(stage(page)).toHaveAttribute('data-scene', 'reveal-transfer');
  await page.clock.runFor(SCENES['reveal-transfer'].duration + 500);
  await expect(stage(page).locator('[data-line="line-3"]')).toHaveText('The ribbon is 14 cm long.');
  await expect(stage(page).locator('[data-stamp="precise"]')).toBeVisible();
  await expect(stage(page).locator('[data-bracket="total"]')).toContainText('14 cm');

  await nextButton(page).click();
  await expect(stage(page)).toHaveAttribute('data-scene', 'finale');
  await page.clock.runFor(SCENES.finale.duration + 500);
  await expect(stage(page).locator('[data-badge="done"]')).toContainText('Great repair work!');
  await expect(nextButton(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Play again' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome, fixer!' })).toBeVisible();
});
