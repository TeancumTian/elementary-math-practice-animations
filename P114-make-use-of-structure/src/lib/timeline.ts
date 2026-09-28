/**
 * timeline.ts — pure timing helpers for scene playback.
 * Scenes are lists of beats; playback position is a single number (elapsed ms),
 * so pause, resume, replay, and navigation never leave stray timers behind.
 */

export type VisualId = "main" | "transfer" | "array";
export type Focus = "ones" | "tens" | "rowA" | "rowB" | "newTen" | "rows" | "columns";

export interface Overlay {
  /** Only one thing is emphasized at a time. */
  focus?: Focus;
  /** Whether totals may be shown. False before the matching question is answered. */
  reveal: boolean;
  /** Count-by-tens labels: hidden, appearing one at a time, or all shown. */
  counts?: "none" | "progressive" | "all";
  /** Show the finished equation in place of the footer. */
  equation?: boolean;
}

export interface Beat {
  id: string;
  visual: VisualId;
  stage: string;
  /** Stage to move from on the first beat of a scene. */
  from?: string;
  caption: string;
  durationMs: number;
  /** How long objects take to move into this beat's stage. */
  moveMs: number;
  /** Extra delay per object, in march order (robots). */
  staggerMs: number;
  overlay: Overlay;
}

export const MIN_BEAT_MS = 3800;
export const MAX_BEAT_MS = 8500;
export const DEFAULT_MOVE_MS = 1100;

/** Enough time to read the caption aloud at a child-friendly pace. */
export function readingTimeMs(caption: string): number {
  const words = caption.trim().split(/\s+/).filter(Boolean).length;
  return Math.min(MAX_BEAT_MS, Math.max(MIN_BEAT_MS, 1500 + words * 290));
}

export function sceneDuration(beats: readonly Beat[]): number {
  return beats.reduce((t, b) => t + b.durationMs, 0);
}

export interface BeatLocation {
  index: number;
  beatElapsed: number;
  finished: boolean;
}

export function locateBeat(beats: readonly Beat[], elapsed: number): BeatLocation {
  if (beats.length === 0) return { index: 0, beatElapsed: 0, finished: true };
  const total = sceneDuration(beats);
  const t = Math.max(0, Math.min(elapsed, total));
  let start = 0;
  for (let i = 0; i < beats.length; i++) {
    const end = start + beats[i].durationMs;
    if (t < end || i === beats.length - 1) {
      return { index: i, beatElapsed: t - start, finished: t >= total };
    }
    start = end;
  }
  /* c8 ignore next */
  return { index: beats.length - 1, beatElapsed: beats[beats.length - 1].durationMs, finished: true };
}

/** Elapsed time at which beat `index` begins. */
export function beatStart(beats: readonly Beat[], index: number): number {
  return beats.slice(0, index).reduce((t, b) => t + b.durationMs, 0);
}

/** The stage objects move FROM during beat i. */
export function beatFromStage(beats: readonly Beat[], i: number): string {
  const beat = beats[i];
  if (i === 0) return beat.from ?? beat.stage;
  const prev = beats[i - 1];
  return prev.visual === beat.visual ? prev.stage : beat.stage;
}

export function easeInOutCubic(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/** Eased movement progress (0..1) for one object. Reduced motion jumps straight to the end. */
export function moveProgress(beatElapsed: number, moveMs: number, delayMs: number, reducedMotion: boolean): number {
  if (reducedMotion || moveMs <= 0) return 1;
  return easeInOutCubic((beatElapsed - delayMs) / moveMs);
}

/** How many count-by-tens labels are visible while counting (1..n across 80% of the beat). */
export function progressiveCount(beatElapsed: number, durationMs: number, n: number): number {
  if (n <= 0) return 0;
  const window = durationMs * 0.8;
  return Math.max(1, Math.min(n, Math.floor((beatElapsed / window) * n) + 1));
}
