/**
 * SVG renderers. They draw exactly the state objects the model returns:
 * no layout math, no timing, no numbers of their own.
 */
import type { ReactNode } from 'react';
import {
  BALANCE,
  GRAPH,
  GROUP_DOT,
  TEXT,
  RIBBON_LAYOUT,
  cmToX,
  displayedTickLabel,
  gridY,
  groupDotCenter,
  inAllLabel,
  monoCharWidth,
  panDotCenter,
  rulerLabelY,
  rulerTicks,
  rulerUnitLabel,
  type CardState,
  type EquationSceneState,
  type FinaleState,
  type GraphSceneState,
  type IntroState,
  type MessageToken,
  type PanState,
  type RulerItemState,
  type RulerSceneState,
  type RulerSpec,
  type StampState,
  type TransferSceneState,
} from '../model/precision-model';

export const C = {
  ink: '#1f2a44',
  muted: '#4b5563',
  paper: '#ffffff',
  line: '#d6c7ad',
  cream: '#fff8ec',
  brand: '#0f766e',
  brandDark: '#115e59',
  brandSoft: '#ccfbf1',
  warn: '#b45309',
  warnSoft: '#fef3c7',
  ok: '#15803d',
  okSoft: '#dcfce7',
  pencil: '#f6b91a',
  pencilDark: '#a16207',
  eraserPink: '#f08a9c',
  sleeve: '#3b82f6',
  wood: '#ecc998',
  graphite: '#374151',
  metal: '#a3aab5',
  ruler: '#fde9a8',
  rulerEdge: '#b7791f',
  bar: '#2f6fd6',
  barEdge: '#1e3a8a',
  dot: '#7c3aed',
  ribbon: '#db2777',
  ribbonDark: '#9d174d',
  fox: '#ea7a24',
  counter: '#a16207',
} as const;

const FONT_MONO = 'mono';

// ---------------------------------------------------------------- shared bits

function WarnIcon({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <g transform={`translate(${x} ${y})`} aria-hidden="true">
      <path d="M 0 -8 L 8 7 L -8 7 Z" fill={color} />
      <rect x={-1} y={-3} width={2} height={6} fill="#fff" />
      <rect x={-1} y={4} width={2} height={2} fill="#fff" />
    </g>
  );
}

function CheckIcon({ x, y, color, size = 1 }: { x: number; y: number; color: string; size?: number }) {
  return (
    <path
      aria-hidden="true"
      d={`M ${x - 7 * size} ${y} L ${x - 2 * size} ${y + 5 * size} L ${x + 8 * size} ${y - 6 * size}`}
      fill="none"
      stroke={color}
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

function Stamp({ stamp, x, y }: { stamp: StampState; x: number; y: number }) {
  if (stamp.opacity < 0.01) return null;
  const faulty = stamp.kind === 'needs-repair';
  const color = faulty ? C.warn : C.ok;
  const label = TEXT.stamp[stamp.kind];
  return (
    <g
      transform={`translate(${x} ${y}) rotate(-4) scale(${stamp.scale})`}
      opacity={stamp.opacity}
      data-stamp={stamp.kind}
    >
      <rect
        x={-78}
        y={-16}
        width={156}
        height={32}
        rx={7}
        fill={faulty ? C.warnSoft : C.okSoft}
        stroke={color}
        strokeWidth={2.5}
        strokeDasharray={faulty ? '6 3' : undefined}
      />
      {faulty ? <WarnIcon x={-62} y={0} color={color} /> : <CheckIcon x={-60} y={0} color={color} size={0.8} />}
      <text x={10} y={5.5} textAnchor="middle" fontSize={15} fontWeight={800} fill={color}>
        {label}
      </text>
    </g>
  );
}

/** Invisible text is not mounted, so future answers never sit hidden in the DOM. */
const VISIBLE = 0.01;

function Token({ token }: { token: MessageToken }) {
  if (token.opacity <= VISIBLE) return null;
  const w = token.text.length * monoCharWidth(token.fontSize);
  return (
    <g opacity={token.opacity} data-token={token.id}>
      {token.pill > 0.01 && (
        <rect
          x={token.x - w / 2 - 6}
          y={token.y - token.fontSize * 0.86}
          width={w + 12}
          height={token.fontSize * 1.18}
          rx={7}
          fill={C.okSoft}
          stroke={C.ok}
          strokeWidth={2}
          opacity={token.pill}
        />
      )}
      <text
        x={token.x}
        y={token.y}
        textAnchor="middle"
        className={FONT_MONO}
        fontSize={token.fontSize}
        fontWeight={token.emphasis ? 800 : 500}
        fill={token.emphasis ? C.brandDark : C.ink}
        style={token.emphasis ? { textDecoration: 'underline' } : undefined}
      >
        {token.text}
      </text>
    </g>
  );
}

function Card({ card, children }: { card: CardState; children?: ReactNode }) {
  const stroke = card.status === 'faulty' ? C.warn : card.status === 'fixed' ? C.ok : C.line;
  return (
    <g opacity={card.opacity} data-card-status={card.status}>
      <rect
        x={card.x}
        y={card.y}
        width={card.width}
        height={card.height}
        rx={12}
        fill={C.paper}
        stroke={stroke}
        strokeWidth={card.status === 'neutral' ? 2 : 3}
        strokeDasharray={card.status === 'faulty' ? '9 6' : undefined}
      />
      <text x={card.x + 16} y={card.y + 25} fontSize={17} fontWeight={700} fill={C.muted}>
        {card.header}
      </text>
      {card.tokens.map((tok) => (
        <Token key={tok.id} token={tok} />
      ))}
      {children}
      {card.stamps.map((s) => (
        <Stamp key={s.kind} stamp={s} x={card.stampX} y={card.stampY} />
      ))}
    </g>
  );
}

function Ruler({ r, opacity = 1, unitHighlight = 0 }: { r: RulerSpec; opacity?: number; unitHighlight?: number }) {
  const ticks = rulerTicks(r);
  const left = r.x0 - 12;
  const right = cmToX(r, r.maxCm) + 12;
  const unit = rulerUnitLabel(r);
  return (
    <g opacity={opacity} data-ruler={r.id}>
      <rect x={left} y={r.top} width={right - left} height={r.height} rx={6} fill={C.ruler} stroke={C.rulerEdge} strokeWidth={1.5} />
      {ticks.map((t) => (
        <line key={t.id} x1={t.x} x2={t.x} y1={r.top} y2={r.top + t.length} stroke={C.ink} strokeWidth={t.whole ? 1.6 : 1} />
      ))}
      {ticks
        .filter((t) => t.label !== null)
        .map((t) => (
          <text key={`${t.id}-label`} x={t.x} y={rulerLabelY(r)} textAnchor="middle" fontSize={r.labelFontSize} fontWeight={650} fill={C.ink}>
            {t.label}
          </text>
        ))}
      {unitHighlight > 0.01 && (
        <rect x={unit.x - 28} y={unit.y - 15} width={32} height={20} rx={5} fill={C.okSoft} stroke={C.ok} strokeWidth={2} opacity={unitHighlight} />
      )}
      <text x={unit.x} y={unit.y} textAnchor="end" fontSize={16} fontWeight={800} fill={C.ink}>
        {unit.text}
      </text>
    </g>
  );
}

// ---------------------------------------------------------------- intro

function Juno() {
  return (
    <g aria-hidden="true" data-character="juno">
      <path d="M 44 108 L 50 78 L 66 100 Z" fill={C.fox} />
      <path d="M 96 108 L 90 78 L 74 100 Z" fill={C.fox} />
      <rect x={38} y={158} width={64} height={96} rx={20} fill={C.brand} />
      <rect x={52} y={188} width={36} height={26} rx={5} fill={C.brandSoft} />
      <path d="M 62 196 L 78 208 M 76 194 a 5 5 0 1 0 6 6" stroke={C.brandDark} strokeWidth={3} fill="none" strokeLinecap="round" />
      <circle cx={70} cy={126} r={32} fill={C.fox} />
      <ellipse cx={70} cy={140} rx={18} ry={13} fill="#fff" />
      <circle cx={59} cy={120} r={4} fill={C.ink} />
      <circle cx={81} cy={120} r={4} fill={C.ink} />
      <circle cx={70} cy={134} r={4.5} fill={C.ink} />
      <path d="M 62 144 Q 70 150 78 144" stroke={C.ink} strokeWidth={2} fill="none" strokeLinecap="round" />
      <text x={70} y={276} textAnchor="middle" fontSize={16} fontWeight={800} fill={C.ink}>
        {TEXT.fixer}
      </text>
    </g>
  );
}

export function IntroScene({ s }: { s: IntroState }) {
  return (
    <g>
      <rect x={20} y={12} width={360} height={44} rx={10} fill={C.brand} />
      <text x={200} y={40} textAnchor="middle" fontSize={18} fontWeight={800} fill="#fff" letterSpacing={0.6}>
        {TEXT.shopSign}
      </text>
      <Juno />
      <rect x={130} y={166} width={262} height={12} rx={4} fill={C.counter} />
      {s.jobCards.map((card) => (
        <g key={card.id} opacity={card.opacity} data-job={card.id} transform={`translate(${card.x} ${card.y})`}>
          <rect x={0} y={0} width={70} height={62} rx={8} fill={C.paper} stroke={C.line} strokeWidth={2} />
          <text x={35} y={22} textAnchor="middle" fontSize={15} fontWeight={800} fill={C.ink}>
            {card.name}
          </text>
          <line x1={12} x2={58} y1={36} y2={36} stroke={C.line} strokeWidth={3} strokeLinecap="round" />
          <line x1={12} x2={48} y1={47} y2={47} stroke={C.line} strokeWidth={3} strokeLinecap="round" />
        </g>
      ))}
      <g>
        <rect x={130} y={190} width={262} height={112} rx={10} fill={C.paper} stroke={C.line} strokeWidth={2} />
        <text x={146} y={212} fontSize={15} fontWeight={800} fill={C.ink}>
          {TEXT.checklistTitle}
        </text>
        {s.checklist.map((item) => (
          <g key={item.id} opacity={item.opacity}>
            <rect x={item.x - 22} y={item.y - 12} width={14} height={14} rx={3} fill={C.okSoft} stroke={C.ok} strokeWidth={1.5} />
            <CheckIcon x={item.x - 15} y={item.y - 5} color={C.ok} size={0.5} />
            <text x={item.x} y={item.y} fontSize={15} fill={C.ink}>
              {item.text}
            </text>
          </g>
        ))}
      </g>
      <Stamp stamp={s.stamp} x={269} y={150} />
    </g>
  );
}

// ---------------------------------------------------------------- ruler scenes

function PencilShape({ item }: { item: RulerItemState }) {
  const { leftX: x, y, height: h, widthPx: w } = item;
  const eraser = 14;
  const ferrule = 9;
  const tip = 30;
  return (
    <g opacity={item.opacity} data-item="pencil">
      <rect x={x} y={y} width={eraser + 4} height={h} rx={5} fill={C.eraserPink} />
      <rect x={x + eraser} y={y} width={ferrule} height={h} fill={C.metal} />
      <rect x={x + eraser + ferrule} y={y} width={w - eraser - ferrule - tip} height={h} fill={C.pencil} />
      <line x1={x + eraser + ferrule} x2={x + w - tip} y1={y + h / 2} y2={y + h / 2} stroke={C.pencilDark} strokeWidth={1.2} opacity={0.6} />
      <path d={`M ${x + w - tip} ${y} L ${x + w} ${y + h / 2} L ${x + w - tip} ${y + h} Z`} fill={C.wood} />
      <path d={`M ${x + w - 10} ${y + h / 2 - 4} L ${x + w} ${y + h / 2} L ${x + w - 10} ${y + h / 2 + 4} Z`} fill={C.graphite} />
      <path
        d={`M ${x + 5} ${y} L ${x + w - tip} ${y} L ${x + w} ${y + h / 2} L ${x + w - tip} ${y + h} L ${x + 5} ${y + h} Q ${x} ${y + h} ${x} ${y + h - 5} L ${x} ${y + 5} Q ${x} ${y} ${x + 5} ${y} Z`}
        fill="none"
        stroke={C.pencilDark}
        strokeWidth={1.5}
      />
    </g>
  );
}

function EraserShape({ item }: { item: RulerItemState }) {
  const { leftX: x, y, height: h, widthPx: w } = item;
  return (
    <g opacity={item.opacity} data-item="eraser">
      <rect x={x} y={y} width={w} height={h} rx={6} fill={C.eraserPink} />
      <rect x={x + w * 0.35} y={y} width={w * 0.65} height={h} fill={C.sleeve} />
      <rect x={x} y={y} width={w} height={h} rx={6} fill="none" stroke={C.ribbonDark} strokeWidth={1.5} />
    </g>
  );
}

export function RulerScene({ s }: { s: RulerSceneState }) {
  const r = s.ruler;
  return (
    <g>
      <Card card={s.card} />
      <Ruler r={r} unitHighlight={s.unitLabelHighlight} />
      {s.item.id === 'pencil' ? <PencilShape item={s.item} /> : <EraserShape item={s.item} />}
      {s.guides.map((g) => (
        <line key={g.id} x1={g.x} x2={g.x} y1={s.item.y - 8} y2={r.top} stroke={C.brand} strokeWidth={1.5} strokeDasharray="3 3" opacity={g.opacity} />
      ))}
      {s.hops.map((h) => {
        const mid = (h.fromX + h.toX) / 2;
        const ctrlY = 2 * h.peakY - h.baseY;
        return (
          <g key={h.id} opacity={h.opacity} data-hop={h.index}>
            <path
              d={`M ${h.fromX} ${h.baseY} Q ${mid} ${ctrlY} ${h.toX} ${h.baseY}`}
              fill="none"
              stroke={C.brand}
              strokeWidth={2.5}
              pathLength={1}
              strokeDasharray="1 1"
              strokeDashoffset={1 - h.draw}
            />
            <text x={mid} y={h.peakY + 22} textAnchor="middle" fontSize={17} fontWeight={800} fill={C.brandDark}>
              {h.index}
            </text>
          </g>
        );
      })}
      {s.zeroMarker.opacity > 0.01 && (
        <g opacity={s.zeroMarker.opacity} data-marker="zero">
          <path d={`M ${s.zeroMarker.x} ${r.top + r.height + 4} l -8 12 l 16 0 Z`} fill={C.brand} />
          <text x={s.zeroMarker.x - 10} y={r.top + r.height + 38} fontSize={18} fontWeight={800} fill={C.brandDark}>
            {TEXT.zeroMarker}
          </text>
        </g>
      )}
    </g>
  );
}

// ---------------------------------------------------------------- graph scenes

function TallyMarks({ fives, ones }: { fives: number; ones: number }) {
  const groupW = 30;
  const width = fives * groupW + ones * 7 + 4;
  const marks: ReactNode[] = [];
  for (let g = 0; g < fives; g += 1) {
    const x0 = 3 + g * groupW;
    for (let i = 0; i < 4; i += 1) marks.push(<line key={`f${g}-${i}`} x1={x0 + i * 6} x2={x0 + i * 6} y1={3} y2={21} />);
    marks.push(<line key={`f${g}-x`} x1={x0 - 3} x2={x0 + 21} y1={18} y2={5} />);
  }
  for (let i = 0; i < ones; i += 1) {
    const x = 3 + fives * groupW + i * 7;
    marks.push(<line key={`o${i}`} x1={x} x2={x} y1={3} y2={21} />);
  }
  return (
    <svg className="tally-marks" width={width} height={24} viewBox={`0 0 ${width} 24`} aria-hidden="true" focusable="false">
      <g stroke={C.ink} strokeWidth={2.2} strokeLinecap="round">
        {marks}
      </g>
    </svg>
  );
}

/** HTML tally chart (a real table, so it reflows and reads well with a screen reader). */
export function TallyTable({ s }: { s: GraphSceneState }) {
  return (
    <table className="tally" aria-label={`${TEXT.tally.caption}: ${GRAPH.title}`}>
      <caption>{TEXT.tally.caption}</caption>
      <thead>
        <tr>
          <th scope="col">{TEXT.tally.fruit}</th>
          <th scope="col">{TEXT.tally.tally}</th>
          <th scope="col">{TEXT.tally.number}</th>
        </tr>
      </thead>
      <tbody>
        {s.tally.map((row) => (
          <tr key={row.fruitId} style={{ opacity: row.opacity }} className={row.highlight ? 'hl' : undefined} data-fruit={row.fruitId}>
            <th scope="row">
              {row.label}
              {row.highlight && (
                <span className="match">
                  {' '}✓<span className="sr-only"> {TEXT.tally.match}</span>
                </span>
              )}
            </th>
            <td>
              <TallyMarks fives={row.fives} ones={row.ones} />
            </td>
            <td className="num">{row.count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function GraphScene({ s }: { s: GraphSceneState }) {
  const top = gridY(GRAPH.gridCount);
  return (
    <g>
      <g opacity={s.graphOpacity}>
        <text x={GRAPH.axisX} y={30} fontSize={20} fontWeight={800} fill={C.ink}>
          {GRAPH.title}
        </text>
        {s.spaceBands > 0.01 &&
          s.ticks.slice(0, -1).map((t) =>
            t.index % 2 === 0 ? (
              <rect
                key={`band-${t.id}`}
                x={GRAPH.axisX}
                y={gridY(t.index + 1)}
                width={GRAPH.plotRight - GRAPH.axisX}
                height={GRAPH.step}
                fill={C.brandSoft}
                opacity={s.spaceBands}
              />
            ) : null,
          )}
        {s.ticks.map((t) => (
          <line key={`grid-${t.id}`} x1={GRAPH.axisX} x2={GRAPH.plotRight} y1={t.y} y2={t.y} stroke="#cbd5e1" strokeWidth={1} strokeDasharray={t.index === 0 ? undefined : '4 4'} />
        ))}
        {s.bars.map((b) => (
          <rect
            key={b.id}
            data-bar={b.fruitId}
            x={b.centerX - b.width / 2}
            y={b.topY}
            width={b.width}
            height={Math.max(0, b.height)}
            fill={C.bar}
            stroke={C.barEdge}
            strokeWidth={1.5}
          />
        ))}
        <line x1={GRAPH.axisX} x2={GRAPH.axisX} y1={top - 10} y2={GRAPH.baseY} stroke={C.ink} strokeWidth={2} />
        <line x1={GRAPH.axisX} x2={GRAPH.plotRight} y1={GRAPH.baseY} y2={GRAPH.baseY} stroke={C.ink} strokeWidth={2} />
        {s.ticks.map((t) => {
          const shown = displayedTickLabel(t);
          const fixed = t.previousLabel !== null && t.morph >= 1;
          return (
            <g key={t.id} data-tick={t.index} data-label={shown}>
              <line x1={GRAPH.axisX - 6} x2={GRAPH.axisX} y1={t.y} y2={t.y} stroke={C.ink} strokeWidth={2} />
              {t.previousLabel !== null && t.morph < 1 && (
                <text x={GRAPH.axisX - 12} y={t.y + 6 - 10 * t.morph} textAnchor="end" fontSize={19} fontWeight={700} fill={C.ink} opacity={1 - t.morph}>
                  {t.previousLabel}
                </text>
              )}
              {(t.previousLabel === null || t.morph > 0) && (
                <text
                  x={GRAPH.axisX - 12}
                  y={t.y + 6 + (t.previousLabel === null ? 0 : 10 * (1 - t.morph))}
                  textAnchor="end"
                  fontSize={19}
                  fontWeight={fixed ? 900 : 700}
                  fill={fixed ? C.ok : C.ink}
                  opacity={t.previousLabel === null ? 1 : t.morph}
                >
                  {t.label}
                </text>
              )}
            </g>
          );
        })}
        {s.pointer && (
          <circle
            data-pointer={s.pointer.index}
            cx={GRAPH.axisX - 18}
            cy={gridY(s.pointer.index)}
            r={13}
            fill="none"
            stroke={s.pointer.atGap ? C.warn : C.brand}
            strokeWidth={3}
            strokeDasharray={s.pointer.atGap ? '4 3' : undefined}
            opacity={s.pointer.opacity}
          />
        )}
        {s.gapMarker.opacity > 0.01 && (
          <g opacity={s.gapMarker.opacity} data-gap-marker="true">
            <circle cx={GRAPH.axisX + 11} cy={gridY(s.gapMarker.index)} r={9} fill={C.warnSoft} stroke={C.warn} strokeWidth={2} />
            <text x={GRAPH.axisX + 11} y={gridY(s.gapMarker.index) + 5} textAnchor="middle" fontSize={14} fontWeight={900} fill={C.warn}>
              ?
            </text>
          </g>
        )}
        {s.readingLine && s.readingLine.opacity > 0.01 && (
          <g opacity={s.readingLine.opacity} data-reading-line={s.readingLine.fruitId}>
            <line x1={s.readingLine.x1} x2={s.readingLine.x2} y1={s.readingLine.y} y2={s.readingLine.y} stroke={C.ok} strokeWidth={3} strokeDasharray="6 4" />
            <circle cx={GRAPH.axisX - 18} cy={s.readingLine.y} r={13} fill="none" stroke={C.ok} strokeWidth={3} />
          </g>
        )}
        <text transform={`translate(24 ${(top + GRAPH.baseY) / 2}) rotate(-90)`} textAnchor="middle" fontSize={17} fontWeight={700} fill={C.ink}>
          {GRAPH.yAxisTitle}
        </text>
        {s.bars.map((b) => (
          <text key={`${b.id}-label`} x={b.centerX} y={GRAPH.baseY + 23} textAnchor="middle" fontSize={17} fontWeight={700} fill={C.ink}>
            {b.label}
          </text>
        ))}
        <text x={(GRAPH.axisX + GRAPH.plotRight) / 2} y={GRAPH.baseY + 48} textAnchor="middle" fontSize={17} fontWeight={800} fill={C.ink}>
          {GRAPH.xAxisTitle}
        </text>
      </g>
      {s.stamps.map((st) => (
        <Stamp key={st.kind} stamp={st} x={308} y={27} />
      ))}
    </g>
  );
}

// ---------------------------------------------------------------- equation scenes

function Dots({ pan }: { pan: PanState }) {
  const nodes: ReactNode[] = [];
  for (let k = 0; k < pan.solid + pan.hollow; k += 1) {
    const { x, y } = panDotCenter(pan, k);
    const isHollow = k >= pan.solid;
    nodes.push(
      <circle key={k} cx={x} cy={y} r={6} fill={isHollow ? '#fff' : C.dot} stroke={C.dot} strokeWidth={2} data-dot={isHollow ? 'hollow' : 'solid'} />,
    );
  }
  return <g>{nodes}</g>;
}

function Pan({ pan }: { pan: PanState }) {
  const half = 55;
  return (
    <g data-pan={pan.side}>
      <path d={`M ${pan.centerX} ${pan.trayY - BALANCE.string} L ${pan.centerX - half + 6} ${pan.trayY}`} stroke={C.muted} strokeWidth={1.5} />
      <path d={`M ${pan.centerX} ${pan.trayY - BALANCE.string} L ${pan.centerX + half - 6} ${pan.trayY}`} stroke={C.muted} strokeWidth={1.5} />
      <path d={`M ${pan.centerX - half} ${pan.trayY} Q ${pan.centerX} ${pan.trayY + 16} ${pan.centerX + half} ${pan.trayY} Z`} fill="#e5e7eb" stroke={C.muted} strokeWidth={2} />
      <g opacity={pan.opacity}>
        <Dots pan={pan} />
        <text x={pan.centerX} y={pan.trayY + 28} textAnchor="middle" className={FONT_MONO} fontSize={21} fontWeight={800} fill={C.ink}>
          {pan.label}
        </text>
        {pan.totalOpacity > VISIBLE && (
          <text x={pan.centerX} y={pan.trayY + 48} textAnchor="middle" fontSize={17} fontWeight={700} fill={C.muted} opacity={pan.totalOpacity}>
            {inAllLabel(pan.total)}
          </text>
        )}
      </g>
    </g>
  );
}

export function EquationScene({ s }: { s: EquationSceneState }) {
  const b = s.balance;
  return (
    <g>
      <Card card={s.card}>
        {s.lineChecks.map((c) =>
          c.opacity > 0.01 ? (
            <g key={c.id} opacity={c.opacity} data-line-check={c.id}>
              <CheckIcon x={c.x + 8} y={c.y - 7} color={C.ok} size={0.8} />
              <text x={c.x + 20} y={c.y} fontSize={17} fontWeight={800} fill={C.ok}>
                {TEXT.lineTrue}
              </text>
            </g>
          ) : null,
        )}
      </Card>
      {s.groups.map((g) => (
        <g key={g.id} opacity={g.opacity} data-group={g.id}>
          {Array.from({ length: g.count }, (_, k) => {
            const { x, y } = groupDotCenter(g, k);
            return <circle key={k} cx={x} cy={y} r={GROUP_DOT.radius} fill={C.dot} />;
          })}
          <text x={g.x + g.width / 2} y={g.labelY} textAnchor="middle" fontSize={19} fontWeight={800} fill={C.ink}>
            {g.count} {g.label}
          </text>
        </g>
      ))}
      {s.groups.slice(0, -1).map((g, k) => {
        const next = s.groups[k + 1];
        return (
          <text key={`then-${g.id}`} x={(g.x + g.width + next.x) / 2} y={g.y + 12} textAnchor="middle" fontSize={17} fontStyle="italic" fill={C.muted} opacity={Math.min(g.opacity, next.opacity) * s.connectorOpacity}>
            {TEXT.then}
          </text>
        );
      })}
      {b.opacity > 0.01 && (
        <g opacity={b.opacity} data-balance-angle={b.angle.toFixed(2)}>
          <line x1={b.pivot.x} x2={b.pivot.x} y1={b.pivot.y} y2={BALANCE.standBottom} stroke={C.muted} strokeWidth={5} />
          <rect x={b.pivot.x - 40} y={BALANCE.standBottom} width={80} height={7} rx={3} fill={C.muted} />
          <g transform={`rotate(${b.angle} ${b.pivot.x} ${b.pivot.y})`}>
            <line x1={b.pivot.x - b.halfBeam - 4} x2={b.pivot.x + b.halfBeam + 4} y1={b.pivot.y} y2={b.pivot.y} stroke={C.ink} strokeWidth={5} strokeLinecap="round" />
          </g>
          <path d={`M ${b.pivot.x} ${b.pivot.y - 3} l -9 14 l 18 0 Z`} fill={C.ink} />
          <Pan pan={b.left} />
          <Pan pan={b.right} />
          {b.relation && b.relation.opacity > 0.01 && (
            <g opacity={b.relation.opacity} data-relation={b.relation.text}>
              <rect x={b.pivot.x - 62} y={125} width={124} height={28} rx={14} fill={b.relation.symbol === '=' ? C.okSoft : C.warnSoft} stroke={b.relation.symbol === '=' ? C.ok : C.warn} strokeWidth={2} />
              <text x={b.pivot.x} y={145} textAnchor="middle" fontSize={17} fontWeight={800} fill={b.relation.symbol === '=' ? C.ok : C.warn}>
                {b.relation.symbol} {b.relation.text}
              </text>
            </g>
          )}
        </g>
      )}
    </g>
  );
}

// ---------------------------------------------------------------- transfer scenes

export function TransferScene({ s }: { s: TransferSceneState }) {
  const r = s.ruler;
  return (
    <g>
      <Card card={s.card}>
        {s.lines.map((l) =>
          l.opacity > VISIBLE ? (
            <text key={l.id} x={l.x} y={l.y} className={FONT_MONO} fontSize={l.fontSize} fontWeight={700} fill={C.ink} opacity={l.opacity} data-line={l.id}>
              {l.text}
            </text>
          ) : null,
        )}
      </Card>
      <Ruler r={r} opacity={s.rulerOpacity} />
      {s.bracket.opacity > 0.01 && (
        <g opacity={s.bracket.opacity} data-bracket="total">
          <path d={`M ${s.bracket.fromX} ${s.bracket.y + 8} L ${s.bracket.fromX} ${s.bracket.y} L ${s.bracket.toX} ${s.bracket.y} L ${s.bracket.toX} ${s.bracket.y + 8}`} fill="none" stroke={C.ok} strokeWidth={2.5} />
          <rect x={(s.bracket.fromX + s.bracket.toX) / 2 - 36} y={s.bracket.y - 15} width={72} height={24} rx={12} fill={C.okSoft} stroke={C.ok} strokeWidth={2} />
          <text x={(s.bracket.fromX + s.bracket.toX) / 2} y={s.bracket.y + 3} textAnchor="middle" fontSize={17} fontWeight={800} fill={C.ok}>
            {s.bracket.label}
          </text>
        </g>
      )}
      {s.pieces.map((p, k) => (
        <g key={p.id} opacity={p.opacity} data-piece={p.id}>
          <rect x={p.leftX} y={p.y} width={p.widthPx} height={RIBBON_LAYOUT.pieceHeight} rx={3} fill={k === 1 ? '#f472b6' : k === 2 ? '#be185d' : C.ribbon} stroke={C.ribbonDark} strokeWidth={1.5} />
          <text x={p.leftX + p.widthPx / 2} y={p.y - 6} textAnchor="middle" fontSize={16} fontWeight={800} fill={C.ribbonDark}>
            {p.label}
          </text>
        </g>
      ))}
    </g>
  );
}

// ---------------------------------------------------------------- finale

export function FinaleScene({ s }: { s: FinaleState }) {
  return (
    <g>
      <text x={200} y={44} textAnchor="middle" fontSize={22} fontWeight={800} fill={C.ink}>
        {TEXT.finaleTitle}
      </text>
      {s.rows.map((row) => {
        const y = row.y;
        return (
          <g key={row.id} opacity={row.opacity} data-row={row.id}>
            <rect x={24} y={y - 26} width={352} height={52} rx={12} fill={C.paper} stroke={C.ok} strokeWidth={2} />
            <rect x={38} y={y - 14} width={28} height={28} rx={6} fill={C.okSoft} stroke={C.ok} strokeWidth={2} />
            <CheckIcon x={52} y={y} color={C.ok} />
            <text x={80} y={y - 3} fontSize={18} fontWeight={800} fill={C.ink}>
              {row.title}
            </text>
            <text x={80} y={y + 18} className={FONT_MONO} fontSize={16} fontWeight={700} fill={C.muted}>
              {row.detail}
            </text>
          </g>
        );
      })}
      <g opacity={s.badgeOpacity} data-badge="done">
        <rect x={90} y={262} width={220} height={38} rx={19} fill={C.brand} />
        <text x={200} y={287} textAnchor="middle" fontSize={17} fontWeight={800} fill="#fff">
          {TEXT.finaleBadge}
        </text>
      </g>
    </g>
  );
}
