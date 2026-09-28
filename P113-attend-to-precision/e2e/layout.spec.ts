import { expect, test, type Page } from '@playwright/test';
import { CHAPTERS, SCENES } from '../src/model/precision-model';
import { goToStep, openApp } from './helpers';

interface LayoutReport {
  overflowX: number;
  minFontPx: number;
  overlaps: string[];
  clipped: string[];
}

/** Checks the page for sideways scrolling, tiny SVG text, overlapping SVG labels, and labels outside the picture. */
async function inspect(page: Page): Promise<LayoutReport> {
  return page.evaluate(() => {
    const svg = document.querySelector<SVGSVGElement>('svg.stage-svg')!;
    const box = svg.getBoundingClientRect();
    const scale = Math.min(box.width / svg.viewBox.baseVal.width, box.height / svg.viewBox.baseVal.height);
    const opacityOf = (el: Element | null): number => {
      let o = 1;
      for (let e = el; e && e !== svg; e = e.parentElement) o *= Number(e.getAttribute('opacity') ?? '1');
      return o;
    };
    const texts = [...svg.querySelectorAll('text')].filter((t) => opacityOf(t) > 0.6 && (t.textContent ?? '').trim());
    const rects = texts.map((t) => ({ t: (t.textContent ?? '').trim(), r: t.getBoundingClientRect() }));
    const overlaps: string[] = [];
    for (let i = 0; i < rects.length; i += 1) {
      for (let j = i + 1; j < rects.length; j += 1) {
        const a = rects[i].r;
        const b = rects[j].r;
        const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        // Glyph boxes include line spacing, so allow a small touch (a quarter of the smaller box).
        if (w > 2 && h > 0.25 * Math.min(a.height, b.height)) overlaps.push(`"${rects[i].t}" × "${rects[j].t}"`);
      }
    }
    const clipped = rects
      .filter(({ r }) => r.left < box.left - 1 || r.right > box.right + 1 || r.top < box.top - 1 || r.bottom > box.bottom + 1)
      .map(({ t }) => t);
    const minFontPx = Math.min(...texts.map((t) => Number(t.getAttribute('font-size') ?? '16') * scale));
    return {
      overflowX: document.documentElement.scrollWidth - window.innerWidth,
      minFontPx,
      overlaps,
      clipped,
    };
  });
}

test('every step: no sideways scroll, readable SVG labels, no overlapping or clipped labels', async ({ page }) => {
  test.setTimeout(180_000);
  await page.clock.install();
  await openApp(page);
  const initial = await inspect(page);
  expect(initial.overflowX).toBeLessThanOrEqual(0);
  expect(initial.overlaps).toEqual([]);

  for (const [c, chapter] of CHAPTERS.entries()) {
    for (const [s, step] of chapter.steps.entries()) {
      await goToStep(page, c, s);
      if (step.kind === 'scene') await page.clock.runFor(SCENES[step.scene].duration + 200);
      const where = `${chapter.id} step ${s} (${step.kind === 'scene' ? step.scene : step.question})`;
      const report = await inspect(page);
      expect(report.overflowX, where).toBeLessThanOrEqual(0);
      expect(report.minFontPx, where).toBeGreaterThanOrEqual(12);
      expect(report.overlaps, where).toEqual([]);
      expect(report.clipped, where).toEqual([]);
    }
  }
});
