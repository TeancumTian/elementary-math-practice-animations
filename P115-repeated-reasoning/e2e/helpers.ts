import { expect, type Locator, type Page } from '@playwright/test';

export const lesson = (page: Page): Locator => page.getByTestId('lesson');
export const nextButton = (page: Page): Locator => page.getByTestId('next');
export const caption = (page: Page): Locator => page.getByTestId('caption');
export const feedback = (page: Page): Locator => page.getByTestId('feedback');

/** Open the lesson. `speed` multiplies the playback clock so tests stay quick. */
export async function openLesson(page: Page, speed = 20): Promise<void> {
  await page.goto(`/?speed=${speed}`);
  await expect(lesson(page)).toHaveAttribute('data-started', 'false');
  await expect(lesson(page)).toHaveAttribute('data-hydrated', 'true');
  await expect(page.locator('svg.stage-svg')).toBeVisible();
}

export async function startStory(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Start the story' }).click();
  await expect(lesson(page)).toHaveAttribute('data-started', 'true');
}

export async function beatId(page: Page): Promise<string> {
  return (await lesson(page).getAttribute('data-beat')) ?? '';
}

/** Click Next once, retrying if the double-click guard swallowed the click. */
export async function clickNext(page: Page): Promise<void> {
  const before = await beatId(page);
  const beforeChapter = await lesson(page).getAttribute('data-chapter');
  for (let attempt = 0; attempt < 4; attempt++) {
    await nextButton(page).click();
    try {
      await expect
        .poll(async () => `${await lesson(page).getAttribute('data-chapter')}/${await beatId(page)}`, { timeout: 700 })
        .not.toBe(`${beforeChapter}/${before}`);
      return;
    } catch {
      /* guard swallowed it; try again */
    }
  }
  throw new Error(`Next did not advance from ${before}`);
}

/** Let playback run (pressing Next at gates) until the given beat is on screen. */
export async function advanceTo(page: Page, id: string, budgetMs = 30_000): Promise<void> {
  const until = Date.now() + budgetMs;
  while (Date.now() < until) {
    const now = await beatId(page);
    if (now === id) return;
    const holding = (await lesson(page).getAttribute('data-holding')) === 'true';
    if (holding && (await nextButton(page).isEnabled())) {
      await clickNext(page);
    } else {
      await page.waitForTimeout(60);
    }
  }
  throw new Error(`Never reached beat ${id}; stuck at ${await beatId(page)}`);
}

export async function goToChapter(page: Page, n: number): Promise<void> {
  await page.locator('nav[aria-label="Chapters"] button').nth(n - 1).click();
  await expect(lesson(page)).toHaveAttribute('data-chapter', String(n - 1));
}

export async function waitHolding(page: Page): Promise<void> {
  await expect(lesson(page)).toHaveAttribute('data-holding', 'true');
}

export async function answerNumber(page: Page, value: string): Promise<void> {
  const input = page.getByLabel('Total', { exact: true });
  await input.fill(value);
  await page.getByRole('button', { name: 'Check', exact: true }).click();
}

/**
 * All text a learner or assistive technology could reach: every text node
 * (including SVG <title>/<desc>, visually hidden text, and live regions),
 * plus accessible attributes and form values. Scripts and styles excluded.
 */
export async function reachableText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const parts: string[] = [];
    // every text node, joined with separators so neighbouring numbers never merge
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const parent = n.parentElement;
      if (parent && parent.closest('script, style, noscript, template')) continue;
      parts.push(n.nodeValue ?? '');
    }
    const attrs = ['aria-label', 'aria-description', 'aria-valuetext', 'aria-roledescription', 'title', 'alt', 'placeholder'];
    document.querySelectorAll('*').forEach((el) => {
      for (const a of attrs) {
        const v = el.getAttribute(a);
        if (v) parts.push(v);
      }
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) parts.push(el.value);
    });
    document.querySelectorAll('[aria-live], [role=status], [role=alert]').forEach((el) => parts.push((el as HTMLElement).innerText ?? ''));
    return parts.join('\n');
  });
}

export const wholeWord = (s: string): RegExp => new RegExp(`(^|[^0-9])${s}([^0-9]|$)`);

export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}
