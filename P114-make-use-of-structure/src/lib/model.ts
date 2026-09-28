/**
 * model.ts — the ONE deterministic mathematical model for the lesson.
 *
 * Every quantity, coordinate, label, and answer check that the UI shows is
 * computed here. The module is pure: no React, no DOM, no randomness, no clock.
 * Components only interpolate between positions this module returns.
 *
 *  1. Problems and place-value helpers
 *  2. Base-ten addition model (cubes with stable ids, stage layouts, labels)
 *  3. Array model (robots with stable ids, row/column groupings, labels)
 *  4. Answer checks with specific, diagnosis-based feedback
 */

// ---------------------------------------------------------------------------
// 1. Problems and place-value helpers
// ---------------------------------------------------------------------------

export const TEN = 10;

export type Owner = "a" | "b";
export const CHARACTERS: Record<Owner, string> = { a: "Juno", b: "Remy" };

/** Grade 2 anchor problem (MP.7 via place-value structure). */
export const MAIN_ADDENDS = { a: 48, b: 32 } as const;
/** Fresh transfer problem: same structure (ones make a new ten), new numbers. */
export const TRANSFER_ADDENDS = { a: 36, b: 24 } as const;
/** Optional Grade 3 extension: a 3-by-4 array. */
export const ARRAY_SIZE = { rows: 3, cols: 4 } as const;

export interface PlaceValue {
  tens: number;
  ones: number;
}

function assertWhole(n: number, what: string): void {
  if (!Number.isInteger(n) || n < 0) throw new Error(`${what} must be a whole number, got ${n}`);
}

export function placeValue(n: number): PlaceValue {
  assertWhole(n, "placeValue input");
  return { tens: Math.floor(n / TEN), ones: n % TEN };
}

export function plural(n: number, singular: string, pluralForm = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : pluralForm}`;
}

/** "4 tens and 8 ones" */
export function placeValueLabel(n: number): string {
  const pv = placeValue(n);
  return `${plural(pv.tens, "ten")} and ${plural(pv.ones, "one")}`;
}

/** [10, 20, ..., tens*10] */
export function countByTens(tens: number): number[] {
  return Array.from({ length: tens }, (_, i) => (i + 1) * TEN);
}

/** "4 + 4 + 4" */
export function repeatedAddition(addend: number, times: number): string {
  return Array.from({ length: times }, () => String(addend)).join(" + ");
}

/** Skip-count list, e.g. skipCount(4, 3) = [4, 8, 12]. */
export function skipCount(step: number, times: number): number[] {
  return Array.from({ length: times }, (_, i) => (i + 1) * step);
}

// Deterministic hash (FNV-1a) used for the "jumbled pile" arrangement.
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic value in [-1, 1] for a given id and salt. */
function jitter(id: string, salt: string): number {
  return (hash(`${id}:${salt}`) % 2001) / 1000 - 1;
}

// ---------------------------------------------------------------------------
// Shared geometry types and helpers
// ---------------------------------------------------------------------------

export interface Pos {
  x: number;
  y: number;
  rot: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TextLabel {
  id: string;
  text: string;
  x: number;
  y: number;
  size: number;
  anchor: "start" | "middle" | "end";
  weight?: "normal" | "bold";
}

export interface Chip {
  id: string;
  text: string;
  cx: number;
  cy: number;
  /** Pill width, sized to the text so it never spills out of its cell. */
  w: number;
}

/** Width of a count chip for its label (about 7.6 units per character at 13px bold). */
export function chipWidth(text: string): number {
  return Math.max(24, Math.round(text.length * 7.6 + 12));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerpPos(from: Pos, to: Pos, t: number): Pos {
  return { x: lerp(from.x, to.x, t), y: lerp(from.y, to.y, t), rot: lerp(from.rot, to.rot, t) };
}

/** Bounding box of square objects of `size` at the given positions, padded. */
export function boundingBox(points: Pos[], size: number, pad = 0): Rect {
  if (points.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x + size);
    maxY = Math.max(maxY, p.y + size);
  }
  return { x: minX - pad, y: minY - pad, w: maxX - minX + 2 * pad, h: maxY - minY + 2 * pad };
}

// ---------------------------------------------------------------------------
// 2. Base-ten addition model
// ---------------------------------------------------------------------------

export type AdditionStage = "scattered" | "apart" | "onesTogether" | "snapTen" | "tradeTen" | "tensTogether";
export const ADDITION_STAGES: readonly AdditionStage[] = [
  "scattered",
  "apart",
  "onesTogether",
  "snapTen",
  "tradeTen",
  "tensTogether",
];

export type RowId = Owner | "total";
export type Place = "tens" | "ones";

/** Geometry of the place-value mat, in SVG user units (viewBox width 360). */
export const ADD_GEOMETRY = {
  width: 360,
  cube: 11,
  /** Loose cubes and stacked sticks sit on a 16-unit pitch (5-unit gaps). */
  pitch: 16,
  headerH: 28,
  rowPad: 9,
  minRowContent: 52,
  barGap: 12,
  footerH: 46,
  labelCol: { x: 0, w: 58 },
  tensCol: { x: 60, w: 170 },
  onesCol: { x: 234, w: 124 },
  stickX: 64,
  frameX: 238,
  framePerRow: 5,
  /** Gap between a cell's right edge and its count chip. */
  chipInset: 4,
} as const;

export interface CubeSpec {
  /** Stable identity, e.g. "a-t2-7" (Juno's stick 2, cube 7) or "b-o1" (Remy's loose cube 1). */
  id: string;
  owner: Owner;
  startsIn: "stick" | "loose";
  /** Starting stick index for stick cubes; -1 for loose cubes. */
  stick: number;
  /** Index inside the stick (0-9) or among the owner's loose cubes. */
  index: number;
}

export interface StickSpec {
  id: string;
  memberIds: string[];
  isNew: boolean;
}

export interface RowBand {
  row: RowId;
  y: number;
  h: number;
}

export interface AdditionModel {
  kind: "addition";
  a: number;
  b: number;
  sum: number;
  pvA: PlaceValue;
  pvB: PlaceValue;
  pvSum: PlaceValue;
  /** onesA + onesB, e.g. 8 + 2 = 10 */
  onesSum: number;
  /** Tens made by regrouping the ones (1 for both lesson problems). */
  newTens: number;
  /** Ones left over after regrouping (0 for both lesson problems). */
  leftoverOnes: number;
  /** tensA + tensB before regrouping, e.g. 4 + 3 = 7 */
  tensBeforeRegroup: number;
  cubes: CubeSpec[];
  cubeIds: string[];
  /** Cubes that snap into the new ten, in fill order. */
  newTenIds: string[];
  rows: Record<RowId, RowBand>;
  bar: { x1: number; x2: number; y: number };
  height: number;
}

export function createAdditionModel(a: number, b: number): AdditionModel {
  assertWhole(a, "a");
  assertWhole(b, "b");
  if (a < TEN || a > 99 || b < TEN || b > 99) throw new Error("Addends must be two-digit numbers");
  if (a + b > 99) throw new Error("Sum must stay below 100 for the Grade 2 mat");

  const G = ADD_GEOMETRY;
  const pvA = placeValue(a);
  const pvB = placeValue(b);
  const sum = a + b;
  const pvSum = placeValue(sum);
  const onesSum = pvA.ones + pvB.ones;
  const newTens = Math.floor(onesSum / TEN);
  const leftoverOnes = onesSum % TEN;

  const cubes: CubeSpec[] = [];
  for (const owner of ["a", "b"] as const) {
    const pv = owner === "a" ? pvA : pvB;
    for (let s = 0; s < pv.tens; s++) {
      for (let j = 0; j < TEN; j++) cubes.push({ id: `${owner}-t${s}-${j}`, owner, startsIn: "stick", stick: s, index: j });
    }
    for (let k = 0; k < pv.ones; k++) cubes.push({ id: `${owner}-o${k}`, owner, startsIn: "loose", stick: -1, index: k });
  }
  const looseInOrder = cubes.filter((c) => c.startsIn === "loose").map((c) => c.id);
  const newTenIds = looseInOrder.slice(0, newTens * TEN);

  // Row heights come from what each row must hold at its fullest.
  const contentH = (sticks: number, frameRows: number) =>
    Math.max(sticks * G.pitch - (G.pitch - G.cube), frameRows * G.pitch - (G.pitch - G.cube), G.minRowContent);
  const hA = contentH(pvA.tens, Math.ceil(pvA.ones / G.framePerRow)) + 2 * G.rowPad;
  const hB = contentH(pvB.tens, Math.ceil(pvB.ones / G.framePerRow)) + 2 * G.rowPad;
  const hT = contentH(pvSum.tens, Math.ceil(onesSum / G.framePerRow) + 1) + 2 * G.rowPad;
  const yA = G.headerH;
  const yB = yA + hA;
  const yT = yB + hB + G.barGap;
  const height = yT + hT + G.footerH;

  return {
    kind: "addition",
    a,
    b,
    sum,
    pvA,
    pvB,
    pvSum,
    onesSum,
    newTens,
    leftoverOnes,
    tensBeforeRegroup: pvA.tens + pvB.tens,
    cubes,
    cubeIds: cubes.map((c) => c.id),
    newTenIds,
    rows: {
      a: { row: "a", y: yA, h: hA },
      b: { row: "b", y: yB, h: hB },
      total: { row: "total", y: yT, h: hT },
    },
    bar: { x1: 4, x2: G.width - 4, y: yB + hB + G.barGap / 2 },
    height,
  };
}

export interface CubeInfo {
  row: RowId;
  place: Place | "mat";
}

export interface AdditionCell {
  row: RowId;
  place: Place;
  rect: Rect;
  sticks: number;
  loose: number;
  chip: Chip | null;
}

export interface RowLabel {
  row: RowId;
  name: string;
  value: string;
  nameX: number;
  nameY: number;
  valueX: number;
  valueY: number;
  face: { cx: number; cy: number; r: number } | null;
  sign: TextLabel | null;
}

export interface AdditionLayout {
  stage: AdditionStage;
  revealed: boolean;
  width: number;
  height: number;
  positions: Record<string, Pos>;
  info: Record<string, CubeInfo>;
  sticks: StickSpec[];
  cells: AdditionCell[];
  frameSlots: { x: number; y: number }[];
  headers: TextLabel[];
  rowLabels: RowLabel[];
  countLabels: TextLabel[];
  focus: { ones: Rect; tens: Rect; rowA: Rect; rowB: Rect };
  bar: { x1: number; x2: number; y: number };
  footer: string;
  /** "48 + 32 = 80" once revealed, "48 + 32 = ?" before. */
  equation: string;
  account: { sticks: number; loose: number; total: number; cubes: number };
  description: string;
}

function stickSlot(model: AdditionModel, row: RowId, slot: number, j: number): Pos {
  const G = ADD_GEOMETRY;
  return { x: G.stickX + j * G.cube, y: model.rows[row].y + G.rowPad + slot * G.pitch, rot: 0 };
}

function frameSlot(model: AdditionModel, row: RowId, slot: number, rowOffset = 0): Pos {
  const G = ADD_GEOMETRY;
  return {
    x: G.frameX + (slot % G.framePerRow) * G.pitch,
    y: model.rows[row].y + G.rowPad + (Math.floor(slot / G.framePerRow) + rowOffset) * G.pitch,
    rot: 0,
  };
}

function scatteredPositions(model: AdditionModel): Record<string, Pos> {
  const G = ADD_GEOMETRY;
  const out: Record<string, Pos> = {};
  for (const owner of ["a", "b"] as const) {
    const band = model.rows[owner];
    const mine = model.cubes.filter((c) => c.owner === owner);
    const left = G.tensCol.x + 4;
    const right = G.onesCol.x + G.onesCol.w - 4;
    const top = band.y + 4;
    const bottom = band.y + band.h - 4;
    const W = right - left;
    const H = bottom - top;
    const cols = Math.ceil(Math.sqrt((mine.length * W) / H));
    const rows = Math.ceil(mine.length / cols);
    const cw = W / cols;
    const ch = H / rows;
    // A fixed, hash-based shuffle: a jumble, but the same jumble every time.
    const order = [...mine].sort((p, q) => hash(p.id) - hash(q.id) || (p.id < q.id ? -1 : 1));
    order.forEach((cube, k) => {
      const col = k % cols;
      const r = Math.floor(k / cols);
      out[cube.id] = {
        x: left + col * cw + (cw - G.cube) / 2 + jitter(cube.id, "x") * 1.5,
        y: top + r * ch + (ch - G.cube) / 2 + jitter(cube.id, "y") * 1,
        rot: Math.round(jitter(cube.id, "r") * 25),
      };
    });
  }
  return out;
}

/** Where every cube is, and which row/place it belongs to, at a stage. */
function placeCubes(model: AdditionModel, stage: AdditionStage): { positions: Record<string, Pos>; info: Record<string, CubeInfo> } {
  const positions: Record<string, Pos> = {};
  const info: Record<string, CubeInfo> = {};
  const G = ADD_GEOMETRY;

  if (stage === "scattered") {
    const scattered = scatteredPositions(model);
    for (const c of model.cubes) {
      positions[c.id] = scattered[c.id];
      info[c.id] = { row: c.owner, place: "mat" };
    }
    return { positions, info };
  }

  const looseOrder = model.cubes.filter((c) => c.startsIn === "loose");
  const newTenSet = new Set(model.newTenIds);
  const leftovers = looseOrder.filter((c) => !newTenSet.has(c.id));
  const tensA = model.pvA.tens;

  for (const c of model.cubes) {
    if (c.startsIn === "stick") {
      if (stage === "tensTogether") {
        const slot = model.newTens + (c.owner === "a" ? c.stick : tensA + c.stick);
        positions[c.id] = stickSlot(model, "total", slot, c.index);
        info[c.id] = { row: "total", place: "tens" };
      } else {
        positions[c.id] = stickSlot(model, c.owner, c.stick, c.index);
        info[c.id] = { row: c.owner, place: "tens" };
      }
      continue;
    }

    // Loose cube.
    if (stage === "apart") {
      positions[c.id] = frameSlot(model, c.owner, c.index);
      info[c.id] = { row: c.owner, place: "ones" };
      continue;
    }
    const order = looseOrder.findIndex((l) => l.id === c.id);
    if (stage === "onesTogether" || !newTenSet.has(c.id)) {
      if (stage === "onesTogether") {
        positions[c.id] = frameSlot(model, "total", order);
      } else {
        // Leftover ones after regrouping.
        const k = leftovers.findIndex((l) => l.id === c.id);
        positions[c.id] = frameSlot(model, "total", k, stage === "snapTen" ? 1 : 0);
      }
      info[c.id] = { row: "total", place: "ones" };
      continue;
    }
    // Member of the new ten.
    const j = model.newTenIds.indexOf(c.id);
    const stickIndex = Math.floor(j / TEN);
    const inStick = j % TEN;
    if (stage === "snapTen") {
      positions[c.id] = { x: G.frameX + inStick * G.cube, y: model.rows.total.y + G.rowPad + stickIndex * G.pitch, rot: 0 };
      info[c.id] = { row: "total", place: "ones" };
    } else {
      positions[c.id] = stickSlot(model, "total", stickIndex, inStick);
      info[c.id] = { row: "total", place: "tens" };
    }
  }
  return { positions, info };
}

function sticksAt(model: AdditionModel, stage: AdditionStage): StickSpec[] {
  if (stage === "scattered") return [];
  const sticks: StickSpec[] = [];
  for (const owner of ["a", "b"] as const) {
    const pv = owner === "a" ? model.pvA : model.pvB;
    for (let s = 0; s < pv.tens; s++) {
      sticks.push({
        id: `${owner}-stick-${s}`,
        memberIds: Array.from({ length: TEN }, (_, j) => `${owner}-t${s}-${j}`),
        isNew: false,
      });
    }
  }
  if (stage === "snapTen" || stage === "tradeTen" || stage === "tensTogether") {
    for (let n = 0; n < model.newTens; n++) {
      sticks.push({ id: `new-ten-${n}`, memberIds: model.newTenIds.slice(n * TEN, (n + 1) * TEN), isNew: true });
    }
  }
  return sticks;
}

function tensOnesPhrase(tens: number, ones: number): string {
  return `${plural(tens, "ten")} ${plural(ones, "one")}`;
}

function footerFor(model: AdditionModel, stage: AdditionStage, revealed: boolean): string {
  if (!revealed) return `${model.a} + ${model.b} = ?`;
  const total = `${model.sum} cubes`;
  switch (stage) {
    case "scattered":
      return `${total} in a jumble`;
    case "apart":
      return `${tensOnesPhrase(model.pvA.tens, model.pvA.ones)} + ${tensOnesPhrase(model.pvB.tens, model.pvB.ones)} = ${total}`;
    case "onesTogether":
      return `${plural(model.tensBeforeRegroup, "ten")} + ${plural(model.onesSum, "one")} = ${total}`;
    case "snapTen":
      return `${plural(model.tensBeforeRegroup, "ten")} + ${plural(model.newTens, "new ten")} + ${plural(model.leftoverOnes, "one")} = ${total}`;
    case "tradeTen":
    case "tensTogether":
      return `${plural(model.pvSum.tens, "ten")} + ${plural(model.pvSum.ones, "one")} = ${total}`;
  }
}

/** Full layout of the place-value mat at one stage. */
export function layoutAddition(model: AdditionModel, stage: AdditionStage, revealed: boolean): AdditionLayout {
  const G = ADD_GEOMETRY;
  const { positions, info } = placeCubes(model, stage);
  const sticks = sticksAt(model, stage);
  const stuck = new Set(sticks.flatMap((s) => s.memberIds));

  const colRect = (place: Place) => (place === "tens" ? G.tensCol : G.onesCol);
  const rowIds: RowId[] = ["a", "b", "total"];
  const cells: AdditionCell[] = [];
  for (const row of rowIds) {
    for (const place of ["tens", "ones"] as const) {
      const band = model.rows[row];
      const col = colRect(place);
      const rect = { x: col.x, y: band.y, w: col.w, h: band.h };
      const here = model.cubeIds.filter((id) => info[id].row === row && info[id].place === place);
      const stickCount = sticks.filter((s) => s.memberIds.every((m) => info[m].row === row && info[m].place === place)).length;
      const loose = here.filter((id) => !stuck.has(id)).length;
      let text: string | null = null;
      if (stage !== "scattered" && (row !== "total" || revealed)) {
        if (place === "tens" && stickCount > 0) text = String(stickCount);
        else if (place === "ones" && stickCount > 0) text = plural(stickCount, "ten");
        else if (place === "ones" && loose > 0) text = String(loose);
        else if (row === "total" && (stage === "tradeTen" || stage === "tensTogether")) text = String(place === "tens" ? stickCount : loose);
      }
      let chip: Chip | null = null;
      if (text !== null) {
        const w = chipWidth(text);
        chip = { id: `chip-${row}-${place}`, text, w, cx: col.x + col.w - G.chipInset - w / 2, cy: band.y + band.h / 2 };
      }
      cells.push({ row, place, rect, sticks: stickCount, loose, chip });
    }
  }

  const frameSlots = Array.from({ length: TEN }, (_, k) => {
    const p = frameSlot(model, "total", k);
    return { x: p.x, y: p.y };
  });

  const headers: TextLabel[] = [
    { id: "h-tens", text: "Tens", x: G.tensCol.x + G.tensCol.w / 2, y: 19, size: 15, anchor: "middle", weight: "bold" },
    { id: "h-ones", text: "Ones", x: G.onesCol.x + G.onesCol.w / 2, y: 19, size: 15, anchor: "middle", weight: "bold" },
  ];

  const rowLabels: RowLabel[] = (["a", "b", "total"] as const).map((row) => {
    const band = model.rows[row];
    if (row === "total") {
      const solved = revealed && stage === "tensTogether";
      return {
        row,
        name: "Total",
        value: solved ? String(model.sum) : "?",
        nameX: 6,
        nameY: band.y + 22,
        valueX: 6,
        valueY: band.y + 48,
        face: null,
        sign: null,
      };
    }
    return {
      row,
      name: CHARACTERS[row],
      value: String(row === "a" ? model.a : model.b),
      nameX: 26,
      nameY: band.y + 22,
      valueX: 26,
      valueY: band.y + 48,
      face: { cx: 12, cy: band.y + 18, r: 9 },
      sign: row === "b" ? { id: "plus", text: "+", x: 6, y: band.y + 48, size: 18, anchor: "start", weight: "bold" } : null,
    };
  });

  const countLabels: TextLabel[] =
    revealed && stage === "tensTogether"
      ? countByTens(model.pvSum.tens).map((value, k) => {
          const p = stickSlot(model, "total", k, 0);
          return { id: `count-${k}`, text: String(value), x: G.stickX + TEN * G.cube + 4, y: p.y + G.cube - 1, size: 12, anchor: "start", weight: "bold" };
        })
      : [];

  const top = G.headerH;
  const bottom = model.rows.total.y + model.rows.total.h;
  const focus = {
    ones: { x: G.onesCol.x, y: top, w: G.onesCol.w, h: bottom - top },
    tens: { x: G.tensCol.x, y: top, w: G.tensCol.w, h: bottom - top },
    rowA: { x: 1, y: model.rows.a.y, w: G.width - 2, h: model.rows.a.h },
    rowB: { x: 1, y: model.rows.b.y, w: G.width - 2, h: model.rows.b.h },
  };

  const looseCount = model.cubeIds.filter((id) => !stuck.has(id)).length;
  const account = { sticks: sticks.length, loose: looseCount, total: sticks.length * TEN + looseCount, cubes: model.cubeIds.length };

  return {
    stage,
    revealed,
    width: G.width,
    height: model.height,
    positions,
    info,
    sticks,
    cells,
    frameSlots,
    headers,
    rowLabels,
    countLabels,
    focus,
    bar: model.bar,
    footer: footerFor(model, stage, revealed),
    equation: `${model.a} + ${model.b} = ${revealed ? model.sum : "?"}`,
    account,
    description: describeAddition(model, stage, revealed, cells),
  };
}

function describeCellPair(cells: AdditionCell[], row: RowId): string {
  const tens = cells.find((c) => c.row === row && c.place === "tens")!;
  const ones = cells.find((c) => c.row === row && c.place === "ones")!;
  const parts: string[] = [];
  if (tens.sticks > 0) parts.push(`${plural(tens.sticks, "ten-stick")} in the tens place`);
  if (ones.sticks > 0) parts.push(`${plural(ones.sticks, "new ten-stick")} in the ones place`);
  if (ones.loose > 0) parts.push(`${plural(ones.loose, "loose cube")} in the ones place`);
  return parts.length ? parts.join(", ") : "empty";
}

function describeAddition(model: AdditionModel, stage: AdditionStage, revealed: boolean, cells: AdditionCell[]): string {
  const nameA = CHARACTERS.a;
  const nameB = CHARACTERS.b;
  if (stage === "scattered") {
    return `A jumble of snap cubes. ${nameA} has ${model.a} cubes and ${nameB} has ${model.b} cubes, not yet sorted into tens and ones.`;
  }
  const rowText = (row: Owner) => {
    const value = row === "a" ? model.a : model.b;
    const content = describeCellPair(cells, row);
    return content === "empty" ? `${CHARACTERS[row]}'s row (${value}): cubes moved down to the total` : `${CHARACTERS[row]}'s row (${value}): ${content}`;
  };
  const head = `Place-value mat with a tens place and a ones place. ${rowText("a")}. ${rowText("b")}.`;
  if (!revealed) return `${head} Total row: not solved yet.`;
  const totalContent = describeCellPair(cells, "total");
  const solved = stage === "tensTogether" ? `, which makes ${model.sum}` : "";
  return `${head} Total row: ${totalContent}${solved}. Cubes on the mat: ${model.sum}.`;
}

// ---------------------------------------------------------------------------
// 3. Array model (Grade 3 extension)
// ---------------------------------------------------------------------------

export type ArrayStage = "offstage" | "array" | "rows" | "columns";
export const ARRAY_STAGES: readonly ArrayStage[] = ["offstage", "array", "rows", "columns"];

export const ARRAY_GEOMETRY = {
  width: 360,
  height: 330,
  robot: 44,
  pitch: 64,
  rowGap: 16,
  colGap: 14,
  top: 50,
  groupPad: 7,
  antennaColors: 4,
} as const;

export interface RobotSpec {
  /** Stable identity, e.g. "robot-r1-c2". */
  id: string;
  row: number;
  col: number;
  /** Decorative antenna color index. It repeats diagonally, NOT in rows or columns. */
  antenna: number;
}

export interface ArrayModel {
  kind: "array";
  rows: number;
  cols: number;
  total: number;
  robots: RobotSpec[];
  robotIds: string[];
  rowGroups: string[][];
  columnGroups: string[][];
}

export function createArrayModel(rows: number, cols: number): ArrayModel {
  assertWhole(rows, "rows");
  assertWhole(cols, "cols");
  if (rows < 1 || cols < 1 || rows > 5 || cols > 5) throw new Error("Arrays in this lesson are 1-5 by 1-5");
  const robots: RobotSpec[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      robots.push({ id: `robot-r${r}-c${c}`, row: r, col: c, antenna: (r + c) % ARRAY_GEOMETRY.antennaColors });
    }
  }
  return {
    kind: "array",
    rows,
    cols,
    total: rows * cols,
    robots,
    robotIds: robots.map((r) => r.id),
    rowGroups: Array.from({ length: rows }, (_, r) => robots.filter((x) => x.row === r).map((x) => x.id)),
    columnGroups: Array.from({ length: cols }, (_, c) => robots.filter((x) => x.col === c).map((x) => x.id)),
  };
}

export interface ArrayGroup {
  id: string;
  kind: "row" | "column";
  memberIds: string[];
  /** Chip label: how many robots are in this group. */
  label: string;
}

export interface ArrayLayout {
  stage: ArrayStage;
  revealed: boolean;
  width: number;
  height: number;
  positions: Record<string, Pos>;
  rowGroups: ArrayGroup[];
  columnGroups: ArrayGroup[];
  footer: string;
  count: number;
  description: string;
}

export function arrayGridSize(model: ArrayModel): { w: number; h: number } {
  const A = ARRAY_GEOMETRY;
  return { w: (model.cols - 1) * A.pitch + A.robot, h: (model.rows - 1) * A.pitch + A.robot };
}

export function layoutArray(model: ArrayModel, stage: ArrayStage, revealed: boolean): ArrayLayout {
  const A = ARRAY_GEOMETRY;
  const grid = arrayGridSize(model);
  const x0 = (A.width - grid.w) / 2;
  const positions: Record<string, Pos> = {};
  for (const robot of model.robots) {
    let x = x0 + robot.col * A.pitch;
    let y = A.top + robot.row * A.pitch;
    if (stage === "offstage") x -= A.width + 20;
    if (stage === "rows") y += robot.row * A.rowGap - ((model.rows - 1) * A.rowGap) / 2;
    if (stage === "columns") x += robot.col * A.colGap - ((model.cols - 1) * A.colGap) / 2;
    positions[robot.id] = { x, y, rot: 0 };
  }
  const rowGroups = model.rowGroups.map((ids, r) => ({ id: `row-${r}`, kind: "row" as const, memberIds: ids, label: String(ids.length) }));
  const columnGroups = model.columnGroups.map((ids, c) => ({ id: `col-${c}`, kind: "column" as const, memberIds: ids, label: String(ids.length) }));
  return {
    stage,
    revealed,
    width: A.width,
    height: A.height,
    positions,
    rowGroups,
    columnGroups,
    footer: arrayFooter(model, stage, revealed),
    count: model.robotIds.length,
    description: describeArray(model, stage, revealed),
  };
}

/** Outline for a row or column group, from (possibly interpolated) positions. */
export function arrayGroupBox(points: Pos[]): Rect {
  return boundingBox(points, ARRAY_GEOMETRY.robot, ARRAY_GEOMETRY.groupPad);
}

/** Where a group's count chip sits: right of a row, below a column. */
export function arrayChipCenter(kind: "row" | "column", box: Rect): { cx: number; cy: number } {
  return kind === "row" ? { cx: box.x + box.w + 16, cy: box.y + box.h / 2 } : { cx: box.x + box.w / 2, cy: box.y + box.h + 17 };
}

function arrayFooter(model: ArrayModel, stage: ArrayStage, revealed: boolean): string {
  if (stage === "offstage") return "Here comes the parade!";
  if (!revealed) return `${plural(model.rows, "row")}, ${plural(model.cols, "column")}. How many robots?`;
  if (stage === "rows") return `${repeatedAddition(model.cols, model.rows)} = ${model.total} robots`;
  if (stage === "columns") return `${repeatedAddition(model.rows, model.cols)} = ${model.total} robots`;
  return `${model.rows} × ${model.cols} = ${model.total} robots`;
}

function describeArray(model: ArrayModel, stage: ArrayStage, revealed: boolean): string {
  if (stage === "offstage") return "Robots are marching in from the left.";
  const shape = `An array of robots with ${plural(model.rows, "row")} and ${plural(model.cols, "column")}. Each row has ${model.cols} robots and each column has ${model.rows} robots.`;
  const grouping =
    stage === "rows"
      ? " The robots are grouped by rows."
      : stage === "columns"
        ? " The robots are grouped by columns."
        : "";
  return revealed ? `${shape}${grouping} Total: ${model.total} robots.` : `${shape}${grouping}`;
}

// ---------------------------------------------------------------------------
// 4. Answer checks
// ---------------------------------------------------------------------------

export type NumericCheck<D extends string> =
  | { valid: false; feedback: string }
  | { valid: true; value: number; correct: boolean; diagnosis: D; feedback: string };

/** Accepts 1-4 digits (surrounding spaces allowed). Anything else is not a number yet. */
export function parseWholeNumber(raw: string): number | null {
  const t = raw.trim();
  if (!/^\d{1,4}$/.test(t)) return null;
  return Number(t);
}

export const INVALID_NUMBER_FEEDBACK = "Type a number with digits, then press Check.";

export type AdditionDiagnosis =
  | "correct"
  | "forgotNewTen"
  | "tensAndOnesSideBySide"
  | "tensCountOnly"
  | "allDigitsAsOnes"
  | "oneTenTooMany"
  | "onesPlaceWrong"
  | "notYet";

/** The wrong answers each diagnosis predicts (used by checks and tests). */
export function additionMisconceptions(m: AdditionModel): Record<Exclude<AdditionDiagnosis, "correct" | "onesPlaceWrong" | "notYet">, number> {
  return {
    forgotNewTen: m.tensBeforeRegroup * TEN + m.leftoverOnes,
    tensAndOnesSideBySide: Number(`${m.tensBeforeRegroup}${m.onesSum}`),
    tensCountOnly: m.pvSum.tens,
    allDigitsAsOnes: m.pvA.tens + m.pvA.ones + m.pvB.tens + m.pvB.ones,
    oneTenTooMany: m.sum + TEN,
  };
}

export function additionFeedback(m: AdditionModel, diagnosis: AdditionDiagnosis, value: number): string {
  const { pvA, pvB } = m;
  switch (diagnosis) {
    case "correct":
      return `Yes! ${m.a} + ${m.b} = ${m.sum}. The ${plural(pvA.ones, "one")} and ${plural(pvB.ones, "one")} make a new ten.`;
    case "forgotNewTen":
      return `You added the tens: ${pvA.tens} tens + ${pvB.tens} tens = ${m.tensBeforeRegroup} tens. Don't forget the new ten made from ${pvA.ones} ones + ${pvB.ones} ones!`;
    case "tensAndOnesSideBySide":
      return `You wrote ${m.tensBeforeRegroup} tens and ${m.onesSum} ones side by side. But ${m.onesSum} ones make 1 more ten, and the ones place only holds 0 to 9.`;
    case "tensCountOnly":
      return `${value} is how many ten-sticks there will be. Each ten-stick has 10 cubes. How many cubes is that?`;
    case "allDigitsAsOnes":
      return `It looks like you added every digit as ones: ${pvA.tens} + ${pvA.ones} + ${pvB.tens} + ${pvB.ones}. But the ${pvA.tens} and the ${pvB.tens} are tens, not ones.`;
    case "oneTenTooMany":
      return `That's one ten too many. Count the tens again: ${pvA.tens} tens + ${pvB.tens} tens + ${plural(m.newTens, "new ten")}.`;
    case "onesPlaceWrong":
      return `Check the ones place. ${pvA.ones} ones + ${pvB.ones} ones = ${m.onesSum} ones. That's ${plural(m.newTens, "ten")} and ${m.leftoverOnes} left over, so the ones digit is ${m.leftoverOnes}.`;
    case "notYet":
      return `Not yet. Add the tens: ${pvA.tens} tens + ${pvB.tens} tens. Then add the ones: ${pvA.ones} + ${pvB.ones}. Can the ones make a new ten?`;
  }
}

export function checkAddition(m: AdditionModel, raw: string): NumericCheck<AdditionDiagnosis> {
  const value = parseWholeNumber(raw);
  if (value === null) return { valid: false, feedback: INVALID_NUMBER_FEEDBACK };
  let diagnosis: AdditionDiagnosis;
  if (value === m.sum) diagnosis = "correct";
  else {
    const mis = additionMisconceptions(m);
    const hit = (Object.keys(mis) as (keyof typeof mis)[]).find((k) => mis[k] === value);
    if (hit) diagnosis = hit;
    else if (value % TEN !== m.pvSum.ones) diagnosis = "onesPlaceWrong";
    else diagnosis = "notYet";
  }
  return { valid: true, value, correct: diagnosis === "correct", diagnosis, feedback: additionFeedback(m, diagnosis, value) };
}

export function additionReveal(m: AdditionModel): string {
  return `${m.a} + ${m.b} = ${m.sum}. ${m.pvA.ones} ones + ${m.pvB.ones} ones make a new ten, so ${m.pvA.tens} tens + ${m.pvB.tens} tens + ${plural(m.newTens, "ten")} = ${plural(m.pvSum.tens, "ten")} = ${m.sum}.`;
}

export type ArrayDiagnosis =
  | "correct"
  | "addedRowsAndColumns"
  | "digitsSideBySide"
  | "oneRowShort"
  | "oneRowExtra"
  | "oneColumnShort"
  | "oneColumnExtra"
  | "notYet";

export function arrayMisconceptions(m: ArrayModel): Record<Exclude<ArrayDiagnosis, "correct" | "notYet" | "digitsSideBySide">, number> & { digitsSideBySide: number[] } {
  return {
    addedRowsAndColumns: m.rows + m.cols,
    digitsSideBySide: [Number(`${m.rows}${m.cols}`), Number(`${m.cols}${m.rows}`)],
    oneRowShort: (m.rows - 1) * m.cols,
    oneRowExtra: (m.rows + 1) * m.cols,
    oneColumnShort: m.rows * (m.cols - 1),
    oneColumnExtra: m.rows * (m.cols + 1),
  };
}

export function arrayFeedback(m: ArrayModel, diagnosis: ArrayDiagnosis, value: number): string {
  const rowsSum = repeatedAddition(m.cols, m.rows);
  switch (diagnosis) {
    case "correct":
      return `Yes! ${plural(m.rows, "row")} of ${m.cols}: ${rowsSum} = ${m.total} robots.`;
    case "addedRowsAndColumns":
      return `You added ${m.rows} + ${m.cols}. That counts the rows and the columns, not the robots. Each row has ${m.cols} robots: ${rowsSum}.`;
    case "digitsSideBySide":
      return `You put ${m.rows} and ${m.cols} side by side. Instead, add the equal rows: ${rowsSum}.`;
    case "oneRowShort":
      return `${value} is only ${plural(m.rows - 1, "row")} of ${m.cols}. Count the rows again: there are ${m.rows} rows.`;
    case "oneRowExtra":
      return `${value} would be ${plural(m.rows + 1, "row")} of ${m.cols}. There are only ${m.rows} rows.`;
    case "oneColumnShort":
      return `${value} is only ${plural(m.cols - 1, "column")} of ${m.rows}. Look again: there are ${m.cols} columns.`;
    case "oneColumnExtra":
      return `${value} would be ${plural(m.cols + 1, "column")} of ${m.rows}. There are only ${m.cols} columns.`;
    case "notYet":
      return `Not yet. Skip-count the rows: ${skipCount(m.cols, m.rows - 1).join(", ")}, … Or skip-count the columns: ${skipCount(m.rows, m.cols - 1).join(", ")}, …`;
  }
}

export function checkArray(m: ArrayModel, raw: string): NumericCheck<ArrayDiagnosis> {
  const value = parseWholeNumber(raw);
  if (value === null) return { valid: false, feedback: INVALID_NUMBER_FEEDBACK };
  const mis = arrayMisconceptions(m);
  let diagnosis: ArrayDiagnosis = "notYet";
  if (value === m.total) diagnosis = "correct";
  else if (value === mis.addedRowsAndColumns) diagnosis = "addedRowsAndColumns";
  else if (mis.digitsSideBySide.includes(value)) diagnosis = "digitsSideBySide";
  else if (value === mis.oneRowShort) diagnosis = "oneRowShort";
  else if (value === mis.oneRowExtra) diagnosis = "oneRowExtra";
  else if (value === mis.oneColumnShort) diagnosis = "oneColumnShort";
  else if (value === mis.oneColumnExtra) diagnosis = "oneColumnExtra";
  return { valid: true, value, correct: diagnosis === "correct", diagnosis, feedback: arrayFeedback(m, diagnosis, value) };
}

export function arrayReveal(m: ArrayModel): string {
  return `${plural(m.rows, "row")} of ${m.cols}: ${repeatedAddition(m.cols, m.rows)} = ${m.total}. ${plural(m.cols, "column")} of ${m.rows}: ${repeatedAddition(m.rows, m.cols)} = ${m.total}.`;
}

// ---------------------------------------------------------------------------
// Lesson instances (the only place the lesson numbers become models)
// ---------------------------------------------------------------------------

export const MAIN = createAdditionModel(MAIN_ADDENDS.a, MAIN_ADDENDS.b);
export const TRANSFER = createAdditionModel(TRANSFER_ADDENDS.a, TRANSFER_ADDENDS.b);
export const PARADE = createArrayModel(ARRAY_SIZE.rows, ARRAY_SIZE.cols);

// ---------------------------------------------------------------------------
// Question bank: prompts, choices, answer keys, and checks
// ---------------------------------------------------------------------------

export interface Choice {
  id: string;
  text: string;
  feedback: string;
}

export interface ChoiceQuestion {
  id: QuestionId;
  kind: "choice";
  prompt: string;
  choices: Choice[];
  correctId: string;
  reveal: string;
}

export interface NumberQuestion {
  id: QuestionId;
  kind: "number";
  prompt: string;
  /** Shown big, e.g. "48 + 32 = ?" */
  equation: string;
  hint: string;
  reveal: string;
  /** The value that must never appear on screen before the learner submits. */
  answer: number;
  check: (raw: string) => NumericCheck<string>;
}

export type Question = ChoiceQuestion | NumberQuestion;

export type QuestionId =
  | "predict-ten"
  | "predict-total"
  | "explain-same"
  | "explain-structure"
  | "transfer-total"
  | "array-total"
  | "array-same"
  | "array-structure";

const A = CHARACTERS.a;
const B = CHARACTERS.b;
const rowsSum = repeatedAddition(PARADE.cols, PARADE.rows);
const colsSum = repeatedAddition(PARADE.rows, PARADE.cols);

export const QUESTIONS: Record<QuestionId, Question> = {
  "predict-ten": {
    id: "predict-ten",
    kind: "choice",
    prompt: `${A} has ${MAIN.pvA.ones} loose cubes. ${B} has ${MAIN.pvB.ones} loose cubes. If we push all the loose cubes together, what can they make?`,
    choices: [
      {
        id: "a",
        text: "Not enough for a ten-stick",
        feedback: `Count on from ${MAIN.pvA.ones}: ${Array.from({ length: MAIN.pvB.ones }, (_, i) => MAIN.pvA.ones + i + 1).join(", ")}. That's ${MAIN.onesSum} loose cubes, exactly enough for one ten-stick.`,
      },
      {
        id: "b",
        text: "Exactly one ten-stick",
        feedback: `Yes! ${MAIN.pvA.ones} ones + ${MAIN.pvB.ones} ones = ${MAIN.onesSum} ones, and ${MAIN.onesSum} ones snap into 1 ten-stick.`,
      },
      {
        id: "c",
        text: "Two ten-sticks",
        feedback: `A ten-stick holds 10 cubes. ${MAIN.pvA.ones} + ${MAIN.pvB.ones} is ${MAIN.onesSum}, so that makes just one ten-stick, not two.`,
      },
    ],
    correctId: "b",
    reveal: `${MAIN.pvA.ones} ones + ${MAIN.pvB.ones} ones = ${MAIN.onesSum} ones, and ${MAIN.onesSum} ones make exactly one ten-stick.`,
  },
  "predict-total": {
    id: "predict-total",
    kind: "number",
    prompt: `Make a prediction. How many cubes do ${A} and ${B} have in all?`,
    equation: `${MAIN.a} + ${MAIN.b} = ?`,
    hint: `Add the tens: ${MAIN.pvA.tens} tens + ${MAIN.pvB.tens} tens. Then look at the ones: ${MAIN.pvA.ones} + ${MAIN.pvB.ones}. Do they make a new ten?`,
    reveal: additionReveal(MAIN),
    answer: MAIN.sum,
    check: (raw) => checkAddition(MAIN, raw),
  },
  "explain-same": {
    id: "explain-same",
    kind: "choice",
    prompt: `When the ${MAIN.onesSum} loose cubes snapped into one ten-stick, what happened to the number of cubes?`,
    choices: [
      {
        id: "a",
        text: "It went up. Snapping added more cubes.",
        feedback: `Watch again: no new cubes came in. The same ${MAIN.onesSum} cubes snapped together, so the number stayed the same.`,
      },
      {
        id: "b",
        text: "It went down. The loose cubes disappeared.",
        feedback: `The ${MAIN.onesSum} loose cubes didn't disappear. They are inside the new ten-stick: ${MAIN.onesSum} ones = 1 ten.`,
      },
      {
        id: "c",
        text: "It stayed the same. The same cubes are just grouped as a ten.",
        feedback: `Right! Regrouping changes how the cubes are grouped, not how many there are. There are still ${MAIN.sum} cubes.`,
      },
    ],
    correctId: "c",
    reveal: `It stayed the same. Regrouping ${MAIN.onesSum} ones into 1 ten keeps all ${MAIN.sum} cubes.`,
  },
  "explain-structure": {
    id: "explain-structure",
    kind: "choice",
    prompt: `Which structure made ${MAIN.a} + ${MAIN.b} easier to add?`,
    choices: [
      {
        id: "a",
        text: `Making a new ten from ${MAIN.pvA.ones} ones and ${MAIN.pvB.ones} ones`,
        feedback: `Yes! Place value is the structure. ${MAIN.pvA.ones} ones + ${MAIN.pvB.ones} ones make 1 ten, so ${MAIN.pvA.tens} tens + ${MAIN.pvB.tens} tens + 1 ten = ${plural(MAIN.pvSum.tens, "ten")}.`,
      },
      {
        id: "b",
        text: "Sorting the cubes by color",
        feedback: `Color is just decoration here. ${A}'s blue cubes and ${B}'s striped orange cubes count the same, so color doesn't help us add. Look for groups of ten.`,
      },
      {
        id: "c",
        text: "Counting every cube, one by one",
        feedback: `Counting by ones works, but it's slow and easy to lose your place. Groups of ten let you count fast: ${countByTens(3).join(", ")}, …`,
      },
    ],
    correctId: "a",
    reveal: `Making a new ten: ${MAIN.pvA.ones} ones + ${MAIN.pvB.ones} ones = 1 ten, so the tens combine to ${MAIN.sum}.`,
  },
  "transfer-total": {
    id: "transfer-total",
    kind: "number",
    prompt: `Your turn! ${A} has ${TRANSFER.a} cubes and ${B} has ${TRANSFER.b} cubes. Look for structure first. How many cubes in all?`,
    equation: `${TRANSFER.a} + ${TRANSFER.b} = ?`,
    hint: `Look at the loose cubes: ${TRANSFER.pvA.ones} ones + ${TRANSFER.pvB.ones} ones. Can they make a new ten?`,
    reveal: additionReveal(TRANSFER),
    answer: TRANSFER.sum,
    check: (raw) => checkAddition(TRANSFER, raw),
  },
  "array-total": {
    id: "array-total",
    kind: "number",
    prompt: "How many robots are in the parade? Use the rows or the columns to help you.",
    equation: `${PARADE.rows} rows of ${PARADE.cols} = ?`,
    hint: `Each row has ${PARADE.cols} robots. Skip-count by rows: ${skipCount(PARADE.cols, PARADE.rows - 1).join(", ")}, …`,
    reveal: arrayReveal(PARADE),
    answer: PARADE.total,
    check: (raw) => checkArray(PARADE, raw),
  },
  "array-same": {
    id: "array-same",
    kind: "choice",
    prompt: `${B} says, "When we grouped the robots by columns, we got more robots!" Is ${B} right?`,
    choices: [
      {
        id: "a",
        text: "Yes. Columns make more robots.",
        feedback: `Count both ways: columns ${colsSum} = ${PARADE.total}, and rows ${rowsSum} = ${PARADE.total}. Same robots, so the same number.`,
      },
      {
        id: "b",
        text: `No. It's the same ${PARADE.total} robots, just grouped a different way.`,
        feedback: `Yes! Moving from rows to columns changes the groups, not the count. ${PARADE.rows} rows of ${PARADE.cols} = ${PARADE.cols} columns of ${PARADE.rows} = ${PARADE.total}.`,
      },
      {
        id: "c",
        text: "No. Rows make more robots.",
        feedback: `Rows: ${rowsSum} = ${PARADE.total}. Columns: ${colsSum} = ${PARADE.total}. Neither way has more.`,
      },
    ],
    correctId: "b",
    reveal: `It's the same ${PARADE.total} robots: ${rowsSum} = ${colsSum} = ${PARADE.total}.`,
  },
  "array-structure": {
    id: "array-structure",
    kind: "choice",
    prompt: "Which structure makes counting the robots easier?",
    choices: [
      {
        id: "a",
        text: "The pattern of antenna colors",
        feedback: "The antenna colors make a pretty pattern, but it's just decoration. It doesn't make equal groups that tell us how many. Look at the rows and columns.",
      },
      {
        id: "b",
        text: "Counting each robot, one at a time",
        feedback: `That works, but it's easy to skip or double-count a robot. Equal rows let you skip-count: ${skipCount(PARADE.cols, PARADE.rows).join(", ")}.`,
      },
      {
        id: "c",
        text: "Equal rows or equal columns",
        feedback: `Yes! Equal groups are the structure: ${rowsSum} or ${colsSum}. That's ${PARADE.rows} × ${PARADE.cols} = ${PARADE.cols} × ${PARADE.rows} = ${PARADE.total}.`,
      },
    ],
    correctId: "c",
    reveal: `Equal rows or equal columns: ${rowsSum} = ${colsSum} = ${PARADE.total}.`,
  },
};

export function checkChoice(q: ChoiceQuestion, choiceId: string): { correct: boolean; feedback: string } {
  const choice = q.choices.find((c) => c.id === choiceId);
  if (!choice) return { correct: false, feedback: "Pick one answer, then press Check." };
  return { correct: choice.id === q.correctId, feedback: choice.feedback };
}

/** Wrong attempts after which "Show me" is offered. */
export const ATTEMPTS_BEFORE_SHOW_ME = 2;
