import { expect, test, type Page } from "@playwright/test";
import { goTo, typeAndCheck } from "./helpers";

/** Every place an answer could leak: visible or hidden text, ARIA/data/title attributes, input values, the page title. */
async function findLeaks(page: Page, answer: number): Promise<string[]> {
  return page.evaluate((n) => {
    const re = new RegExp(`(?<!\\d)${n}(?!\\d)`);
    const hits: string[] = [];
    const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.parentElement?.closest("script, style, noscript, template")) continue;
      if (re.test(node.textContent ?? "")) hits.push(`text: "${node.textContent}"`);
    }
    for (const el of Array.from(document.querySelectorAll("*"))) {
      for (const attr of Array.from(el.attributes)) {
        const checked = attr.name.startsWith("aria-") || attr.name.startsWith("data-") || ["title", "alt", "placeholder", "value", "content", "label"].includes(attr.name);
        if (checked && re.test(attr.value)) hits.push(`<${el.tagName.toLowerCase()} ${attr.name}="${attr.value}">`);
      }
      if ((el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) && re.test(el.value)) hits.push("input value");
    }
    if (re.test(document.title)) hits.push("document.title");
    return hits;
  }, answer);
}

async function liveRegionText(page: Page): Promise<string> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll("[aria-live], [role=status], [role=alert]"))
      .map((el) => el.textContent ?? "")
      .join(" | "),
  );
}

const CASES = [
  { step: "q-predict-total", answer: 80, wrong: "70" },
  { step: "q-transfer-total", answer: 60, wrong: "50" },
  { step: "q-array-total", answer: 12, wrong: "7" },
];

for (const { step, answer, wrong } of CASES) {
  test(`${step}: ${answer} is nowhere in the DOM, ARIA, or live regions before submission`, async ({ page }) => {
    await goTo(page, step);
    const re = new RegExp(`(?<!\\d)${answer}(?!\\d)`);

    expect(await findLeaks(page, answer)).toEqual([]);
    expect(await page.locator("body").ariaSnapshot()).not.toMatch(re);
    expect(await liveRegionText(page)).not.toMatch(re);

    // Opening the hint doesn't leak it either.
    await page.getByTestId("hint").click();
    expect(await findLeaks(page, answer)).toEqual([]);

    // Neither does corrective feedback for a wrong answer.
    await typeAndCheck(page, wrong);
    await expect(page.getByTestId("feedback")).toHaveAttribute("data-status", "incorrect");
    expect(await findLeaks(page, answer)).toEqual([]);
    expect(await page.locator("body").ariaSnapshot()).not.toMatch(re);

    // After a correct submission the answer is announced.
    await typeAndCheck(page, String(answer));
    await expect(page.getByTestId("feedback")).toHaveAttribute("data-status", "correct");
    expect(await liveRegionText(page)).toMatch(re);
  });
}

test("multiple-choice questions don't mark the keyed answer before submission", async ({ page }) => {
  await goTo(page, "q-predict-ten");
  const markers = await page.evaluate(
    () => document.querySelectorAll("[data-correct], [data-answer], .choice.answer, .mark-right, [aria-checked='true']").length,
  );
  expect(markers).toBe(0);
  // Radio values are neutral letters, not meanings.
  const values = await page.locator("input[type=radio]").evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
  expect(values).toEqual(["a", "b", "c"]);
  await expect(page.getByTestId("feedback")).toBeEmpty();
});
