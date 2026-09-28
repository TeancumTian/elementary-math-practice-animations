import { expect, test, type Page } from "@playwright/test";
import { goTo, lesson, open, typeAndCheck } from "./helpers";

const SIZES = [
  { name: "mobile", viewport: { width: 390, height: 844 }, touch: true },
  { name: "desktop", viewport: { width: 1280, height: 800 }, touch: false },
] as const;

async function noSidewaysScroll(page: Page) {
  const width = page.viewportSize()!.width;
  const metrics = await page.evaluate(() => ({ inner: window.innerWidth, scroll: document.documentElement.scrollWidth }));
  expect(metrics.inner).toBe(width);
  expect(metrics.scroll).toBeLessThanOrEqual(width);
}

async function pauseAtBeat(page: Page, beat: number, settleMs: number) {
  await expect(lesson(page)).toHaveAttribute("data-beat", String(beat), { timeout: 20_000 });
  await page.waitForTimeout(settleMs);
  await page.keyboard.press("p");
  await expect(lesson(page)).toHaveAttribute("data-playing", "false");
}

for (const size of SIZES) {
  test.describe(`${size.name} screenshots`, () => {
    test.use({ viewport: size.viewport, hasTouch: size.touch, isMobile: size.touch, deviceScaleFactor: 2 });

    test("initial, intermediate, and final states", async ({ page }) => {
      // Phones: two real viewport captures per state (the stage at the top, then scrolled to the panel),
      // because a full-page capture would draw the sticky playback bar in the wrong place.
      const shot = async (name: string) => {
        if (!size.touch) {
          await page.screenshot({ path: `screenshots/${size.name}-${name}.png`, fullPage: true });
          return;
        }
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: `screenshots/${size.name}-${name}-a-top.png` });
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await page.screenshot({ path: `screenshots/${size.name}-${name}-b-panel.png` });
      };

      // Initial: the cover with the jumbled cubes.
      await open(page);
      await noSidewaysScroll(page);
      await shot("01-initial");

      // Intermediate 1: a prediction with specific corrective feedback.
      await goTo(page, "q-predict-total");
      await typeAndCheck(page, "70");
      await expect(page.getByTestId("feedback")).toHaveAttribute("data-status", "incorrect");
      await noSidewaysScroll(page);
      await shot("02-predict-feedback");

      // Intermediate 2: mid-animation, right after 8 ones + 2 ones snap into a new ten.
      await goTo(page, "snap-scene", "?speed=3");
      await pauseAtBeat(page, 2, 700);
      await expect(page.locator("svg[data-stage]")).toHaveAttribute("data-stage", "snapTen");
      await shot("03-snap-a-ten");

      // Intermediate 3: the same 12 robots regrouped from rows to columns.
      await goTo(page, "bonus-regroup", "?speed=3");
      await pauseAtBeat(page, 1, 900);
      await expect(page.locator("[data-robot]")).toHaveCount(12);
      await shot("04-array-columns");

      // Final: the wrap-up, finished.
      await goTo(page, "wrap-scene", "?speed=20");
      await expect(lesson(page)).toHaveAttribute("data-finished", "true", { timeout: 20_000 });
      await expect(page.getByTestId("finish")).toBeVisible();
      await noSidewaysScroll(page);
      await shot("05-final");
    });
  });
}
