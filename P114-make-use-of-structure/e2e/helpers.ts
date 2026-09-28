import { expect, type Locator, type Page } from "@playwright/test";

/** Correct responses, used to move through earlier questions quickly. */
export const CORRECT: Record<string, { choice?: RegExp; number?: string }> = {
  "q-predict-ten": { choice: /Exactly one ten-stick/ },
  "q-predict-total": { number: "80" },
  "q-explain-same": { choice: /It stayed the same/ },
  "q-explain-structure": { choice: /Making a new ten/ },
  "q-transfer-total": { number: "60" },
  "q-array-total": { number: "12" },
  "q-array-same": { choice: /same 12 robots/ },
  "q-array-structure": { choice: /Equal rows or equal columns/ },
};

export const lesson = (page: Page): Locator => page.getByTestId("lesson");

export async function open(page: Page, query = ""): Promise<void> {
  await page.goto(`/${query}`);
  await expect(lesson(page)).toHaveAttribute("data-started", "false");
  // Wait for hydration: the Start button only works once React is attached.
  await page.waitForFunction(() => {
    const btn = document.querySelector('[data-testid="start"]');
    return !!btn && Object.keys(btn).some((k) => k.startsWith("__react"));
  });
}

export async function start(page: Page): Promise<void> {
  await page.getByTestId("start").click();
  await expect(lesson(page)).toHaveAttribute("data-started", "true");
}

export async function stepId(page: Page): Promise<string> {
  return (await lesson(page).getAttribute("data-step")) ?? "";
}

/** Press Next once and wait for the step to change (retries if the double-press guard swallowed it). */
export async function next(page: Page): Promise<void> {
  const before = await stepId(page);
  await expect(async () => {
    if ((await stepId(page)) === before) await page.getByTestId("next").click({ timeout: 2000 });
    await expect(lesson(page)).not.toHaveAttribute("data-step", before, { timeout: 600 });
  }).toPass({ timeout: 10_000, intervals: [150, 300, 500] });
}

export async function chooseAndCheck(page: Page, text: RegExp): Promise<void> {
  await page.locator("label.choice", { hasText: text }).click();
  await page.getByTestId("check").click();
}

export async function typeAndCheck(page: Page, value: string): Promise<void> {
  await page.getByTestId("answer-input").fill(value);
  await page.getByTestId("check").click();
}

export async function answerCorrectly(page: Page): Promise<void> {
  const id = await stepId(page);
  const c = CORRECT[id];
  if (!c) throw new Error(`No correct answer on file for ${id}`);
  if (c.choice) await chooseAndCheck(page, c.choice);
  else await typeAndCheck(page, c.number!);
  await expect(page.getByTestId("feedback")).toHaveAttribute("data-status", "correct");
}

/** From the cover, go to `target` (a data-step id), answering every earlier question correctly. */
export async function goTo(page: Page, target: string, query = "?speed=20"): Promise<void> {
  await open(page, query);
  await start(page);
  for (let guard = 0; guard < 30; guard++) {
    const id = await stepId(page);
    if (id === target) return;
    if ((await lesson(page).getAttribute("data-step-kind")) === "question") await answerCorrectly(page);
    await next(page);
  }
  throw new Error(`Could not reach ${target}`);
}

export async function cubeXY(page: Page, id: string): Promise<{ x: number; y: number }> {
  const rect = page.locator(`[data-cube="${id}"]`);
  const [x, y] = await Promise.all([rect.getAttribute("x"), rect.getAttribute("y")]);
  return { x: Number(x), y: Number(y) };
}

/** Collect console errors and page errors for the whole test. */
export function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));
  return errors;
}
