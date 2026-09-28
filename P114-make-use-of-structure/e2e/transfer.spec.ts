import { expect, test } from "@playwright/test";
import { goTo, lesson, next, typeAndCheck } from "./helpers";

test("fresh transfer question 36 + 24: hint, specific feedback, then an animated check", async ({ page }) => {
  await goTo(page, "q-transfer-total");
  await expect(page.locator(".equation-big")).toHaveText("36 + 24 = ?");
  // The mat shows the new numbers as tens and ones.
  const svg = page.locator("svg[data-stage]");
  await expect(svg.locator(".row-value")).toHaveText(["36", "24", "?"]);
  await expect(page.locator("[data-cube]")).toHaveCount(60);

  await page.getByTestId("hint").click();
  await expect(page.getByTestId("hint-text")).toContainText("6 ones + 4 ones");

  const feedback = page.getByTestId("feedback");
  await typeAndCheck(page, "50");
  await expect(feedback).toContainText("Don't forget the new ten made from 6 ones + 4 ones");
  await typeAndCheck(page, "510");
  await expect(feedback).toContainText("5 tens and 10 ones side by side");
  await typeAndCheck(page, "60");
  await expect(feedback).toHaveAttribute("data-status", "correct");
  await expect(feedback).toContainText("Yes! 36 + 24 = 60");

  await next(page);
  await expect(lesson(page)).toHaveAttribute("data-step", "try-check");
  await expect(lesson(page)).toHaveAttribute("data-finished", "true", { timeout: 20_000 });
  await expect(svg.locator(".count-label")).toHaveText(["10", "20", "30", "40", "50", "60"]);
  await expect(svg.locator(".footer text")).toHaveText("36 + 24 = 60");
  await expect(page.locator("[data-cube]")).toHaveCount(60);
});
