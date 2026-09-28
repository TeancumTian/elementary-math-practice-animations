# Crates of Five: an MP.8 Math Story for Grade 3

**Crates of Five** is an interactive math animation for Grade 3 (ages about 6–9) about
**MP.8: Look for and express regularity in repeated reasoning**. MP.8 is a cross-grade
mathematical practice, not an extra grade-level content standard.

Leo packs apple crates at Grandma June's stand, and every crate holds exactly 5 apples.
Learners build 1, 2, 3, and 4 crates and record 5, 10, 15, and 20. Then they:

- notice the repeated +5 and predict the next total,
- connect the pattern to *crates × 5* and explain why it holds (equal groups),
- check Pip the parrot's wrong guess of 24 against the crates themselves,
- keep checking intermediate results (6 crates), and
- solve one fresh transfer problem: 7 sticker sheets with 5 stars on each.

The stack is Next.js (App Router), React, TypeScript, and inline SVG. There is no backend,
API key, paid service, or external asset, and all fonts come from the device.

## Requirements

| Tool | Version used | Notes |
| --- | --- | --- |
| Node.js | 22.12.0 | Next 16 needs Node ≥ 20.9 |
| npm | 10.9.0 | pnpm or bun also work |
| Chromium for Playwright | build 1243 | Needed only for `npm run test:e2e` |

### Dependencies (from `package.json`)

- Runtime: `next` 16.3.6, `react` 19.3.0, `react-dom` 19.3.0
- Dev: `typescript` 7.0.2, `vitest` 5.0.2, `@playwright/test` 1.63.0, `@types/react`,
  `@types/react-dom`, `@types/node`

TypeScript 7 works with Next 16.3.6: `next build` type-checks with it and correctly
reports type errors (checked during setup), so the version is not pinned lower.

## Setup and run

```bash
npm install
```

```bash
npm run dev
```

Open <http://localhost:3115>. Port 3115 is fixed in `package.json`.

For a production build:

```bash
npm run build
```

```bash
npm start
```

## Tests

Unit tests (math model, lesson script, answer-leak rules, and the playback state machine):

```bash
npm test
```

End-to-end tests in Chromium, at desktop 1280×800 and mobile 390×844 with touch.
Playwright runs `npm run build && npm run start` on port 3115 by itself. If a dev server is
already on 3115, Playwright reuses it, so stop it first to test the production build.

```bash
npx playwright install chromium
```

```bash
npm run test:e2e
```

To regenerate only the state screenshots in `screenshots/`:

```bash
npm run screenshots
```

To type-check without building:

```bash
npm run typecheck
```

## Using the lesson

- **Start the story** begins Chapter 1. **Pause/Resume**, **Back**, **Replay chapter**, and
  **Next** sit under the stage. Next turns solid blue when the lesson is waiting for the learner.
- The lesson waits for the learner at every question and at every "Pack crate N" step.
  The Next button names the action ("Pack crate 3", "Continue", "Next chapter").
- Chapter buttons (1–5) jump to any chapter. Each chapter starts fresh, with its questions reset.
- **Start over** returns to the title screen and clears all answers.
- **Reduce motion** follows the system `prefers-reduced-motion` setting and can be toggled.
  When it is on, every beat shows its final state immediately, with no movement.
- **Captions** can be hidden visually. The caption stays in a polite live region for screen readers.

| Key | Action |
| --- | --- |
| Space or K | Pause / resume (when a button is not focused) |
| N or → | Next step or action |
| B or ← | Back one step |
| R | Replay this chapter |
| Tab / Enter | Move between controls / check an answer |

A test-only URL parameter, `?speed=20`, speeds up the playback clock. Learners never need it.

## Lesson outline (about 2 min 53 s of playback without learner pauses)

| # | Chapter | Predict → Watch → Explain → Try |
| --- | --- | --- |
| 1 | Pack the Crates | Learners predict how the total will change, pack crates 1–4 (counting on), and record 5, 10, 15, 20 |
| 2 | Spot the Repeat | +5 jumps are drawn between the totals. **Question:** the total after crate 5 |
| 3 | Why Times Five? | 1 × 5 … 4 × 5 built from the crates, then the rule *Total = crates × 5*, then why a few examples alone don't prove a pattern |
| 4 | Check Pip's Guess | Pip proposes 24. **Question:** is 24 right, and why? Crate 5 is packed: the count stops at 24 with an empty spot, then reaches 25. **Question:** the total after 6 crates. Check: totals end in 0 or 5 |
| 5 | Your Turn | **Transfer question:** 7 sticker sheets × 5 stars. Count by 5s, check with the rule, and check reasonableness |

The UI labels the "animate" phase **Watch**, which is friendlier for young readers.

## Project structure

```
app/
  layout.tsx, page.tsx, globals.css   Next.js App Router shell and styles
src/model/repeatedReasoning.ts        THE math model: quantities, labels, layout coordinates, answer checks
src/lesson/script.ts                  Chapters and beats (captions and questions composed from the model)
src/lesson/frame.ts                   Pure (beat, time, layout, reducedMotion) → frame for the SVG
src/lesson/player.ts                  Pure playback reducer (start/pause/next/back/replay/answers/reset)
src/components/Lesson.tsx             Page UI, clock, keyboard, layout detection, reduced motion
src/components/Stage.tsx              SVG renderer (crates, apples, chalkboard, Pip, Leo, sticker sheets)
src/components/QuestionPanel.tsx      Number and choice questions, keypad, feedback, reveal
src/**/*.test.ts                      Vitest unit tests
e2e/*.spec.ts                         Playwright tests and screenshot capture
screenshots/                          Captured initial, intermediate, and final states
VERIFICATION.md                       Math and visual verification report
```

### Design notes

- **One deterministic model.** `repeatedReasoning.ts` builds totals by adding one equal group
  at a time. The rule `groups × size` is a separate function, and unit tests prove the two
  agree. Captions, table cells, counters, SVG coordinates for both layouts, feedback messages,
  and answer checks all call this module.
- **Animation as a pure function.** Each beat declares its end state plus a timeline. A frame
  is computed from `(beat, elapsed ms, layout, reducedMotion)`, so pause is exact, replay is
  identical, and reduced motion is the end state of the same frame. Objects keep stable ids
  (`crate-3`, `apple-3-5`).
- **No answer leaks.** Elements that have not appeared yet are left out of the DOM, not just
  made transparent. The SVG's accessible description is built from the visible frame. Wrong-answer
  feedback never states the correct total, and choice options carry no correctness markers.
  Unit tests and e2e tests check all three.
- **Two SVG layouts.** The model provides a wide 800×490 layout and a narrow 360×468 layout.
  The narrow one is chosen when the stage is under 560 px wide, so labels stay at least
  about 13 px on phones.

`AGENTS.md` and `CLAUDE.md` were generated by `next dev`. They point coding agents to the
bundled Next 16 docs and are not part of the app.
