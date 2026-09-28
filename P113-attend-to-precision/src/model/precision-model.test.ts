import { describe, expect, it } from 'vitest';
import {
  CHAPTERS,
  CORRECT_SCALE,
  FAULTY_SCALE,
  FRUITS,
  GRAPH,
  PENCIL,
  PENCIL_RULER,
  QUESTIONS,
  QUESTION_IDS,
  RIBBON_MESSAGES,
  RIBBON_RULER,
  SCENES,
  STICKER_MESSAGES,
  TOTAL_ANIMATION_MS,
  UNIT_FAULTY_CLAIM,
  UNIT_FAULTY_MESSAGE,
  UNIT_REPAIRED_MESSAGE,
  barTopY,
  barsMatchScale,
  chainLinks,
  checkAnswer,
  cmToX,
  correctLetter,
  cueAt,
  describeScene,
  displayedTickLabel,
  evaluateClaim,
  findScaleGap,
  formatChain,
  formatLength,
  formatSteps,
  gridY,
  hasLengthUnit,
  isChainTrue,
  isPreciseLength,
  measureOnRuler,
  readBar,
  reducedMotionTime,
  rulerTicks,
  sceneState,
  scaleStep,
  unitTokenTarget,
  valueOf,
  visualTime,
  type SceneId,
  type SceneState,
} from './precision-model';

const SCENE_IDS = Object.keys(SCENES) as SceneId[];

describe('concrete verification case: 8 + 2 = 10 + 3 = 13', () => {
  it('8 + 2 equals 10', () => {
    expect(valueOf([8, 2])).toBe(10);
  });

  it('10 + 3 equals 13', () => {
    expect(valueOf([10, 3])).toBe(13);
  });

  it('the original chain is exactly "8 + 2 = 10 + 3 = 13" and it is false', () => {
    expect(formatChain(STICKER_MESSAGES.faultyChain)).toBe('8 + 2 = 10 + 3 = 13');
    expect(isChainTrue(STICKER_MESSAGES.faultyChain)).toBe(false);
    const [first, second] = chainLinks(STICKER_MESSAGES.faultyChain);
    // The first equal sign claims 8 + 2 = 10 + 3, i.e. 10 = 13: false.
    expect(first).toMatchObject({ leftValue: 10, rightValue: 13, holds: false });
    expect(second).toMatchObject({ leftValue: 13, rightValue: 13, holds: true });
  });

  it('the rebuilt message is "8 + 2 = 10, then 10 + 3 = 13" and both equations are true', () => {
    expect(formatSteps(STICKER_MESSAGES.repaired)).toBe('8 + 2 = 10, then 10 + 3 = 13');
    expect(STICKER_MESSAGES.repaired.every(isChainTrue)).toBe(true);
    expect(STICKER_MESSAGES.mid).toBe(10);
    expect(STICKER_MESSAGES.total).toBe(13);
  });

  it('the balance tips for the false link and is level for both true equations', () => {
    const tipped = sceneState('repair-equal', 9000);
    if (tipped.kind !== 'equation') throw new Error('wrong scene kind');
    expect(tipped.balance.left.total).toBe(10);
    expect(tipped.balance.right.total).toBe(13);
    expect(tipped.balance.angle).toBeGreaterThan(0); // right side (13) goes down
    expect(tipped.balance.relation?.symbol).toBe('≠');

    const line1 = sceneState('repair-equal', 18000);
    const end = sceneState('repair-equal', SCENES['repair-equal'].duration);
    if (line1.kind !== 'equation' || end.kind !== 'equation') throw new Error('wrong scene kind');
    expect([line1.balance.left.label, line1.balance.right.label]).toEqual(['8 + 2', '10']);
    expect(line1.balance.angle).toBeCloseTo(0, 6);
    expect([end.balance.left.label, end.balance.right.label]).toEqual(['10 + 3', '13']);
    expect(end.balance.angle).toBe(0);
    expect(end.balance.relation?.symbol).toBe('=');
  });

  it('the repaired card shows two lines whose equal signs line up', () => {
    const end = sceneState('repair-equal', SCENES['repair-equal'].duration);
    if (end.kind !== 'equation') throw new Error('wrong scene kind');
    const eq1 = end.card.tokens.find((t) => t.id === 'tok-eq1')!;
    const eq2 = end.card.tokens.find((t) => t.id === 'tok-eq2')!;
    expect(eq1.x).toBeCloseTo(eq2.x, 6);
    expect(eq1.y).toBeLessThan(eq2.y);
    expect(describeScene(end)).toContain('8 + 2 = 10 / 10 + 3 = 13');
  });
});

describe('concrete verification case: a 7-cm length requires a length unit', () => {
  it('Leo’s pencil is 7 cm long and the broken message has no unit', () => {
    expect(PENCIL.lengthCm).toBe(7);
    expect(UNIT_FAULTY_MESSAGE).toBe('My pencil is 7 long.');
    expect(hasLengthUnit(UNIT_FAULTY_CLAIM)).toBe(false);
    expect(isPreciseLength(UNIT_FAULTY_CLAIM, 7)).toBe(false);
  });

  it('only "7 cm" is precise: not "7", not "7 inches", not "8 cm"', () => {
    expect(isPreciseLength({ value: 7, unit: 'cm' }, 7)).toBe(true);
    expect(isPreciseLength({ value: 7, unit: null }, 7)).toBe(false);
    expect(isPreciseLength({ value: 7, unit: 'inch' }, 7)).toBe(false);
    expect(isPreciseLength({ value: 8, unit: 'cm' }, 7)).toBe(false);
    expect(formatLength(7)).toBe('7 cm');
    expect(UNIT_REPAIRED_MESSAGE).toBe('My pencil is 7 cm long.');
  });

  it('the pencil drawn on the ruler measures exactly 7 cm and 7 spaces are counted', () => {
    const end = sceneState('repair-unit', SCENES['repair-unit'].duration);
    if (end.kind !== 'ruler') throw new Error('wrong scene kind');
    expect(end.item.leftX).toBe(cmToX(PENCIL_RULER, 0));
    expect(measureOnRuler(end.ruler, end.item.leftX, end.item.leftX + end.item.widthPx)).toBe(7);
    expect(end.hops.map((h) => h.index)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    for (const hop of end.hops) expect(hop.toX - hop.fromX).toBe(PENCIL_RULER.pxPerCm);
  });

  it('the cm token lands in the message slot and the repaired card reads "My pencil is 7 cm long."', () => {
    const end = sceneState('repair-unit', SCENES['repair-unit'].duration);
    if (end.kind !== 'ruler') throw new Error('wrong scene kind');
    const unit = end.card.tokens.find((t) => t.id === 'msg-unit')!;
    expect(unit.x).toBeCloseTo(unitTokenTarget().x, 6);
    expect(unit.y).toBeCloseTo(unitTokenTarget().y, 6);
    expect(describeScene(end)).toContain('Message: “My pencil is 7 cm long.”');
    expect(describeScene(end)).toContain('Stamp: REPAIRED.');
  });

  it('ruler labels are whole centimeters 0..max, evenly spaced', () => {
    for (const r of [PENCIL_RULER, RIBBON_RULER]) {
      const whole = rulerTicks(r).filter((t) => t.whole);
      expect(whole.map((t) => t.label)).toEqual(Array.from({ length: r.maxCm + 1 }, (_, i) => String(i)));
      whole.forEach((t, i) => expect(t.x).toBe(r.x0 + i * r.pxPerCm));
    }
  });
});

describe('concrete verification case: graph values match the labeled scale', () => {
  it('the repaired scale counts by 1 student from 0 with no gaps', () => {
    expect(CORRECT_SCALE).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(scaleStep(CORRECT_SCALE)).toBe(1);
    expect(findScaleGap(CORRECT_SCALE)).toBeNull();
  });

  it('every bar top sits on the gridline labeled with its tally count', () => {
    for (const f of FRUITS) {
      expect(readBar(f.count, CORRECT_SCALE)).toBe(f.count);
      expect(barTopY(f.count)).toBe(gridY(CORRECT_SCALE.indexOf(f.count)));
    }
    expect(barsMatchScale(CORRECT_SCALE)).toBe(true);
  });

  it('the broken axis 0, 1, 2, 3, 5, 6, 7, 8 skips 4 and misreads bars above 3', () => {
    expect(FAULTY_SCALE).toEqual([0, 1, 2, 3, 5, 6, 7, 8]);
    expect(findScaleGap(FAULTY_SCALE)).toEqual({ index: 4, after: 3, shown: 5, missing: 4 });
    expect(readBar(5, FAULTY_SCALE)).toBe(6); // apples
    expect(readBar(6, FAULTY_SCALE)).toBe(7); // grapes
    expect(readBar(3, FAULTY_SCALE)).toBe(3); // bananas unaffected
    expect(readBar(2, FAULTY_SCALE)).toBe(2); // pears unaffected
    expect(barsMatchScale(FAULTY_SCALE)).toBe(false);
  });

  it('look scene shows the faulty labels; repaired scene shows the correct labels; bars never move', () => {
    const look = sceneState('look-axis', SCENES['look-axis'].duration);
    const fixed = sceneState('repair-axis', SCENES['repair-axis'].duration);
    if (look.kind !== 'graph' || fixed.kind !== 'graph') throw new Error('wrong scene kind');
    expect(look.ticks.map(displayedTickLabel)).toEqual([...FAULTY_SCALE]);
    expect(fixed.ticks.map(displayedTickLabel)).toEqual([...CORRECT_SCALE]);
    expect(look.bars.map((b) => b.topY)).toEqual(fixed.bars.map((b) => b.topY));
    for (const bar of fixed.bars) {
      const tick = fixed.ticks.find((t) => t.y === bar.topY)!;
      expect(displayedTickLabel(tick)).toBe(bar.count);
    }
    expect(GRAPH.yAxisTitle).toBe('Number of students');
  });
});

describe('transfer arithmetic (fresh problem)', () => {
  it('9 + 1 = 10, then 10 + 4 = 14; the run-on chain is false; ribbon measures 14 cm', () => {
    expect(formatSteps(RIBBON_MESSAGES.repaired)).toBe('9 + 1 = 10, then 10 + 4 = 14');
    expect(RIBBON_MESSAGES.repaired.every(isChainTrue)).toBe(true);
    expect(isChainTrue(RIBBON_MESSAGES.faultyChain)).toBe(false);
    const end = sceneState('reveal-transfer', SCENES['reveal-transfer'].duration);
    if (end.kind !== 'transfer') throw new Error('wrong scene kind');
    const last = end.pieces[end.pieces.length - 1];
    expect(measureOnRuler(RIBBON_RULER, end.pieces[0].leftX, last.leftX + last.widthPx)).toBe(14);
    expect(end.bracket.label).toBe('14 cm');
  });
});

describe('answer checks come only from the model', () => {
  it.each(QUESTION_IDS)('%s has exactly one precise option, unique letters, and specific feedback', (id) => {
    const q = QUESTIONS[id];
    const letters = q.options.map((o) => o.letter);
    expect(new Set(letters).size).toBe(letters.length);
    expect(q.options.filter((o) => evaluateClaim(o.claim))).toHaveLength(1);
    const right = correctLetter(id);
    expect(checkAnswer(id, right)).toEqual({ correct: true, feedback: q.success });
    const wrong = q.options.filter((o) => o.letter !== right);
    for (const o of wrong) {
      const res = checkAnswer(id, o.letter);
      expect(res.correct).toBe(false);
      expect(res.feedback.length).toBeGreaterThan(20);
      expect(res.feedback).not.toBe(q.success);
      expect(o.flaw.length).toBeGreaterThan(0);
    }
    expect(new Set(wrong.map((o) => o.feedback)).size).toBe(wrong.length);
    expect(new Set(q.options.map((o) => o.text)).size).toBe(q.options.length);
  });

  it('the correct letter is not always in the same position', () => {
    const letters = new Set(QUESTION_IDS.map(correctLetter));
    expect(letters.size).toBeGreaterThanOrEqual(3);
  });

  it('distractors target real precision errors (unit, lines vs spaces, broken axis, false chain)', () => {
    const texts = (id: keyof typeof QUESTIONS) => QUESTIONS[id].options.map((o) => o.text);
    expect(texts('try-unit')).toEqual(
      expect.arrayContaining(['The eraser is 4 long.', 'The eraser is 5 cm long.', 'The eraser is 4 inches long.', 'The eraser is 4 cm long.']),
    );
    expect(texts('try-axis')).toEqual(expect.arrayContaining(['6 students chose grapes.', '7 students chose grapes.']));
    expect(texts('try-equal')).toEqual(expect.arrayContaining(['7 + 3 = 10 + 5 = 15', '7 + 3 = 10, then 10 + 5 = 15']));
    expect(texts('transfer')).toEqual(
      expect.arrayContaining([
        '9 + 1 = 10, then 10 + 4 = 14. The ribbon is 14 cm long.',
        '9 + 1 = 10, then 10 + 4 = 14. The ribbon is 14 long.',
        '9 + 1 = 10 + 4 = 14. The ribbon is 14 cm long.',
      ]),
    );
  });

  it('style and speed distractors are never correct', () => {
    for (const id of QUESTION_IDS) {
      for (const o of QUESTIONS[id].options) {
        if (/neat|tidier|fancier|faster|colors/i.test(o.text)) expect(evaluateClaim(o.claim)).toBe(false);
      }
    }
  });
});

describe('no answer leaks in text shown before submission', () => {
  for (const chapter of CHAPTERS) {
    chapter.steps.forEach((step, stepIndex) => {
      if (step.kind !== 'question') return;
      const q = QUESTIONS[step.question];
      it(`${q.id}: prompt, picture description, and earlier captions do not reveal the answer`, () => {
        const correct = q.options.find((o) => o.letter === correctLetter(q.id))!;
        const visual = sceneState(q.visual.scene, visualTime(q.visual));
        const earlierCaptions = chapter.steps
          .slice(0, stepIndex)
          .flatMap((s) => (s.kind === 'scene' ? SCENES[s.scene].cues.map((c) => c.text) : []));
        const visibleBefore = [q.prompt, describeScene(visual), SCENES[q.visual.scene].name, ...earlierCaptions];
        for (const text of visibleBefore) {
          expect(text).not.toContain(correct.text);
          expect(text).not.toContain(q.success);
        }
        // Feedback for a wrong choice corrects it without handing over the right option.
        for (const o of q.options.filter((opt) => opt !== correct)) {
          expect(o.feedback).not.toContain(correct.text);
          expect(o.feedback).not.toContain(q.success);
        }
      });
    });
  }
});

describe('timeline and animation model', () => {
  it('total animation without learner pauses is between 2 and 4 minutes', () => {
    expect(TOTAL_ANIMATION_MS).toBeGreaterThanOrEqual(120_000);
    expect(TOTAL_ANIMATION_MS).toBeLessThanOrEqual(240_000);
  });

  it.each(SCENE_IDS)('%s cues are contiguous and cover the whole scene', (id) => {
    const spec = SCENES[id];
    if (spec.duration === 0) return expect(spec.cues).toHaveLength(0);
    expect(spec.cues[0].start).toBe(0);
    expect(spec.cues[spec.cues.length - 1].end).toBe(spec.duration);
    spec.cues.forEach((c, i) => {
      expect(c.end).toBeGreaterThan(c.start);
      if (i > 0) expect(c.start).toBe(spec.cues[i - 1].end);
    });
    expect(cueAt(id, spec.duration)?.id).toBe(spec.cues[spec.cues.length - 1].id);
  });

  it.each(SCENE_IDS)('%s is deterministic and keeps stable object identities over time', (id) => {
    const duration = SCENES[id].duration;
    const ids = (s: SceneState): string[] => {
      switch (s.kind) {
        case 'intro':
          return [...s.jobCards.map((c) => c.id), ...s.checklist.map((c) => c.id)];
        case 'ruler':
          return [...s.card.tokens.map((t) => t.id), ...s.hops.map((h) => h.id), ...s.guides.map((g) => g.id), s.item.id];
        case 'graph':
          return [...s.ticks.map((t) => t.id), ...s.bars.map((b) => b.id), ...s.tally.map((r) => r.fruitId)];
        case 'equation':
          return [...s.card.tokens.map((t) => t.id), ...s.groups.map((g) => g.id), ...s.lineChecks.map((c) => c.id)];
        case 'transfer':
          return [...s.pieces.map((p) => p.id), ...s.lines.map((l) => l.id)];
        case 'finale':
          return s.rows.map((r) => r.id);
      }
    };
    const first = ids(sceneState(id, 0));
    for (let t = 0; t <= duration; t += 250) {
      expect(ids(sceneState(id, t))).toEqual(first);
      expect(sceneState(id, t)).toEqual(sceneState(id, t));
    }
  });

  it('reduced motion shows the finished picture of the current caption', () => {
    expect(reducedMotionTime('repair-unit', 100)).toBe(SCENES['repair-unit'].cues[0].end);
    expect(reducedMotionTime('repair-unit', 5000)).toBe(SCENES['repair-unit'].cues[1].end);
    const quantized = sceneState('repair-unit', reducedMotionTime('repair-unit', 4100));
    if (quantized.kind !== 'ruler') throw new Error('wrong scene kind');
    expect(quantized.hops.every((h) => h.opacity === 1)).toBe(true);
  });

  it('every faulty display is stamped NEEDS REPAIR before its question and REPAIRED right after', () => {
    const pairs: [SceneId, SceneId][] = [
      ['look-unit', 'repair-unit'],
      ['look-axis', 'repair-axis'],
      ['look-equal', 'repair-equal'],
    ];
    for (const [look, repair] of pairs) {
      const before = describeScene(sceneState(look, SCENES[look].duration));
      const after = describeScene(sceneState(repair, SCENES[repair].duration));
      expect(before).toContain('Stamp: NEEDS REPAIR.');
      expect(after).toContain('Stamp: REPAIRED.');
      expect(describeScene(sceneState(repair, 0))).toContain('Stamp: NEEDS REPAIR.');
    }
  });
});
