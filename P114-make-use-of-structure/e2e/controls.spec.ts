import { expect, test } from "@playwright/test";
import { cubeXY, lesson, next, open, start, trackErrors } from "./helpers";

test.describe("start, pause/resume, replay", () => {
  test("cover shows the story, a Start button, and locked chapters", async ({ page }) => {
    const errors = trackErrors(page);
    await open(page);
    await expect(page.getByRole("heading", { level: 1, name: "Look for Structure!" })).toBeVisible();
    await expect(page.getByTestId("start")).toBeVisible();
    await expect(page.getByTestId("chapter-meet")).toBeDisabled();
    await expect(page.getByTestId("chapter-bonus")).toBeDisabled();
    // The cover pile has all 80 cubes, not yet organized.
    await expect(page.locator("[data-cube]")).toHaveCount(80);
    await expect(page.locator("svg[data-stage='scattered']")).toBeVisible();
    await expect(page.getByTestId("next")).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("Start plays chapter 1; Pause freezes the animation and Resume continues it", async ({ page }) => {
    await open(page);
    await start(page);
    await expect(lesson(page)).toHaveAttribute("data-chapter", "meet");
    await expect(lesson(page)).toHaveAttribute("data-playing", "true");
    await expect(page.getByTestId("caption")).toContainText("snap cubes");

    // Pause during the first move (cubes travel from the jumble to their places for 2.2 s).
    await page.waitForTimeout(700);
    await page.getByTestId("pause").click();
    await expect(lesson(page)).toHaveAttribute("data-playing", "false");
    await expect(page.getByTestId("pause")).toHaveText(/Resume/);
    const frozen = await cubeXY(page, "a-o7");
    const beat = await lesson(page).getAttribute("data-beat");
    await page.waitForTimeout(1200);
    expect(await cubeXY(page, "a-o7")).toEqual(frozen);
    await expect(lesson(page)).toHaveAttribute("data-beat", beat!);

    await page.getByTestId("pause").click();
    await expect(lesson(page)).toHaveAttribute("data-playing", "true");
    await expect(page.getByTestId("pause")).toHaveText(/Pause/);
    await expect.poll(async () => (await cubeXY(page, "a-o7")).x, { timeout: 5000 }).not.toBe(frozen.x);
  });

  test("Replay restarts the scene from its first beat", async ({ page }) => {
    await open(page, "?speed=6");
    await start(page);
    await expect.poll(async () => Number(await lesson(page).getAttribute("data-beat")), { timeout: 15_000 }).toBeGreaterThanOrEqual(2);
    await page.getByTestId("replay").click();
    await expect(lesson(page)).toHaveAttribute("data-beat", "0");
    await expect(lesson(page)).toHaveAttribute("data-playing", "true");
    await expect(page.getByTestId("caption")).toContainText("love to build robots");
  });

  test("a finished scene waits for the learner, and Next is learner-controlled", async ({ page }) => {
    await open(page, "?speed=20");
    await start(page);
    await expect(lesson(page)).toHaveAttribute("data-finished", "true", { timeout: 15_000 });
    // Still on the same step: nothing auto-advances.
    await page.waitForTimeout(800);
    await expect(lesson(page)).toHaveAttribute("data-step", "meet-scene");
    await expect(page.getByText(/Tap Next when you're ready/)).toBeVisible();
    await expect(page.getByTestId("pause")).toBeDisabled();
    await next(page);
    await expect(lesson(page)).toHaveAttribute("data-step", "q-predict-ten");
    // Questions wait: Next is disabled until the answer is checked.
    await expect(page.getByTestId("next")).toBeDisabled();
    await expect(page.getByTestId("pause")).toBeDisabled();
  });

  test("captions can be hidden visually but stay available to screen readers", async ({ page }) => {
    await open(page);
    await start(page);
    await page.getByTestId("toggle-captions").click();
    await expect(page.getByTestId("toggle-captions")).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByTestId("caption")).toHaveClass(/sr-only/);
    await expect(page.getByTestId("caption")).toContainText("snap cubes");
    await page.getByTestId("toggle-captions").click();
    await expect(page.getByTestId("caption")).not.toHaveClass(/sr-only/);
  });
});
