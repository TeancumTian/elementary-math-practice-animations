import { expect, test } from "@playwright/test";
import { chooseAndCheck, goTo, lesson, next, typeAndCheck } from "./helpers";

test.describe("specific corrective feedback", () => {
  test("make-a-ten prediction: each wrong choice gets its own clue", async ({ page }) => {
    await goTo(page, "q-predict-ten");
    const feedback = page.getByTestId("feedback");

    await chooseAndCheck(page, /Not enough for a ten-stick/);
    await expect(feedback).toHaveAttribute("data-status", "incorrect");
    await expect(feedback).toContainText("Not yet");
    await expect(feedback).toContainText("Count on from 8: 9, 10. That's 10 loose cubes");
    await expect(page.locator("label.choice.tried")).toContainText("not this one");
    await expect(page.getByTestId("next")).toBeDisabled();

    await chooseAndCheck(page, /Two ten-sticks/);
    await expect(feedback).toContainText("that makes just one ten-stick, not two");

    await chooseAndCheck(page, /Exactly one ten-stick/);
    await expect(feedback).toHaveAttribute("data-status", "correct");
    await expect(feedback).toContainText("8 ones + 2 ones = 10 ones, and 10 ones snap into 1 ten-stick");
    await expect(page.getByTestId("next")).toBeEnabled();
  });

  test("48 + 32: feedback diagnoses the mistake behind each wrong total", async ({ page }) => {
    await goTo(page, "q-predict-total");
    const feedback = page.getByTestId("feedback");
    const cases: [string, string][] = [
      ["70", "Don't forget the new ten made from 8 ones + 2 ones"],
      ["710", "7 tens and 10 ones side by side"],
      ["17", "added every digit as ones: 4 + 8 + 3 + 2"],
      ["8", "8 is how many ten-sticks there will be"],
      ["82", "Check the ones place"],
      ["90", "one ten too many"],
      ["65", "Check the ones place"],
      ["100", "Not yet. Add the tens"],
    ];
    for (const [value, clue] of cases) {
      await typeAndCheck(page, value);
      await expect(feedback).toHaveAttribute("data-status", "incorrect");
      await expect(feedback).toContainText(clue);
    }
    await typeAndCheck(page, "80");
    await expect(feedback).toHaveAttribute("data-status", "correct");
    await expect(feedback).toContainText("Yes! 48 + 32 = 80");
    await expect(page.getByTestId("answer-input")).toBeDisabled();
  });

  test("after two wrong tries, Show me explains the answer and lets the learner continue", async ({ page }) => {
    await goTo(page, "q-predict-total");
    await expect(page.getByTestId("show-me")).toHaveCount(0);
    await typeAndCheck(page, "70");
    await expect(page.getByTestId("show-me")).toHaveCount(0);
    await typeAndCheck(page, "710");
    await page.getByTestId("show-me").click();
    const feedback = page.getByTestId("feedback");
    await expect(feedback).toHaveAttribute("data-status", "revealed");
    await expect(feedback).toContainText("4 tens + 3 tens + 1 ten = 8 tens = 80");
    await expect(page.getByTestId("next")).toBeEnabled();
    await next(page);
    await expect(lesson(page)).toHaveAttribute("data-step", "snap-scene");
  });

  test("explain questions correct the idea that regrouping changes the amount", async ({ page }) => {
    await goTo(page, "q-explain-same");
    const feedback = page.getByTestId("feedback");
    await chooseAndCheck(page, /It went up/);
    await expect(feedback).toContainText("no new cubes came in");
    await chooseAndCheck(page, /It went down/);
    await expect(feedback).toContainText("didn't disappear");
    await chooseAndCheck(page, /It stayed the same/);
    await expect(feedback).toContainText("There are still 80 cubes");
    await next(page);

    await chooseAndCheck(page, /Sorting the cubes by color/);
    await expect(feedback).toContainText("Color is just decoration");
    await chooseAndCheck(page, /Counting every cube/);
    await expect(feedback).toContainText("slow and easy to lose your place");
    await chooseAndCheck(page, /Making a new ten/);
    await expect(feedback).toHaveAttribute("data-status", "correct");
  });

  test("array question: feedback names the counting mistake", async ({ page }) => {
    await goTo(page, "q-array-total");
    const feedback = page.getByTestId("feedback");
    const cases: [string, string][] = [
      ["7", "You added 3 + 4"],
      ["34", "side by side"],
      ["8", "only 2 rows of 4"],
      ["16", "would be 4 rows of 4"],
      ["9", "only 3 columns of 3"],
    ];
    for (const [value, clue] of cases) {
      await typeAndCheck(page, value);
      await expect(feedback).toContainText(clue);
    }
    await typeAndCheck(page, "12");
    await expect(feedback).toHaveAttribute("data-status", "correct");
  });

  test("the array regroup scene keeps 12 robots and the follow-up questions check it", async ({ page }) => {
    await goTo(page, "bonus-regroup");
    await expect(lesson(page)).toHaveAttribute("data-finished", "true", { timeout: 20_000 });
    await expect(page.locator("[data-robot]")).toHaveCount(12);
    await expect(page.locator("[data-group^='col-']")).toHaveCount(4);
    await expect(page.locator(".footer text")).toHaveText("3 + 3 + 3 + 3 = 12 robots");
    await next(page);
    const feedback = page.getByTestId("feedback");
    await chooseAndCheck(page, /Columns make more robots/);
    await expect(feedback).toContainText("Same robots, so the same number");
    await chooseAndCheck(page, /same 12 robots/);
    await expect(feedback).toHaveAttribute("data-status", "correct");
    await next(page);
    await chooseAndCheck(page, /antenna colors/);
    await expect(feedback).toContainText("just decoration");
    await chooseAndCheck(page, /Equal rows or equal columns/);
    await expect(feedback).toContainText("3 × 4 = 4 × 3 = 12");
  });
});
