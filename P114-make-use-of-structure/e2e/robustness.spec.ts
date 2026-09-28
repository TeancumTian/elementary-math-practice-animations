import { expect, test } from "@playwright/test";
import { goTo, lesson, next, open, start, trackErrors, typeAndCheck } from "./helpers";

const KNOWN_STEPS = [
  "meet-scene",
  "q-predict-ten",
  "q-predict-total",
  "snap-scene",
  "q-explain-same",
  "q-explain-structure",
  "try-intro",
  "q-transfer-total",
  "try-check",
  "bonus-intro",
  "q-array-total",
  "bonus-regroup",
  "q-array-same",
  "q-array-structure",
  "wrap-scene",
];

test.describe("reset and rapid input", () => {
  test("Start over clears answers, locks chapters, and returns to the cover", async ({ page }) => {
    const errors = trackErrors(page);
    await goTo(page, "snap-scene", "?speed=3");
    await page.getByTestId("reset").click();
    await expect(lesson(page)).toHaveAttribute("data-started", "false");
    await expect(page.getByTestId("start")).toBeFocused();
    await expect(page.getByTestId("chapter-predict")).toBeDisabled();
    await expect(page.locator("svg[data-stage]")).toHaveAttribute("data-stage", "scattered");

    await start(page);
    await next(page);
    await expect(lesson(page)).toHaveAttribute("data-step", "q-predict-ten");
    await expect(page.getByTestId("feedback")).toBeEmpty();
    await expect(page.getByTestId("feedback")).toHaveAttribute("data-status", "unanswered");
    await expect(page.getByTestId("next")).toBeDisabled();
    await expect(page.locator("label.choice.selected")).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("reset in the middle of an animation stops it cleanly", async ({ page }) => {
    const errors = trackErrors(page);
    await open(page);
    await start(page);
    await page.waitForTimeout(600);
    await page.getByTestId("reset").click();
    await page.getByTestId("start").click();
    await expect(lesson(page)).toHaveAttribute("data-beat", "0");
    await expect(page.locator("[data-cube]")).toHaveCount(80);
    expect(errors).toEqual([]);
  });

  test("double-clicking Next advances only one step", async ({ page }) => {
    await open(page);
    await start(page);
    await page.waitForTimeout(450);
    await page.getByTestId("next").dblclick();
    await expect(lesson(page)).toHaveAttribute("data-step", "q-predict-ten");

    // Scene followed by scene: the second click must not skip the bonus intro.
    await goTo(page, "try-check");
    await expect(lesson(page)).toHaveAttribute("data-finished", "true", { timeout: 20_000 });
    await page.waitForTimeout(450);
    await page.getByTestId("next").dblclick();
    await expect(lesson(page)).toHaveAttribute("data-step", "bonus-intro");
    await page.waitForTimeout(600);
    await expect(lesson(page)).toHaveAttribute("data-step", "bonus-intro");
  });

  test("key mashing cannot skip a question or break the state", async ({ page }) => {
    const errors = trackErrors(page);
    await open(page);
    await start(page);
    for (let i = 0; i < 40; i++) await page.keyboard.press("n", { delay: 5 });
    await expect(lesson(page)).toHaveAttribute("data-step", "q-predict-ten");
    await expect(page.getByTestId("next")).toBeDisabled();

    const keys = ["p", "r", "n", " ", "ArrowRight", "ArrowLeft", "Enter", "1", "x", "Escape", "P", "N"];
    for (let i = 0; i < 6; i++) for (const k of keys) await page.keyboard.press(k, { delay: 2 });
    const step = (await lesson(page).getAttribute("data-step")) ?? "";
    expect(KNOWN_STEPS).toContain(step);
    await expect(page.locator("[data-cube]")).toHaveCount(80);
    expect(errors).toEqual([]);
  });

  test("double-clicking Check with the same wrong answer counts as one try", async ({ page }) => {
    await goTo(page, "q-predict-total");
    await page.getByTestId("answer-input").fill("70");
    await page.getByTestId("check").dblclick();
    await expect(page.getByTestId("feedback")).toContainText("Don't forget the new ten");
    await expect(page.getByTestId("show-me")).toHaveCount(0);
    await typeAndCheck(page, "71");
    await expect(page.getByTestId("show-me")).toBeVisible();
  });

  test("double-clicking Check with the right answer, then mashing Next, moves exactly once", async ({ page }) => {
    await goTo(page, "q-predict-total");
    await page.getByTestId("answer-input").fill("80");
    await page.getByTestId("check").dblclick();
    await expect(page.getByTestId("feedback")).toHaveAttribute("data-status", "correct");
    await page.getByTestId("next").click();
    await page.keyboard.press("n");
    await page.keyboard.press("n");
    await expect(lesson(page)).toHaveAttribute("data-step", "snap-scene");
  });

  test("rapid pause toggling leaves a consistent state", async ({ page }) => {
    await open(page);
    await start(page);
    for (let i = 0; i < 7; i++) await page.getByTestId("pause").click();
    await expect(lesson(page)).toHaveAttribute("data-playing", "false");
    const beat = await lesson(page).getAttribute("data-beat");
    const pos = await page.locator('[data-cube="b-o1"]').getAttribute("x");
    await page.waitForTimeout(800);
    await expect(lesson(page)).toHaveAttribute("data-beat", beat!);
    expect(await page.locator('[data-cube="b-o1"]').getAttribute("x")).toBe(pos);
  });

  test("rapid chapter clicking during animation ends on the last chapter clicked", async ({ page }) => {
    const errors = trackErrors(page);
    await goTo(page, "snap-scene", "?speed=2");
    for (let i = 0; i < 5; i++) {
      await page.getByTestId("chapter-meet").click();
      await page.getByTestId("chapter-snap").click();
      await page.getByTestId("chapter-predict").click();
    }
    await expect(lesson(page)).toHaveAttribute("data-step", "q-predict-ten");
    // Answers survive navigation.
    await expect(page.getByTestId("feedback")).toHaveAttribute("data-status", "correct");
    expect(errors).toEqual([]);
  });
});
