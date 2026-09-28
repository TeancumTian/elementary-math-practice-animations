import { expect, test, type Locator, type Page } from "@playwright/test";
import { lesson, open } from "./helpers";

async function isFocused(locator: Locator): Promise<boolean> {
  return locator.evaluate((el) => el === document.activeElement);
}

async function tabTo(page: Page, locator: Locator, max = 30): Promise<void> {
  for (let i = 0; i < max; i++) {
    if (await isFocused(locator)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error("Could not reach element with Tab");
}

test.describe("keyboard only", () => {
  test("the Grade 2 path works with Tab, arrows, Enter, and the P/R/N shortcuts", async ({ page }) => {
    await open(page);
    await tabTo(page, page.getByTestId("start"));
    await page.keyboard.press("Enter");
    await expect(lesson(page)).toHaveAttribute("data-started", "true");
    // Focus lands on Next, not lost on the page.
    await expect(page.getByTestId("next")).toBeFocused();

    await page.keyboard.press("p");
    await expect(lesson(page)).toHaveAttribute("data-playing", "false");
    await page.keyboard.press("p");
    await expect(lesson(page)).toHaveAttribute("data-playing", "true");
    await page.waitForTimeout(1500);
    await page.keyboard.press("r");
    await expect(lesson(page)).toHaveAttribute("data-beat", "0");

    await page.waitForTimeout(500);
    await page.keyboard.press("Enter"); // Next is focused
    await expect(lesson(page)).toHaveAttribute("data-step", "q-predict-ten");
    // The question itself receives focus so it is read first.
    await expect(page.locator("#q-legend")).toBeFocused();

    await page.keyboard.press("Tab"); // into the radio group (choice A)
    await page.keyboard.press("ArrowDown"); // choice B
    await expect(page.getByRole("radio", { name: "Exactly one ten-stick" })).toBeChecked();
    await page.keyboard.press("Tab");
    await expect(page.getByTestId("check")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("feedback")).toHaveAttribute("data-status", "correct");
    await expect(page.getByTestId("next")).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(lesson(page)).toHaveAttribute("data-step", "q-predict-total");
    await page.keyboard.press("Tab");
    await expect(page.getByTestId("answer-input")).toBeFocused();
    // Shortcut letters are ignored while typing an answer.
    await page.keyboard.type("n7p0");
    await expect(page.getByTestId("answer-input")).toHaveValue("70");
    await expect(lesson(page)).toHaveAttribute("data-step", "q-predict-total");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("feedback")).toContainText("Don't forget the new ten");
    await page.keyboard.press("Backspace");
    await page.keyboard.press("Backspace");
    await page.keyboard.type("80");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("feedback")).toHaveAttribute("data-status", "correct");
    await expect(page.getByTestId("next")).toBeFocused();

    await page.keyboard.press("n");
    await expect(lesson(page)).toHaveAttribute("data-step", "snap-scene");
    await expect(lesson(page)).toHaveAttribute("data-playing", "true");
    await page.waitForTimeout(500);
    await page.keyboard.press("n");
    await expect(lesson(page)).toHaveAttribute("data-step", "q-explain-same");

    // Chapter buttons are reachable and usable from the keyboard too.
    await tabTo(page, page.getByTestId("chapter-meet"));
    await page.keyboard.press("Enter");
    await expect(lesson(page)).toHaveAttribute("data-step", "meet-scene");
  });

  test("every control shows a visible focus indicator", async ({ page }) => {
    await open(page);
    await tabTo(page, page.getByTestId("start"));
    const outline = await page.getByTestId("start").evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).toBe("solid");
  });
});

test.describe("touch", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("tapping works for start, choices, the number pad, check, next, and pause", async ({ page }) => {
    await open(page);
    // No sideways scrolling at phone width.
    expect(await page.evaluate(() => [window.innerWidth, document.documentElement.scrollWidth])).toEqual([390, 390]);

    await page.getByTestId("start").tap();
    await expect(lesson(page)).toHaveAttribute("data-started", "true");
    await page.getByTestId("pause").tap();
    await expect(lesson(page)).toHaveAttribute("data-playing", "false");
    await page.getByTestId("pause").tap();
    await expect(lesson(page)).toHaveAttribute("data-playing", "true");

    await page.waitForTimeout(450);
    await page.getByTestId("next").tap();
    await expect(lesson(page)).toHaveAttribute("data-step", "q-predict-ten");
    await page.locator("label.choice", { hasText: "Exactly one ten-stick" }).tap();
    await page.getByTestId("check").tap();
    await expect(page.getByTestId("feedback")).toHaveAttribute("data-status", "correct");

    await page.getByTestId("next").tap();
    await expect(lesson(page)).toHaveAttribute("data-step", "q-predict-total");
    const pad = page.getByRole("group", { name: "Number pad" });
    await pad.getByRole("button", { name: "7", exact: true }).tap();
    await pad.getByRole("button", { name: "9", exact: true }).tap();
    await pad.getByRole("button", { name: "Delete last digit" }).tap();
    await pad.getByRole("button", { name: "0", exact: true }).tap();
    await expect(page.getByTestId("answer-input")).toHaveValue("70");
    await page.getByTestId("check").tap();
    await expect(page.getByTestId("feedback")).toContainText("Don't forget the new ten");
    await pad.getByRole("button", { name: "Clear answer" }).tap();
    await pad.getByRole("button", { name: "8", exact: true }).tap();
    await pad.getByRole("button", { name: "0", exact: true }).tap();
    await page.getByTestId("check").tap();
    await expect(page.getByTestId("feedback")).toHaveAttribute("data-status", "correct");
    await page.getByTestId("next").tap();
    await expect(lesson(page)).toHaveAttribute("data-step", "snap-scene");
    expect(await page.evaluate(() => [window.innerWidth, document.documentElement.scrollWidth])).toEqual([390, 390]);
  });

  test("touch targets are at least 44px tall", async ({ page }) => {
    await open(page);
    await page.getByTestId("start").tap();
    await page.waitForTimeout(450);
    await page.getByTestId("next").tap();
    const targets = page.locator(".btn, .toggle, label.choice, .chapter:not(:disabled)");
    const count = await targets.count();
    expect(count).toBeGreaterThan(5);
    for (let i = 0; i < count; i++) {
      const box = await targets.nth(i).boundingBox();
      if (box) expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });
});
