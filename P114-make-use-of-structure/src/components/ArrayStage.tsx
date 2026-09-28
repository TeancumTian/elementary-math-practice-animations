"use client";

import { useMemo } from "react";
import {
  ARRAY_GEOMETRY as A,
  arrayChipCenter,
  arrayGroupBox,
  layoutArray,
  lerpPos,
  type ArrayGroup,
  type ArrayModel,
  type ArrayStage as StageId,
  type Pos,
} from "@/lib/model";
import { moveProgress, type Overlay } from "@/lib/timeline";

interface Props {
  model: ArrayModel;
  from: StageId;
  to: StageId;
  overlay: Overlay;
  beatElapsed: number;
  moveMs: number;
  staggerMs: number;
  reducedMotion: boolean;
  title: string;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

function Robot({ id, pos, antenna }: { id: string; pos: Pos; antenna: number }) {
  return (
    <g transform={`translate(${r2(pos.x)} ${r2(pos.y)})`} className="robot" data-robot={id}>
      <line x1={22} y1={3} x2={22} y2={11} className="robot-line" />
      <circle cx={22} cy={4} r={4} className={`antenna antenna-${antenna}`} />
      <rect x={4} y={10} width={36} height={26} rx={8} className="robot-body" />
      <circle cx={15.5} cy={21} r={4.2} className="robot-eye" />
      <circle cx={28.5} cy={21} r={4.2} className="robot-eye" />
      <circle cx={15.5} cy={21} r={1.9} className="robot-pupil" />
      <circle cx={28.5} cy={21} r={1.9} className="robot-pupil" />
      <rect x={15} y={29} width={14} height={3} rx={1.5} className="robot-mouth" />
      <rect x={11} y={36} width={6} height={7} rx={2} className="robot-leg" />
      <rect x={27} y={36} width={6} height={7} rx={2} className="robot-leg" />
    </g>
  );
}

function GroupOutline({ group, positions }: { group: ArrayGroup; positions: Record<string, Pos> }) {
  const box = arrayGroupBox(group.memberIds.map((id) => positions[id]));
  const chip = arrayChipCenter(group.kind, box);
  return (
    <g className={`group group-${group.kind}`} data-group={group.id}>
      <rect x={r2(box.x)} y={r2(box.y)} width={r2(box.w)} height={r2(box.h)} rx={12} className="group-ring" />
      <circle cx={r2(chip.cx)} cy={r2(chip.cy)} r={13} className="group-chip" />
      <text x={r2(chip.cx)} y={r2(chip.cy + 5.5)} textAnchor="middle" className="group-chip-text">
        {group.label}
      </text>
    </g>
  );
}

export function ArrayStageSvg({ model, from, to, overlay, beatElapsed, moveMs, staggerMs, reducedMotion, title }: Props) {
  const fromLayout = useMemo(() => layoutArray(model, from, overlay.reveal), [model, from, overlay.reveal]);
  const toLayout = useMemo(() => layoutArray(model, to, overlay.reveal), [model, to, overlay.reveal]);

  let settled = true;
  const positions: Record<string, Pos> = {};
  for (const robot of model.robots) {
    // March order: the right-most column leads, so robots never pass through each other.
    const order = (model.cols - 1 - robot.col) * model.rows + robot.row;
    const t = from === to ? 1 : moveProgress(beatElapsed, moveMs, order * staggerMs, reducedMotion);
    if (t < 1) settled = false;
    positions[robot.id] = t >= 1 ? toLayout.positions[robot.id] : lerpPos(fromLayout.positions[robot.id], toLayout.positions[robot.id], t);
  }

  const groups = overlay.focus === "rows" ? toLayout.rowGroups : overlay.focus === "columns" ? toLayout.columnGroups : [];

  return (
    <svg
      className="stage-svg"
      viewBox={`0 0 ${A.width} ${A.height}`}
      role="img"
      aria-labelledby="stage-title stage-desc"
      data-visual="array"
      data-stage={to}
    >
      <title id="stage-title">{title}</title>
      <desc id="stage-desc">{toLayout.description}</desc>
      <rect x={0.5} y={0.5} width={A.width - 1} height={A.height - 1} rx={14} className="mat mat-parade" />
      <line x1={16} x2={A.width - 16} y1={A.height - 52} y2={A.height - 52} className="parade-ground" />
      {/* Outlines follow the robots while they slide, so a group is always drawn around its own members. */}
      {to !== "offstage" && groups.map((g) => <GroupOutline key={g.id} group={g} positions={positions} />)}
      <g className="robots" data-settled={settled ? "true" : "false"}>
        {model.robots.map((robot) => (
          <Robot key={robot.id} id={robot.id} pos={positions[robot.id]} antenna={robot.antenna} />
        ))}
      </g>
      <g className="footer">
        <rect x={12} y={A.height - 38} width={A.width - 24} height={30} rx={15} />
        <text x={A.width / 2} y={A.height - 17.5} textAnchor="middle">
          {toLayout.footer}
        </text>
      </g>
    </svg>
  );
}
