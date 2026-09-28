import { expect, test } from "@playwright/test";
import { answerCorrectly, goTo, lesson, next, open, start, trackErrors } from "./helpers";

test.describe("chapter navigation", () => {
  test("chapters unlock as the learner goes, and completed chapters can be replayed", async ({ page }) => {
    await open(page, "?speed=4");
    await start(page);
    await expect(page.getByTestId("chapter-meet")).toHaveAttribute("aria-current", "step");
    await expect(page.getByTestId("chapter-predict")).toBeDisabled();

    await next(page);
    await expect(lesson(page)).toHaveAttribute("data-chapter", "predict");
    await expect(page.getByTestId("chapter-predict")).toHaveAttribute("aria-current", "step");
    await expect(page.getByTestId("chapter-meet")).toBeEnabled();
    await expect(page.getByTestId("chapter-snap")).toBeDisabled();

    // Go back to chapter 1: it replays from the beginning.
    await page.getByTestId("chapter-meet").click();
    await expect(lesson(page)).toHaveAttribute("data-step", "meet-scene");
    await expect(lesson(page)).toHaveAttribute("data-beat", "0");
    await expect(lesson(page)).toHaveAttribute("data-playing", "true");

    // Return to chapter 2; answer both predictions; chapter 3 unlocks only after Next.
    await page.getByTestId("chapter-predict").click();
    await answerCorrectly(page);
    await next(page);
    await answerCorrectly(page);
    await expect(page.getByTestId("chapter-snap")).toBeDisabled();
    await next(page);
    await expect(lesson(page)).toHaveAttribute("data-chapter", "snap");
    await expect(page.getByTestId("chapter-snap")).toBeEnabled();
  });

  test("navigating mid-animation cleanly restarts the chosen chapter", async ({ page }) => {
    const errors = trackErrors(page);
    await goTo(page, "snap-scene", "?speed=2");
    await expect.poll(async () => Number(await lesson(page).getAttribute("data-beat")), { timeout: 15_000 }).toBeGreaterThanOrEqual(1);
    await expect(lesson(page)).toHaveAttribute("data-playing", "true");

    await page.getByTestId("chapter-meet").click();
    await expect(lesson(page)).toHaveAttribute("data-step", "meet-scene");
    await expect(lesson(page)).toHaveAttribute("data-beat", "0");
    await expect(page.locator("svg[data-stage]")).toHaveAttribute("data-stage", "apart");

    // Jump forward again mid-scene, then straight back and forth.
    await page.getByTestId("chapter-snap").click();
    await page.getByTestId("chapter-predict").click();
    await page.getByTestId("chapter-snap").click();
    await expect(lesson(page)).toHaveAttribute("data-step", "snap-scene");
    await expect(lesson(page)).toHaveAttribute("data-beat", "0");
    await expect(page.locator("[data-cube]")).toHaveCount(80);
    expect(errors).toEqual([]);
  });

  test("the snap scene ends with 8 tens and the total 80, with every cube still present", async ({ page }) => {
    await goTo(page, "snap-scene", "?speed=20");
    await expect(lesson(page)).toHaveAttribute("data-finished", "true", { timeout: 20_000 });
    const svg = page.locator("svg[data-stage]");
    await expect(svg).toHaveAttribute("data-stage", "tensTogether");
    await expect(page.locator("[data-cube]")).toHaveCount(80);
    await expect(page.locator("[data-stick]")).toHaveCount(8);
    await expect(svg.locator(".row-value-total")).toHaveText("80");
    await expect(svg.locator(".count-label")).toHaveText(["10", "20", "30", "40", "50", "60", "70", "80"]);
    await expect(svg.locator(".footer text")).toHaveText("48 + 32 = 80");
    await expect(page.getByTestId("caption")).toContainText("48 + 32 = 80");
  });

  test("the optional Grade 3 bonus can be skipped", async ({ page }) => {
    await goTo(page, "bonus-intro");
    await expect(page.locator(".grade")).toHaveText("Grade 3 bonus");
    await page.getByTestId("skip-bonus").click();
    await expect(lesson(page)).toHaveAttribute("data-chapter", "wrap");
    await expect(page.getByTestId("chapter-bonus")).toBeEnabled();
    await expect(lesson(page)).toHaveAttribute("data-finished", "true", { timeout: 20_000 });
    await expect(page.getByTestId("finish")).toBeVisible();
    await expect(page.getByRole("button", { name: "Try the Grade 3 bonus" })).toBeVisible();
  });
});
