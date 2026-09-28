import { expect, test } from "@playwright/test";
import { cubeXY, goTo, lesson, open, start } from "./helpers";

test.describe("prefers-reduced-motion: reduce", () => {
  test.use({ reducedMotion: "reduce" });

  test("objects jump to each new arrangement instead of sliding", async ({ page }) => {
    await open(page);
    await expect(lesson(page)).toHaveAttribute("data-motion", "reduced");
    await expect(page.getByTestId("toggle-motion")).toHaveAttribute("aria-pressed", "true");
    await start(page);
    // The first beat would normally spend 2.2 s sliding cubes out of the jumble.
    await page.waitForTimeout(120);
    const early = await cubeXY(page, "a-o7");
    await page.waitForTimeout(900);
    const later = await cubeXY(page, "a-o7");
    expect(later).toEqual(early);
    await expect(page.locator("svg[data-stage]")).toHaveAttribute("data-stage", "apart");
    // Captions still advance for reading, and the learner still controls Next.
    await expect(page.getByTestId("caption")).toContainText("snap cubes");
  });

  test("the Next button does not pulse", async ({ page }) => {
    await goTo(page, "meet-scene", "?speed=20");
    await expect(lesson(page)).toHaveAttribute("data-finished", "true", { timeout: 15_000 });
    await expect(page.getByTestId("next")).toHaveClass(/ready/);
    const animation = await page.getByTestId("next").evaluate((el) => getComputedStyle(el).animationName);
    expect(animation).toBe("none");
  });
});

test.describe("full motion (for comparison) and the in-app toggle", () => {
  test("without the preference, cubes slide through in-between positions", async ({ page }) => {
    await open(page);
    await expect(lesson(page)).toHaveAttribute("data-motion", "full");
    await start(page);
    await page.waitForTimeout(500);
    const mid = await cubeXY(page, "a-o7");
    await page.waitForTimeout(2600);
    const end = await cubeXY(page, "a-o7");
    expect(mid).not.toEqual(end);
  });

  test("the Reduce motion toggle works even when the system setting is off", async ({ page }) => {
    await open(page);
    await page.getByTestId("toggle-motion").click();
    await expect(lesson(page)).toHaveAttribute("data-motion", "reduced");
    await start(page);
    await page.waitForTimeout(120);
    const early = await cubeXY(page, "a-o7");
    await page.waitForTimeout(900);
    expect(await cubeXY(page, "a-o7")).toEqual(early);
  });
});
