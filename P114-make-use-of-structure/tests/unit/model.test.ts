import { describe, expect, it } from "vitest";
import {
  ADD_GEOMETRY,
  ADDITION_STAGES,
  ARRAY_GEOMETRY,
  ARRAY_STAGES,
  MAIN,
  PARADE,
  QUESTIONS,
  TEN,
  TRANSFER,
  additionMisconceptions,
  arrayMisconceptions,
  checkAddition,
  checkArray,
  checkChoice,
  countByTens,
  createAdditionModel,
  createArrayModel,
  layoutAddition,
  layoutArray,
  parseWholeNumber,
  placeValue,
  placeValueLabel,
  type AdditionLayout,
  type ChoiceQuestion,
  type NumberQuestion,
  type Pos,
} from "@/lib/model";

/** Whole-number match that won't find "80" inside "180" or "800". */
const hasNumber = (text: string, n: number) => new RegExp(`(?<!\\d)${n}(?!\\d)`).test(text);

function textsOf(l: AdditionLayout): string[] {
  return [
    l.footer,
    l.equation,
    l.description,
    ...l.headers.map((h) => h.text),
    ...l.rowLabels.flatMap((r) => [r.name, r.value]),
    ...l.countLabels.map((c) => c.text),
    ...l.cells.flatMap((c) => (c.chip ? [c.chip.text] : [])),
  ];
}

function rectsOverlap(a: Pos, b: Pos, size: number): boolean {
  return a.x < b.x + size - 0.01 && b.x < a.x + size - 0.01 && a.y < b.y + size - 0.01 && b.y < a.y + size - 0.01;
}

describe("concrete verification cases", () => {
  it("48 + 32 = 80", () => {
    expect(MAIN.a).toBe(48);
    expect(MAIN.b).toBe(32);
    expect(MAIN.sum).toBe(80);
    expect(checkAddition(MAIN, "80")).toMatchObject({ valid: true, correct: true });
  });

  it("48 is 4 tens and 8 ones; 32 is 3 tens and 2 ones", () => {
    expect(placeValue(48)).toEqual({ tens: 4, ones: 8 });
    expect(placeValue(32)).toEqual({ tens: 3, ones: 2 });
    expect(placeValueLabel(48)).toBe("4 tens and 8 ones");
    expect(placeValueLabel(32)).toBe("3 tens and 2 ones");
  });

  it("8 ones + 2 ones = 1 ten (with 0 ones left over)", () => {
    expect(MAIN.pvA.ones + MAIN.pvB.ones).toBe(10);
    expect(MAIN.onesSum).toBe(TEN);
    expect(MAIN.newTens).toBe(1);
    expect(MAIN.leftoverOnes).toBe(0);
    expect(MAIN.newTenIds).toHaveLength(10);
    // The new ten is made of Juno's 8 loose cubes and Remy's 2 loose cubes.
    expect(MAIN.newTenIds.filter((id) => id.startsWith("a-o"))).toHaveLength(8);
    expect(MAIN.newTenIds.filter((id) => id.startsWith("b-o"))).toHaveLength(2);
    const snapped = layoutAddition(MAIN, "snapTen", true).sticks.find((s) => s.isNew);
    expect(snapped?.memberIds).toEqual(MAIN.newTenIds);
  });

  it("so the tens combine: 4 tens + 3 tens + 1 ten = 8 tens = 80", () => {
    expect(MAIN.tensBeforeRegroup + MAIN.newTens).toBe(8);
    expect(MAIN.pvSum).toEqual({ tens: 8, ones: 0 });
    const final = layoutAddition(MAIN, "tensTogether", true);
    const totalTens = final.cells.find((c) => c.row === "total" && c.place === "tens")!;
    const totalOnes = final.cells.find((c) => c.row === "total" && c.place === "ones")!;
    expect(totalTens.sticks).toBe(8);
    expect(totalOnes.loose).toBe(0);
    expect(totalTens.sticks * TEN + totalOnes.loose).toBe(80);
    expect(final.countLabels.map((c) => c.text)).toEqual(["10", "20", "30", "40", "50", "60", "70", "80"]);
    expect(countByTens(8).at(-1)).toBe(80);
    expect(final.rowLabels.find((r) => r.row === "total")?.value).toBe("80");
    expect(final.equation).toBe("48 + 32 = 80");
  });

  it("the Grade 3 array has 12 objects grouped by rows (3 of 4) or by columns (4 of 3)", () => {
    expect(PARADE.rows).toBe(3);
    expect(PARADE.cols).toBe(4);
    expect(PARADE.total).toBe(12);
    expect(PARADE.rowGroups).toHaveLength(3);
    expect(PARADE.rowGroups.every((g) => g.length === 4)).toBe(true);
    expect(PARADE.columnGroups).toHaveLength(4);
    expect(PARADE.columnGroups.every((g) => g.length === 3)).toBe(true);
    const byRows = PARADE.rowGroups.flat();
    const byCols = PARADE.columnGroups.flat();
    expect(byRows).toHaveLength(12);
    expect(byCols).toHaveLength(12);
    expect(new Set(byRows).size).toBe(12);
    expect(new Set(byCols)).toEqual(new Set(byRows));
    expect(checkArray(PARADE, "12")).toMatchObject({ valid: true, correct: true });
  });
});

describe("regrouping preserves quantity (addition model)", () => {
  for (const [name, model, total] of [
    ["48 + 32", MAIN, 80],
    ["36 + 24", TRANSFER, 60],
  ] as const) {
    describe(name, () => {
      const layouts = ADDITION_STAGES.map((s) => layoutAddition(model, s, true));

      it("has exactly one cube object per unit, with stable ids", () => {
        expect(model.cubes).toHaveLength(total);
        expect(new Set(model.cubeIds).size).toBe(total);
      });

      it.each(ADDITION_STAGES)("stage %s keeps every cube and the same total", (stage) => {
        const l = layoutAddition(model, stage, true);
        expect(Object.keys(l.positions).sort()).toEqual([...model.cubeIds].sort());
        expect(l.account.cubes).toBe(total);
        expect(l.account.total).toBe(total);
        expect(l.account.sticks * TEN + l.account.loose).toBe(total);
        // Every ten-stick has exactly ten members, and no cube is in two sticks.
        const members = l.sticks.flatMap((s) => s.memberIds);
        expect(l.sticks.every((s) => s.memberIds.length === TEN)).toBe(true);
        expect(new Set(members).size).toBe(members.length);
        // Cell counts add back up to the total.
        const fromCells = l.cells.reduce((sum, c) => sum + c.sticks * TEN + c.loose, 0);
        expect(stage === "scattered" ? total : fromCells).toBe(total);
      });

      it("keeps the count identical between every pair of consecutive stages", () => {
        for (let i = 1; i < layouts.length; i++) {
          expect(Object.keys(layouts[i].positions).sort()).toEqual(Object.keys(layouts[i - 1].positions).sort());
          expect(layouts[i].account.total).toBe(layouts[i - 1].account.total);
        }
      });

      it.each(ADDITION_STAGES)("stage %s: no two cubes overlap and all stay inside the mat", (stage) => {
        const l = layoutAddition(model, stage, true);
        const pts = model.cubeIds.map((id) => l.positions[id]);
        for (let i = 0; i < pts.length; i++) {
          const p = pts[i];
          expect(p.x).toBeGreaterThanOrEqual(ADD_GEOMETRY.tensCol.x - 2);
          expect(p.x + ADD_GEOMETRY.cube).toBeLessThanOrEqual(ADD_GEOMETRY.width);
          expect(p.y).toBeGreaterThanOrEqual(ADD_GEOMETRY.headerH);
          expect(p.y + ADD_GEOMETRY.cube).toBeLessThanOrEqual(l.height - ADD_GEOMETRY.footerH);
          for (let j = i + 1; j < pts.length; j++) expect(rectsOverlap(p, pts[j], ADD_GEOMETRY.cube)).toBe(false);
        }
      });

      it.each(ADDITION_STAGES)("stage %s: count chips fit inside their cells and clear of count labels", (stage) => {
        const l = layoutAddition(model, stage, true);
        for (const cell of l.cells) {
          if (!cell.chip) continue;
          const { cx, cy, w } = cell.chip;
          expect(cx - w / 2).toBeGreaterThanOrEqual(cell.rect.x);
          expect(cx + w / 2).toBeLessThanOrEqual(cell.rect.x + cell.rect.w);
          expect(cy - 12).toBeGreaterThanOrEqual(cell.rect.y);
          expect(cy + 12).toBeLessThanOrEqual(cell.rect.y + cell.rect.h);
          // Count-by-tens labels (12px bold, about 7.5 units per digit) end before the chip starts.
          for (const label of l.countLabels) expect(label.x + label.text.length * 7.5).toBeLessThan(cx - w / 2);
          // No cube sits under a chip.
          for (const id of model.cubeIds) {
            const p = l.positions[id];
            const hitsX = p.x < cx + w / 2 && p.x + ADD_GEOMETRY.cube > cx - w / 2;
            const hitsY = p.y < cy + 12 && p.y + ADD_GEOMETRY.cube > cy - 12;
            expect(hitsX && hitsY).toBe(false);
          }
        }
      });

      it("footer place-value sentences always add up to the total", () => {
        for (const l of layouts.filter((x) => x.stage !== "scattered")) {
          const tens = [...l.footer.matchAll(/(\d+) (?:new )?tens?\b/g)].reduce((s, m) => s + Number(m[1]), 0);
          const ones = [...l.footer.matchAll(/(\d+) ones?\b/g)].reduce((s, m) => s + Number(m[1]), 0);
          expect(tens * TEN + ones).toBe(total);
          expect(l.footer.endsWith(`= ${total} cubes`)).toBe(true);
        }
      });

      it("never shows the total in any label before it is revealed", () => {
        for (const stage of ADDITION_STAGES) {
          const texts = textsOf(layoutAddition(model, stage, false));
          for (const t of texts) expect(hasNumber(t, total)).toBe(false);
        }
      });
    });
  }

  it("36 + 24 = 60 uses the same structure: 6 ones + 4 ones = 1 ten", () => {
    expect(TRANSFER.sum).toBe(60);
    expect(TRANSFER.onesSum).toBe(10);
    expect(TRANSFER.newTens).toBe(1);
    expect(TRANSFER.pvSum).toEqual({ tens: 6, ones: 0 });
  });

  it("is deterministic: the same inputs give identical layouts", () => {
    for (const stage of ADDITION_STAGES) {
      expect(layoutAddition(createAdditionModel(48, 32), stage, true)).toEqual(layoutAddition(MAIN, stage, true));
    }
  });

  it("rejects numbers the Grade 2 mat does not support", () => {
    expect(() => createAdditionModel(5, 32)).toThrow();
    expect(() => createAdditionModel(68, 45)).toThrow();
    expect(() => createAdditionModel(4.5, 32)).toThrow();
  });
});

describe("regrouping an array preserves its count", () => {
  it.each(ARRAY_STAGES)("stage %s has all 12 robots", (stage) => {
    const l = layoutArray(PARADE, stage, true);
    expect(Object.keys(l.positions).sort()).toEqual([...PARADE.robotIds].sort());
    expect(l.count).toBe(12);
    expect(l.rowGroups.reduce((s, g) => s + g.memberIds.length, 0)).toBe(12);
    expect(l.columnGroups.reduce((s, g) => s + g.memberIds.length, 0)).toBe(12);
  });

  it("row grouping and column grouping are labeled from the model", () => {
    const rows = layoutArray(PARADE, "rows", true);
    const cols = layoutArray(PARADE, "columns", true);
    expect(rows.rowGroups.map((g) => g.label)).toEqual(["4", "4", "4"]);
    expect(cols.columnGroups.map((g) => g.label)).toEqual(["3", "3", "3", "3"]);
    expect(rows.footer).toBe("4 + 4 + 4 = 12 robots");
    expect(cols.footer).toBe("3 + 3 + 3 + 3 = 12 robots");
  });

  it.each(["array", "rows", "columns"] as const)("stage %s: robots don't overlap and stay on the stage", (stage) => {
    const l = layoutArray(PARADE, stage, true);
    const pts = PARADE.robotIds.map((id) => l.positions[id]);
    for (let i = 0; i < pts.length; i++) {
      expect(pts[i].x).toBeGreaterThanOrEqual(0);
      expect(pts[i].x + ARRAY_GEOMETRY.robot).toBeLessThanOrEqual(ARRAY_GEOMETRY.width);
      expect(pts[i].y + ARRAY_GEOMETRY.robot).toBeLessThanOrEqual(ARRAY_GEOMETRY.height - 52);
      for (let j = i + 1; j < pts.length; j++) expect(rectsOverlap(pts[i], pts[j], ARRAY_GEOMETRY.robot)).toBe(false);
    }
  });

  it("regrouping moves robots but keeps each robot's identity (rows stay rows, columns stay columns)", () => {
    const rows = layoutArray(PARADE, "rows", true);
    const cols = layoutArray(PARADE, "columns", true);
    for (const r of PARADE.robots) {
      // Same relative order in both groupings: a robot never swaps places with another.
      const sameRow = PARADE.robots.filter((o) => o.row === r.row && o.col < r.col);
      for (const o of sameRow) {
        expect(rows.positions[o.id].x).toBeLessThan(rows.positions[r.id].x);
        expect(cols.positions[o.id].x).toBeLessThan(cols.positions[r.id].x);
      }
    }
  });

  it("never shows 12 before it is revealed", () => {
    for (const stage of ARRAY_STAGES) {
      const l = layoutArray(PARADE, stage, false);
      expect(hasNumber(`${l.footer} ${l.description}`, 12)).toBe(false);
    }
  });

  it("works for other small arrays too", () => {
    const m = createArrayModel(2, 5);
    expect(m.total).toBe(10);
    expect(m.rowGroups.flat()).toHaveLength(10);
    expect(m.columnGroups.flat()).toHaveLength(10);
  });
});

describe("answer checks give specific, diagnosis-based feedback", () => {
  it("parses whole numbers only", () => {
    expect(parseWholeNumber(" 80 ")).toBe(80);
    expect(parseWholeNumber("080")).toBe(80);
    expect(parseWholeNumber("")).toBeNull();
    expect(parseWholeNumber("8o")).toBeNull();
    expect(parseWholeNumber("-80")).toBeNull();
    expect(parseWholeNumber("12345")).toBeNull();
  });

  it.each([
    ["80", "correct"],
    ["70", "forgotNewTen"],
    ["710", "tensAndOnesSideBySide"],
    ["8", "tensCountOnly"],
    ["17", "allDigitsAsOnes"],
    ["90", "oneTenTooMany"],
    ["82", "onesPlaceWrong"],
    ["60", "notYet"],
  ])("48 + 32: %s → %s", (raw, diagnosis) => {
    const r = checkAddition(MAIN, raw);
    expect(r.valid && r.diagnosis).toBe(diagnosis);
  });

  it.each([
    ["60", "correct"],
    ["50", "forgotNewTen"],
    ["510", "tensAndOnesSideBySide"],
    ["6", "tensCountOnly"],
    ["15", "allDigitsAsOnes"],
    ["70", "oneTenTooMany"],
    ["64", "onesPlaceWrong"],
  ])("36 + 24: %s → %s", (raw, diagnosis) => {
    const r = checkAddition(TRANSFER, raw);
    expect(r.valid && r.diagnosis).toBe(diagnosis);
  });

  it.each([
    ["12", "correct"],
    ["7", "addedRowsAndColumns"],
    ["34", "digitsSideBySide"],
    ["43", "digitsSideBySide"],
    ["8", "oneRowShort"],
    ["16", "oneRowExtra"],
    ["9", "oneColumnShort"],
    ["15", "oneColumnExtra"],
    ["11", "notYet"],
  ])("3-by-4 array: %s → %s", (raw, diagnosis) => {
    const r = checkArray(PARADE, raw);
    expect(r.valid && r.diagnosis).toBe(diagnosis);
  });

  it("feedback names the specific mistake", () => {
    const fb = (raw: string) => {
      const r = checkAddition(MAIN, raw);
      return r.valid ? r.feedback : "";
    };
    expect(fb("70")).toContain("Don't forget the new ten made from 8 ones + 2 ones");
    expect(fb("710")).toContain("7 tens and 10 ones side by side");
    expect(fb("17")).toContain("4 + 8 + 3 + 2");
    const arr = checkArray(PARADE, "7");
    expect(arr.valid && arr.feedback).toContain("You added 3 + 4");
  });

  it("empty or non-numeric input is not graded", () => {
    expect(checkAddition(MAIN, "").valid).toBe(false);
    expect(checkArray(PARADE, "abc").valid).toBe(false);
  });

  it("each misconception predicts a distinct wrong answer", () => {
    for (const m of [MAIN, TRANSFER]) {
      const values = Object.values(additionMisconceptions(m));
      expect(new Set(values).size).toBe(values.length);
      expect(values).not.toContain(m.sum);
    }
    const a = arrayMisconceptions(PARADE);
    const values = [a.addedRowsAndColumns, ...a.digitsSideBySide, a.oneRowShort, a.oneRowExtra, a.oneColumnShort, a.oneColumnExtra];
    expect(new Set(values).size).toBe(values.length);
    expect(values).not.toContain(PARADE.total);
  });

  it("corrective feedback for a wrong answer never gives the answer away", () => {
    for (let v = 0; v <= 120; v++) {
      for (const [m, check] of [
        [MAIN, (raw: string) => checkAddition(MAIN, raw)],
        [TRANSFER, (raw: string) => checkAddition(TRANSFER, raw)],
      ] as const) {
        const r = check(String(v));
        if (r.valid && !r.correct) expect(hasNumber(r.feedback, m.sum)).toBe(false);
      }
      const a = checkArray(PARADE, String(v));
      if (a.valid && !a.correct) expect(hasNumber(a.feedback, 12)).toBe(false);
    }
  });
});

describe("question bank", () => {
  const numeric = Object.values(QUESTIONS).filter((q): q is NumberQuestion => q.kind === "number");
  const choice = Object.values(QUESTIONS).filter((q): q is ChoiceQuestion => q.kind === "choice");

  it("numeric answers come from the model", () => {
    expect(QUESTIONS["predict-total"]).toMatchObject({ answer: 80, equation: "48 + 32 = ?" });
    expect(QUESTIONS["transfer-total"]).toMatchObject({ answer: 60, equation: "36 + 24 = ?" });
    expect(QUESTIONS["array-total"]).toMatchObject({ answer: 12 });
  });

  it("prompts, equations, and hints never contain the answer", () => {
    for (const q of numeric) {
      for (const text of [q.prompt, q.equation, q.hint]) expect(hasNumber(text, q.answer)).toBe(false);
      expect(q.check(String(q.answer))).toMatchObject({ valid: true, correct: true });
    }
  });

  it("each multiple-choice question has exactly one keyed answer with its own feedback", () => {
    for (const q of choice) {
      expect(q.choices.filter((c) => c.id === q.correctId)).toHaveLength(1);
      expect(new Set(q.choices.map((c) => c.feedback)).size).toBe(q.choices.length);
      for (const c of q.choices) expect(checkChoice(q, c.id).correct).toBe(c.id === q.correctId);
    }
    // The keyed answer isn't always in the same position.
    expect(new Set(choice.map((q) => q.correctId)).size).toBeGreaterThan(1);
  });

  it("asks which structure makes each problem easier", () => {
    const structureQs = [QUESTIONS["explain-structure"], QUESTIONS["array-structure"]] as ChoiceQuestion[];
    for (const q of structureQs) {
      expect(q.prompt).toMatch(/Which structure/);
      const key = q.choices.find((c) => c.id === q.correctId)!;
      expect(key.text).toMatch(/ten|rows/);
    }
    // A decorative pattern is offered as a distractor and explicitly rejected.
    const deco = (QUESTIONS["array-structure"] as ChoiceQuestion).choices.find((c) => /color/.test(c.text))!;
    expect(deco.feedback).toMatch(/decoration/);
  });
});
