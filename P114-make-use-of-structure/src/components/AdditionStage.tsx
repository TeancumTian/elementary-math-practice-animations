"use client";

import { useMemo } from "react";
import {
  ADD_GEOMETRY as G,
  boundingBox,
  layoutAddition,
  lerpPos,
  type AdditionModel,
  type AdditionStage as StageId,
  type Chip,
  type Pos,
} from "@/lib/model";
import { moveProgress, progressiveCount, type Overlay } from "@/lib/timeline";

interface Props {
  model: AdditionModel;
  from: StageId;
  to: StageId;
  overlay: Overlay;
  beatElapsed: number;
  moveMs: number;
  durationMs: number;
  reducedMotion: boolean;
  title: string;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

function ChipView({ chip, opacity }: { chip: Chip; opacity: number }) {
  const w = chip.w;
  return (
    <g opacity={r2(opacity)} className="chip" data-chip={chip.id}>
      <rect x={r2(chip.cx - w / 2)} y={chip.cy - 12} width={r2(w)} height={24} rx={12} />
      <text x={chip.cx} y={chip.cy + 5} textAnchor="middle">
        {chip.text}
      </text>
    </g>
  );
}

function Face({ cx, cy, r, who }: { cx: number; cy: number; r: number; who: "a" | "b" }) {
  return who === "a" ? (
    <g className="face face-a">
      <circle cx={cx - r * 0.75} cy={cy - r * 0.7} r={r * 0.5} className="hair" />
      <circle cx={cx + r * 0.75} cy={cy - r * 0.7} r={r * 0.5} className="hair" />
      <circle cx={cx} cy={cy} r={r} className="skin" />
      <circle cx={cx - 3} cy={cy - 1} r={1.3} className="eye" />
      <circle cx={cx + 3} cy={cy - 1} r={1.3} className="eye" />
      <path d={`M${cx - 3} ${cy + 3} q3 3 6 0`} className="smile" />
    </g>
  ) : (
    <g className="face face-b">
      <circle cx={cx} cy={cy} r={r} className="skin" />
      <path d={`M${cx - r} ${cy - 1} a${r} ${r} 0 0 1 ${2 * r} 0 z`} className="cap" />
      <rect x={cx} y={cy - 2.5} width={r + 1.5} height={2.5} rx={1} className="cap" />
      <circle cx={cx - 3} cy={cy + 1.5} r={1.3} className="eye" />
      <circle cx={cx + 3} cy={cy + 1.5} r={1.3} className="eye" />
      <path d={`M${cx - 3} ${cy + 4.5} q3 2.5 6 0`} className="smile" />
    </g>
  );
}

export function AdditionStageSvg({ model, from, to, overlay, beatElapsed, moveMs, durationMs, reducedMotion, title }: Props) {
  const fromLayout = useMemo(() => layoutAddition(model, from, overlay.reveal), [model, from, overlay.reveal]);
  const toLayout = useMemo(() => layoutAddition(model, to, overlay.reveal), [model, to, overlay.reveal]);
  const newTen = useMemo(() => new Set(model.newTenIds), [model]);

  const t = from === to ? 1 : moveProgress(beatElapsed, moveMs, 0, reducedMotion);
  const positions: Record<string, Pos> = {};
  for (const id of model.cubeIds) {
    positions[id] = t >= 1 ? toLayout.positions[id] : lerpPos(fromLayout.positions[id], toLayout.positions[id], t);
  }

  const focus = overlay.focus;
  const inFocus = (id: string): boolean => {
    const info = toLayout.info[id];
    switch (focus) {
      case "ones":
        return info.place === "ones";
      case "tens":
        return info.place === "tens";
      case "rowA":
        return info.row === "a";
      case "rowB":
        return info.row === "b";
      case "newTen":
        return newTen.has(id);
      default:
        return true;
    }
  };

  let focusRect: { x: number; y: number; w: number; h: number } | null = null;
  if (focus === "ones" || focus === "tens" || focus === "rowA" || focus === "rowB") focusRect = toLayout.focus[focus];
  if (focus === "newTen" && model.newTenIds.length > 0) {
    focusRect = boundingBox(
      model.newTenIds.map((id) => positions[id]),
      G.cube,
      4,
    );
  }

  const fromSticks = new Set(fromLayout.sticks.map((s) => s.id));
  const showTag = focus === "newTen" && (to === "snapTen" || to === "tradeTen") && t >= 1 && focusRect;

  // Chips cross-fade between the stage we leave and the stage we reach.
  const fromChips = new Map(fromLayout.cells.flatMap((c) => (c.chip ? [[c.chip.id, c.chip] as const] : [])));
  const toChips = new Map(toLayout.cells.flatMap((c) => (c.chip ? [[c.chip.id, c.chip] as const] : [])));
  const chipViews: { key: string; chip: Chip; opacity: number }[] = [];
  for (const [id, chip] of toChips) {
    const before = fromChips.get(id);
    chipViews.push({ key: `to-${id}`, chip, opacity: before && before.text === chip.text ? 1 : t });
  }
  for (const [id, chip] of fromChips) {
    const after = toChips.get(id);
    if (!after || after.text !== chip.text) chipViews.push({ key: `from-${id}`, chip, opacity: 1 - t });
  }

  const counts = overlay.counts ?? "none";
  const countLabels =
    counts === "none" || t < 1
      ? []
      : counts === "all"
        ? toLayout.countLabels
        : toLayout.countLabels.slice(0, progressiveCount(beatElapsed - moveMs, Math.max(1, durationMs - moveMs), toLayout.countLabels.length));

  const footerText = overlay.equation ? toLayout.equation : toLayout.footer;
  const H = toLayout.height;

  return (
    <svg
      className="stage-svg"
      viewBox={`0 0 ${G.width} ${H}`}
      role="img"
      aria-labelledby="stage-title stage-desc"
      data-visual="addition"
      data-stage={to}
    >
      <title id="stage-title">{title}</title>
      <desc id="stage-desc">{toLayout.description}</desc>
      <defs>
        <pattern id="stripes-b" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="4" height="4" className="cube-b-base" />
          <rect width="1.6" height="4" className="cube-b-stripe" />
        </pattern>
      </defs>

      <rect x={0.5} y={0.5} width={G.width - 1} height={H - 1} rx={14} className="mat" />
      {toLayout.cells.map((c) => (
        <rect
          key={`${c.row}-${c.place}`}
          x={c.rect.x}
          y={c.rect.y + 2}
          width={c.rect.w}
          height={c.rect.h - 4}
          rx={8}
          className={`cell cell-${c.place} ${c.row === "total" ? "cell-total" : ""}`}
        />
      ))}
      {toLayout.headers.map((h) => (
        <text key={h.id} x={h.x} y={h.y} textAnchor={h.anchor} fontSize={h.size} className="mat-header">
          {h.text}
        </text>
      ))}
      {toLayout.frameSlots.map((s, k) => (
        <rect key={`slot-${k}`} x={s.x - 0.5} y={s.y - 0.5} width={G.cube + 1} height={G.cube + 1} rx={2} className="frame-slot" />
      ))}
      <line x1={toLayout.bar.x1} x2={toLayout.bar.x2} y1={toLayout.bar.y} y2={toLayout.bar.y} className="equals-bar" />

      {toLayout.rowLabels.map((l) => (
        <g key={`label-${l.row}`} className={`row-label row-label-${l.row}`}>
          {l.face && <Face cx={l.face.cx} cy={l.face.cy} r={l.face.r} who={l.row === "b" ? "b" : "a"} />}
          <text x={l.nameX} y={l.nameY} className="row-name">
            {l.name}
          </text>
          {l.sign && (
            <text x={l.sign.x} y={l.sign.y} fontSize={l.sign.size} className="row-sign">
              {l.sign.text}
            </text>
          )}
          <text x={l.valueX} y={l.valueY} className={`row-value ${l.row === "total" ? "row-value-total" : ""}`}>
            {l.value}
          </text>
        </g>
      ))}

      {focusRect && (
        <rect
          x={r2(focusRect.x)}
          y={r2(focusRect.y)}
          width={r2(focusRect.w)}
          height={r2(focusRect.h)}
          rx={9}
          className={`focus-ring focus-${focus}`}
        />
      )}

      <g className="cubes">
        {model.cubes.map((c) => {
          const p = positions[c.id];
          const x = r2(p.x);
          const y = r2(p.y);
          return (
            <rect
              key={c.id}
              data-cube={c.id}
              x={x}
              y={y}
              width={G.cube}
              height={G.cube}
              rx={1.8}
              transform={p.rot ? `rotate(${r2(p.rot)} ${r2(x + G.cube / 2)} ${r2(y + G.cube / 2)})` : undefined}
              className={`cube cube-${c.owner} ${inFocus(c.id) ? "" : "dim"}`}
            />
          );
        })}
      </g>

      {toLayout.sticks.map((s) => {
        const box = boundingBox(
          s.memberIds.map((id) => positions[id]),
          G.cube,
          0.6,
        );
        // A new stick's outline appears only as its cubes finish lining up.
        const opacity = fromSticks.has(s.id) ? 1 : Math.max(0, Math.min(1, (t - 0.75) / 0.25));
        const dim = focus && !s.memberIds.every(inFocus);
        return (
          <rect
            key={s.id}
            data-stick={s.id}
            x={r2(box.x)}
            y={r2(box.y)}
            width={r2(box.w)}
            height={r2(box.h)}
            rx={2.5}
            opacity={r2(opacity)}
            className={`stick-outline ${s.isNew ? "stick-new" : ""} ${dim ? "dim" : ""}`}
          />
        );
      })}

      {showTag && focusRect && (
        <g className="new-ten-tag">
          <rect x={r2(focusRect.x)} y={r2(focusRect.y + focusRect.h + 3)} width={58} height={17} rx={8.5} />
          <text x={r2(focusRect.x + 29)} y={r2(focusRect.y + focusRect.h + 15.5)} textAnchor="middle">
            new ten
          </text>
        </g>
      )}

      {countLabels.map((l) => (
        <text key={l.id} x={l.x} y={l.y} fontSize={l.size} className="count-label">
          {l.text}
        </text>
      ))}

      {chipViews.map((v) => (
        <ChipView key={v.key} chip={v.chip} opacity={v.opacity} />
      ))}

      <g className={`footer ${overlay.equation ? "footer-equation" : ""}`}>
        <rect x={12} y={H - 38} width={G.width - 24} height={30} rx={15} />
        <text x={G.width / 2} y={H - 17.5} textAnchor="middle">
          {footerText}
        </text>
      </g>
    </svg>
  );
}
