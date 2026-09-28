import type { ArcFrame, BubbleFrame, CellFrame, CrateFrame, Frame, SheetFrame } from '@/lesson/frame';
import type { Point, Rect } from '@/model/repeatedReasoning';

/* Easing ------------------------------------------------------------- */

const easeOutCubic = (p: number) => 1 - Math.pow(1 - p, 3);
function easeOutBack(p: number) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
}
function easeOutBounce(p: number) {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (p < 1 / d1) return n1 * p * p;
  if (p < 2 / d1) return n1 * (p -= 1.5 / d1) * p + 0.75;
  if (p < 2.5 / d1) return n1 * (p -= 2.25 / d1) * p + 0.9375;
  return n1 * (p -= 2.625 / d1) * p + 0.984375;
}
const r2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Scale an element about a point (used for "pop in" of written numbers). */
function popAbout(x: number, y: number, p: number) {
  const s = 0.6 + 0.4 * easeOutBack(p);
  return `translate(${r2(x)} ${r2(y)}) scale(${r2(s)}) translate(${r2(-x)} ${r2(-y)})`;
}

/* Stage -------------------------------------------------------------- */

export function Stage({ frame, description }: { frame: Frame; description: string }) {
  const L = frame.layout;
  const W = L.width;
  const H = L.height;
  return (
    <svg
      className={`stage-svg stage-${L.name}`}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-labelledby="scene-title scene-desc"
      data-layout={L.name}
      data-scene={frame.kind}
    >
      <title id="scene-title">{frame.kind === 'orchard' ? "Leo's apple crates and chalkboard" : "Leo's sticker sheets"}</title>
      <desc id="scene-desc">{description}</desc>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d7ecff" />
          <stop offset="1" stopColor="#f6fbff" />
        </linearGradient>
        <radialGradient id="appleGrad" cx="0.35" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#ff6b5b" />
          <stop offset="1" stopColor="#c62a1f" />
        </radialGradient>
        <marker id="arrowChalk" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="3.6" markerHeight="3.6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#ffd166" />
        </marker>
        <marker id="arrowInk" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="3.6" markerHeight="3.6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#c05600" />
        </marker>
      </defs>

      <rect x={0} y={0} width={W} height={H} fill="url(#sky)" />
      <Clouds w={W} narrow={L.name === 'narrow'} />
      {frame.kind === 'orchard' ? <OrchardGround frame={frame} /> : <Desk frame={frame} />}

      <text className="svg-header" x={L.header.x} y={L.header.y} fontSize={L.header.size}>
        {frame.header}
      </text>

      {frame.banner && (
        <g opacity={frame.banner.p} transform={popAbout(L.banner.cx, L.banner.cy, frame.banner.p)}>
          <rect x={L.banner.cx - L.banner.w / 2} y={L.banner.cy - L.banner.h / 2} width={L.banner.w} height={L.banner.h} rx={L.banner.h / 2} fill="#fff4c2" stroke="#b98500" strokeWidth={2} />
          <text x={L.banner.cx} y={L.banner.cy + L.banner.size * 0.35} fontSize={L.banner.size} textAnchor="middle" fontWeight={800} fill="#4a3200">
            {frame.banner.text}
          </text>
        </g>
      )}

      {frame.crates.map((c) => (
        <Crate key={c.id} crate={c} drop={L.crate.dropHeight} labelSize={L.crate.labelSize} />
      ))}
      {frame.focus && !frame.focus.onBoard && frame.kind === 'orchard' && <FocusMarks frame={frame} />}

      {frame.counter && (
        <g className="counter">
          <rect x={frame.counter.rect.x} y={frame.counter.rect.y} width={frame.counter.rect.w} height={frame.counter.rect.h} rx={frame.counter.rect.h / 2} fill="#ffffff" stroke="#1d4e89" strokeWidth={2.5} />
          <text x={frame.counter.rect.x + frame.counter.rect.w / 2} y={frame.counter.rect.y + frame.counter.rect.h / 2 + frame.counter.size * 0.36} fontSize={frame.counter.size} textAnchor="middle" fontWeight={800} fill="#1d4e89">
            {frame.counter.value}
          </text>
        </g>
      )}

      {frame.table && <Board frame={frame} />}

      {frame.leo && <Leo {...frame.leo} />}
      {frame.pip && (
        <>
          {frame.pip.post && <rect x={frame.pip.x + 24 * frame.pip.scale} y={frame.pip.y + 64 * frame.pip.scale} width={12} height={frame.table ? frame.table.board.y - (frame.pip.y + 64 * frame.pip.scale) - 4 : 120} rx={3} fill="#9c6b3f" stroke="#6e4726" strokeWidth={1.5} />}
          <Pip x={frame.pip.x} y={frame.pip.y} scale={frame.pip.scale} p={frame.pip.p} />
        </>
      )}

      {frame.sheets.map((s) => (
        <Sheet key={s.id} sheet={s} />
      ))}
      {frame.runArcs.map((a) => (
        <Arc key={a.id} arc={a} color="#c05600" marker="arrowInk" labelColor="#8a3d00" />
      ))}
      {frame.runs.map((r) => (
        <text key={r.id} x={r.x} y={r.y} fontSize={r.size} textAnchor="middle" fontWeight={800} fill="#17324d" opacity={r.p} transform={popAbout(r.x, r.y - r.size * 0.35, r.p)}>
          {r.text}
        </text>
      ))}
      {frame.ruleLine && (
        <g opacity={frame.ruleLine.p} transform={popAbout(frame.ruleLine.x, frame.ruleLine.y - frame.ruleLine.size * 0.35, frame.ruleLine.p)}>
          <rect
            x={frame.ruleLine.x - frame.ruleLine.size * 4.6}
            y={frame.ruleLine.y - frame.ruleLine.size * 1.05}
            width={frame.ruleLine.size * 9.2}
            height={frame.ruleLine.size * 1.45}
            rx={12}
            fill="#fff4c2"
            stroke="#b98500"
            strokeWidth={2}
          />
          <text x={frame.ruleLine.x} y={frame.ruleLine.y} fontSize={frame.ruleLine.size} textAnchor="middle" fontWeight={800} fill="#4a3200">
            {frame.ruleLine.text}
          </text>
        </g>
      )}
      {frame.finale > 0 && <Confetti frame={frame} />}

      {frame.bubble && <Bubble bubble={frame.bubble} />}
      {frame.focus && !frame.focus.onBoard && frame.kind === 'stickers' && <FocusMarks frame={frame} />}
    </svg>
  );
}

/* Scenery ------------------------------------------------------------ */

function Clouds({ w, narrow }: { w: number; narrow: boolean }) {
  const s = narrow ? 0.6 : 1;
  return (
    <g fill="#ffffff" opacity={0.75} aria-hidden="true">
      <ellipse cx={w * 0.46} cy={30 * s + 8} rx={40 * s} ry={12 * s} />
      <ellipse cx={w * 0.52} cy={24 * s + 8} rx={26 * s} ry={12 * s} />
    </g>
  );
}

function OrchardGround({ frame }: { frame: Frame }) {
  const L = frame.layout;
  const y = (frame.table?.board.y ?? L.height) - 70;
  return (
    <g aria-hidden="true">
      <path d={`M 0 ${y} Q ${L.width / 2} ${y - 22} ${L.width} ${y} L ${L.width} ${L.height} L 0 ${L.height} Z`} fill="#c7e6a8" />
    </g>
  );
}

function Desk({ frame }: { frame: Frame }) {
  const L = frame.layout;
  const y = L.sheets.y + L.sheets.h - 30;
  return <rect x={0} y={y} width={L.width} height={L.height - y} fill="#f3dfc1" aria-hidden="true" />;
}

/* Crates and apples -------------------------------------------------- */

function Crate({ crate, drop, labelSize }: { crate: CrateFrame; drop: number; labelSize: number }) {
  const { rect: R, p } = crate;
  const e = easeOutCubic(p);
  return (
    <g className="crate" data-id={crate.id} opacity={r2(Math.min(1, p * 1.5))} transform={`translate(0 ${r2((1 - e) * 14)})`}>
      <rect x={R.x} y={R.y} width={R.w} height={R.h} rx={8} fill="#e8bd86" stroke="#8a5a2b" strokeWidth={3} />
      <line x1={R.x + 6} x2={R.x + R.w - 6} y1={R.y + R.h * 0.22} y2={R.y + R.h * 0.22} stroke="#b9854c" strokeWidth={2} />
      {crate.slots.map((s) => (
        <circle key={`slot-${s.i}`} cx={s.x} cy={s.y} r={s.r} fill="#f7e7cf" stroke="#8a5a2b" strokeWidth={1.5} strokeDasharray="4 3" />
      ))}
      {crate.slots.map((s) => (s.apple > 0 ? <Apple key={s.id} id={s.id} x={s.x} y={s.y} r={s.r} p={s.apple} drop={drop} /> : null))}
      <rect x={R.x} y={R.y + R.h * 0.74} width={R.w} height={R.h * 0.26} rx={6} fill="#c98b4f" stroke="#8a5a2b" strokeWidth={3} />
      <text className="crate-label" x={crate.labelPoint.x} y={crate.labelPoint.y} fontSize={labelSize} fontWeight={700} fill="#3b2a18">
        {crate.label}
        {crate.badge && (
          <tspan opacity={crate.badge.p} fontWeight={800} fill="#1d4e89">
            {` · ${crate.badge.text}`}
          </tspan>
        )}
      </text>
    </g>
  );
}

function Apple({ id, x, y, r, p, drop }: { id: string; x: number; y: number; r: number; p: number; drop: number }) {
  const dy = -(1 - easeOutBounce(p)) * drop;
  return (
    <g className="apple" data-id={id} transform={`translate(${r2(x)} ${r2(y + dy)})`} opacity={r2(Math.min(1, p * 4))}>
      <circle r={r} fill="url(#appleGrad)" stroke="#8f241b" strokeWidth={1.5} />
      <ellipse cx={-r * 0.35} cy={-r * 0.35} rx={r * 0.25} ry={r * 0.17} fill="#ffffff" opacity={0.55} />
      <path d={`M 0 ${-r * 0.8} q 1 ${-r * 0.35} ${r * 0.22} ${-r * 0.5}`} stroke="#5b3a1a" strokeWidth={2} fill="none" strokeLinecap="round" />
      <ellipse cx={r * 0.42} cy={-r * 1.0} rx={r * 0.36} ry={r * 0.16} fill="#3f9a3f" transform={`rotate(-25 ${r2(r * 0.42)} ${r2(-r)})`} />
    </g>
  );
}

/* Chalkboard --------------------------------------------------------- */

function Board({ frame }: { frame: Frame }) {
  const T = frame.table!;
  const L = frame.layout.table;
  const B = T.board;
  return (
    <g className="board">
      <rect x={B.x} y={B.y} width={B.w} height={B.h} rx={12} fill="#23443a" stroke="#8a5a2b" strokeWidth={6} />
      <line x1={B.x + 10} x2={B.x + B.w - 10} y1={L.header.y + L.header.h + 1} y2={L.header.y + L.header.h + 1} stroke="#cfe3d6" strokeOpacity={0.35} strokeWidth={1.5} />
      <line x1={B.x + 10} x2={B.x + B.w - 10} y1={L.rule.y - 1} y2={L.rule.y - 1} stroke="#cfe3d6" strokeOpacity={0.2} strokeWidth={1.5} strokeDasharray="6 6" />
      {T.rowLabels.map((r) => (
        <text key={r.text} x={r.x} y={r.y} fontSize={r.size} fill="#d8ebdf" fontWeight={700}>
          {r.text}
        </text>
      ))}
      {T.headers.map((h) => (
        <text key={`h${h.col}`} x={h.x} y={h.y} fontSize={h.size} fill="#d8ebdf" fontWeight={700} textAnchor="middle">
          {h.text}
        </text>
      ))}
      {frame.focus?.onBoard && <FocusMarks frame={frame} />}
      {T.arcs.map((a) => (
        <Arc key={a.id} arc={a} color="#ffd166" marker="arrowChalk" labelColor="#ffd166" labelBacking="#23443a" />
      ))}
      {T.cells.map((c) => (
        <Cell key={c.id} cell={c} colW={L.colW} rowH={L.totals.h} rowY={L.totals.y} />
      ))}
    </g>
  );
}

function Cell({ cell: c, colW, rowH, rowY }: { cell: CellFrame; colW: number; rowH: number; rowY: number }) {
  const cy = c.y - c.size * 0.35;
  // wide enough for a two-digit number, but never wider than its column
  const boxW = Math.min(colW - 4, Math.max(colW - 14, c.size * 1.9));
  switch (c.kind) {
    case 'total':
      return (
        <text data-cell={c.id} x={c.x} y={c.y} fontSize={c.size} fontWeight={800} fill="#fffdf2" textAnchor="middle" opacity={c.p} transform={popAbout(c.x, cy, c.p)}>
          {c.text}
        </text>
      );
    case 'rule':
      return (
        <text data-cell={c.id} x={c.x} y={c.y} fontSize={c.size} fontWeight={700} fill="#bfe1ff" textAnchor="middle" opacity={c.p} transform={popAbout(c.x, cy, c.p)}>
          {c.text}
        </text>
      );
    case 'pending':
      return (
        <g data-cell={c.id} opacity={c.p}>
          <rect x={c.x - boxW / 2} y={rowY + 6} width={boxW} height={rowH - 12} rx={8} fill="none" stroke="#ffd166" strokeWidth={2} strokeDasharray="6 5" />
          <text x={c.x} y={c.y} fontSize={c.size} fontWeight={800} fill="#ffd166" textAnchor="middle">
            {c.text}
          </text>
        </g>
      );
    case 'predicted':
      return (
        <g data-cell={c.id}>
          <text x={c.x} y={c.y} fontSize={c.size} fontWeight={700} fontStyle="italic" fill="#ffe7a8" textAnchor="middle">
            {c.text}
          </text>
          <line x1={c.x - boxW / 2 + 6} x2={c.x + boxW / 2 - 6} y1={c.y + 6} y2={c.y + 6} stroke="#ffe7a8" strokeWidth={2} strokeDasharray="4 4" />
        </g>
      );
    case 'guess':
    case 'guessCrossed': {
      const strike = c.strike ?? 0;
      const halfW = c.size * 0.75;
      return (
        <g data-cell={c.id} opacity={c.p}>
          {c.kind === 'guess' && <rect x={c.x - boxW / 2} y={rowY + 6} width={boxW} height={rowH - 12} rx={8} fill="none" stroke="#ffb38a" strokeWidth={2} strokeDasharray="3 4" />}
          <text x={c.x} y={c.y} fontSize={c.size} fontWeight={800} fill="#ffb38a" textAnchor="middle">
            {c.text}
          </text>
          {strike > 0 && (
            <line x1={c.x - halfW} y1={c.y - c.size * 0.32} x2={c.x - halfW + 2 * halfW * strike} y2={c.y - c.size * 0.32} stroke="#ffffff" strokeWidth={2.5} strokeLinecap="round" />
          )}
        </g>
      );
    }
  }
}

function Arc({ arc: a, color, marker, labelColor, labelBacking }: { arc: ArcFrame; color: string; marker: string; labelColor: string; labelBacking?: string }) {
  const labelOpacity = clamp((a.p - 0.5) / 0.5, 0, 1);
  const w = a.labelSize * 1.6;
  const h = a.labelSize * 1.1;
  return (
    <g className="arc" data-id={a.id}>
      <path d={a.d} fill="none" stroke={color} strokeWidth={a.stroke} strokeLinecap="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={r2(1 - a.p)} markerEnd={a.p >= 0.98 ? `url(#${marker})` : undefined} />
      {labelOpacity > 0 && (
        <g opacity={labelOpacity}>
          {labelBacking && <rect x={a.labelX - w / 2} y={a.labelY - a.labelSize * 0.85} width={w} height={h} rx={h / 2} fill={labelBacking} />}
          <text x={a.labelX} y={a.labelY} fontSize={a.labelSize} fontWeight={800} fill={labelColor} textAnchor="middle">
            {a.label}
          </text>
        </g>
      )}
    </g>
  );
}

/* Characters --------------------------------------------------------- */

function Leo({ x, y, scale, cheer }: { x: number; y: number; scale: number; cheer: boolean }) {
  const skin = '#8d5524';
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} aria-hidden="true">
      <rect x={20} y={118} width={13} height={42} rx={5} fill="#2f4858" />
      <rect x={37} y={118} width={13} height={42} rx={5} fill="#2f4858" />
      <ellipse cx={25} cy={162} rx={11} ry={6} fill="#222" />
      <ellipse cx={45} cy={162} rx={11} ry={6} fill="#222" />
      {cheer ? (
        <>
          <path d="M 17 70 L 5 34" stroke={skin} strokeWidth={10} strokeLinecap="round" />
          <path d="M 53 70 L 65 34" stroke={skin} strokeWidth={10} strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d="M 16 72 L 9 110" stroke={skin} strokeWidth={10} strokeLinecap="round" />
          <path d="M 54 72 L 61 110" stroke={skin} strokeWidth={10} strokeLinecap="round" />
        </>
      )}
      <path d="M 13 66 Q 35 56 57 66 L 58 124 L 12 124 Z" fill="#f4a261" stroke="#c9733a" strokeWidth={2} />
      <rect x={24} y={92} width={22} height={16} rx={4} fill="#e76f51" />
      <circle cx={35} cy={37} r={22} fill={skin} />
      <path d="M 13 33 Q 14 12 35 11 Q 56 12 57 33 Q 50 22 35 24 Q 20 22 13 33 Z" fill="#2b1d14" />
      <path d="M 14 26 Q 16 5 36 5 Q 54 5 56 24 Z" fill="#2a9d8f" />
      <path d="M 50 21 Q 66 21 70 28 L 52 28 Z" fill="#1f7a70" />
      <circle cx={28} cy={39} r={2.6} fill="#1b1b1b" />
      <circle cx={42} cy={39} r={2.6} fill="#1b1b1b" />
      <path d="M 27 47 Q 35 54 43 47" stroke="#1b1b1b" strokeWidth={2.2} fill="none" strokeLinecap="round" />
    </g>
  );
}

function Pip({ x, y, scale, p }: { x: number; y: number; scale: number; p: number }) {
  const e = easeOutCubic(p);
  const dx = (1 - e) * 90;
  const dy = -(1 - e) * 50;
  return (
    <g className="pip" transform={`translate(${r2(x + dx)} ${r2(y + dy)}) scale(${scale})`} opacity={r2(Math.min(1, p * 2))} aria-hidden="true">
      <path d="M 22 56 L 8 80 L 19 77 L 15 92 L 31 62 Z" fill="#2f7fd1" stroke="#1d5a99" strokeWidth={1.5} />
      <ellipse cx={30} cy={42} rx={18} ry={23} fill="#2fb36b" stroke="#1d7a47" strokeWidth={2} />
      <ellipse cx={34} cy={48} rx={10} ry={14} fill="#b8f0c8" />
      <path d="M 18 34 Q 8 50 22 62 Q 30 50 26 36 Z" fill="#1f8f55" />
      <circle cx={32} cy={18} r={14} fill="#2fb36b" stroke="#1d7a47" strokeWidth={2} />
      <path d="M 25 7 Q 22 -5 31 2 Q 33 -7 38 4 Z" fill="#e63946" stroke="#b02a35" strokeWidth={1.2} />
      <circle cx={37} cy={15} r={4.5} fill="#ffffff" />
      <circle cx={38} cy={15} r={2.2} fill="#1b1b1b" />
      <path d="M 44 13 Q 57 15 53 27 Q 49 22 44 23 Z" fill="#ffb703" stroke="#c77d00" strokeWidth={1.5} />
      <path d="M 26 64 l -3 7 M 34 64 l 3 7" stroke="#e76f51" strokeWidth={3} strokeLinecap="round" />
    </g>
  );
}

function tailPoints(r: Rect, t: Point): { poly: string; base: [Point, Point] } {
  let a: Point;
  let b: Point;
  if (t.y > r.y + r.h) {
    const bx = clamp(t.x, r.x + 18, r.x + r.w - 18);
    a = { x: bx - 9, y: r.y + r.h };
    b = { x: bx + 9, y: r.y + r.h };
  } else if (t.y < r.y) {
    const bx = clamp(t.x, r.x + 18, r.x + r.w - 18);
    a = { x: bx - 9, y: r.y };
    b = { x: bx + 9, y: r.y };
  } else if (t.x > r.x + r.w) {
    const by = clamp(t.y, r.y + 10, r.y + r.h - 10);
    a = { x: r.x + r.w, y: by - 7 };
    b = { x: r.x + r.w, y: by + 7 };
  } else {
    const by = clamp(t.y, r.y + 10, r.y + r.h - 10);
    a = { x: r.x, y: by - 7 };
    b = { x: r.x, y: by + 7 };
  }
  return { poly: `${a.x},${a.y} ${t.x},${t.y} ${b.x},${b.y}`, base: [a, b] };
}

function Bubble({ bubble: b }: { bubble: BubbleFrame }) {
  const R = b.rect;
  const { poly, base } = tailPoints(R, b.tail);
  const lineH = b.size * 1.22;
  const top = R.y + (R.h - b.lines.length * lineH) / 2;
  const cx = R.x + R.w / 2;
  const cy = R.y + R.h / 2;
  return (
    <g className="bubble" opacity={b.p} transform={popAbout(cx, cy, b.p)}>
      <rect x={R.x} y={R.y} width={R.w} height={R.h} rx={12} fill="#ffffff" stroke="#17324d" strokeWidth={2} />
      <polygon points={poly} fill="#ffffff" stroke="#17324d" strokeWidth={2} strokeLinejoin="round" />
      <line x1={base[0].x} y1={base[0].y} x2={base[1].x} y2={base[1].y} stroke="#ffffff" strokeWidth={3.5} />
      {b.lines.map((line, k) => (
        <text key={k} x={cx} y={top + (k + 0.8) * lineH} fontSize={b.size} fontWeight={k === 0 ? 800 : 700} fill="#17324d" textAnchor="middle">
          {line}
        </text>
      ))}
    </g>
  );
}

/* Sticker sheets ----------------------------------------------------- */

function Sheet({ sheet: s }: { sheet: SheetFrame }) {
  const e = easeOutCubic(s.p);
  const R = s.rect;
  return (
    <g className="sheet" data-id={s.id} opacity={r2(Math.min(1, s.p * 1.5))} transform={`translate(0 ${r2((1 - e) * 18)})`}>
      <text x={R.x + R.w / 2} y={s.labelY} fontSize={s.labelSize} fontWeight={700} fill="#3a2e6b" textAnchor="middle">
        {s.label}
      </text>
      <rect x={R.x} y={R.y} width={R.w} height={R.h} rx={8} fill="#f3efff" stroke="#6c5ce7" strokeWidth={2.5} />
      {s.stars.map((st) => (
        <path key={st.id} d={st.d} fill="#ffc83d" stroke="#a86b00" strokeWidth={1.5} strokeLinejoin="round" />
      ))}
    </g>
  );
}

function Confetti({ frame }: { frame: Frame }) {
  const colors = ['#ff6b6b', '#ffd166', '#06d6a0', '#118ab2', '#9b5de5'];
  const e = easeOutCubic(frame.finale);
  const r = frame.layout.name === 'narrow' ? 4 : 6;
  return (
    <g aria-hidden="true" opacity={frame.finale}>
      {frame.confetti.map((c, k) => (
        <circle key={k} cx={c.x} cy={r2(c.y - (1 - e) * 20)} r={r} fill={colors[k % colors.length]} />
      ))}
    </g>
  );
}

/* Focus marks (one focus at a time; dashed outline = non-color cue) --- */

function FocusMarks({ frame }: { frame: Frame }) {
  const f = frame.focus!;
  const stroke = f.onBoard ? '#ffe066' : '#d97706';
  return (
    <g className="focus" opacity={f.p} data-focus="on" pointerEvents="none">
      {f.rects.map((r, k) => (
        <rect key={k} x={r.x} y={r.y} width={r.w} height={r.h} rx={10} fill="none" stroke={stroke} strokeWidth={3.5} strokeDasharray="10 7" />
      ))}
      {f.circles.map((c, k) => (
        <g key={`c${k}`}>
          <circle cx={c.x} cy={c.y} r={c.r} fill="#fff7e0" stroke={stroke} strokeWidth={3} strokeDasharray="5 4" />
          <text x={c.x} y={c.y + c.r * 0.42} fontSize={c.r * 1.2} fontWeight={800} textAnchor="middle" fill="#8a4b00">
            {c.label}
          </text>
        </g>
      ))}
    </g>
  );
}
