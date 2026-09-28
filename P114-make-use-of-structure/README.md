# Look for Structure! · Snap-Cube Robots

An interactive math animation for **MP.7, Look for and make use of structure** (Grades 1–3, ages 6–9).
Juno and Remy put their snap cubes together. **48 + 32**: 8 ones and 2 ones snap into a new ten, so the tens combine to **80**.
An optional **Grade 3 bonus** shows 12 robots in a 3-by-4 array, grouped as equal rows (4 + 4 + 4) and then as equal columns (3 + 3 + 3 + 3). Both groupings give the same count.

The app is built with Next.js (App Router), React, TypeScript, and inline SVG. It needs no backend, API key, paid service, or external asset. Fonts are system fonts and every picture is drawn in code.

## Requirements

- Node.js ≥ 20.9 (tested with 22.12.0), npm 10
- For end-to-end tests: Playwright's Chromium (`npx playwright install chromium` if it isn't already cached)

| Package | Version | Role |
| --- | --- | --- |
| next | 16.3.6 | App framework (Turbopack build) |
| react / react-dom | 19.3.0 | UI |
| typescript | 7.0.2 | Types. Next 16.3.6 builds and type-checks correctly with TS 7, and a deliberate type error does fail `next build`. |
| @types/react, @types/react-dom, @types/node | 19.3.0 / 19.3.0 / 22.x | Type definitions |
| vitest | 5.0.2 | Unit tests (pure model, lesson script, reducer) |
| @playwright/test | 1.63.0 | End-to-end tests and screenshots (Chromium) |

## Setup and run

```bash
npm install
```

```bash
npm run dev
```

The dev server runs at **http://localhost:3114**. To run a production build:

```bash
npm run build
```

```bash
npm run start
```

This also serves at http://localhost:3114.

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server on port 3114 |
| `npm run build` | Production build (includes type-checking) |
| `npm run start` | Serve the production build on port 3114 |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit tests (`tests/unit`) |
| `npm run test:e2e` | Playwright tests (`e2e/`). Builds and starts the app on port 3114 first. If a server is already listening on 3114 it is reused, so stop `npm run dev` if you want the tests to run against a fresh production build. The run also writes screenshots to `screenshots/`. |

The optional `?speed=N` URL parameter (1–20) plays animations N× faster. It's meant for previews and automated tests, for example http://localhost:3114/?speed=4.

## How the lesson works

About **2 min 54 s** of animation with the bonus, and about 2 min 16 s without it. The learner answers at their own pace and every question waits.

| # | Chapter | Move | What happens |
| - | --- | --- | --- |
| 1 | Meet the Cubes | Story | A jumble of cubes snaps into place-value groups: 48 = 4 tens 8 ones, 32 = 3 tens 2 ones. |
| 2 | Predict | Predict | "What can 8 loose cubes and 2 loose cubes make?" then "48 + 32 = ?" |
| 3 | Snap a Ten | Watch | The ones slide into a ten-frame (8 + 2 = 10), snap into a new ten, and move to the tens place. The tens combine (4 + 3 + 1 = 8 tens), and you count by tens to 80. The footer shows that the cube count never changes. |
| 4 | Explain | Explain | "Did snapping change the number of cubes?" and "Which structure made 48 + 32 easier?" |
| 5 | Your Turn | Try | Fresh transfer question: 36 + 24 (6 ones + 4 ones make a new ten), then an animated check. |
| 6 | Robot Parade (optional) | Grade 3 bonus | A 3-by-4 array. "How many robots?", then rows (4 + 4 + 4) regroup into columns (3 + 3 + 3 + 3). Two questions follow: "Did regrouping change the count?" and "Which structure makes counting easier?" |
| 7 | Wrap-Up | Wrap-up | Recap. The robot recap appears only if the bonus was done, so the bonus answer is never spoiled. |

**Controls**
- **Start**, **Pause/Resume**, **Replay** (replays the current scene; on a question it restarts the chapter), and **Next**.
- Chapter buttons unlock as the learner reaches them, and a completed chapter can be replayed at any time.
- Keyboard: Tab, arrows, Enter, and Space all work. **P** pauses or resumes, **R** replays, **N** goes next. The shortcuts are ignored while typing an answer.
- Touch: all targets are at least 44 px tall. An on-screen number pad means the phone keyboard isn't needed. On phones the playback bar stays at the bottom of the screen.
- **Captions** are on by default. Turning them off hides them visually, but screen readers still hear them.
- **Reduce motion** follows `prefers-reduced-motion` and can also be toggled in the app. Objects jump to each new arrangement instead of sliding, and nothing pulses.
- **Read aloud** (off by default) uses the browser's built-in speech synthesis.
- Feedback is diagnosis-based (for example, 70 gets "Don't forget the new ten…" and 710 gets "…side by side"). After two wrong tries, **Show me how** explains the answer.

## Project structure

```
src/lib/model.ts         The ONE pure math model: quantities, cube/robot ids, every coordinate,
                         every label, the question bank, and all answer checks (with diagnoses)
src/lib/lesson.ts        Story and teaching sequence. Captions read their numbers from the model
src/lib/timeline.ts      Pure timing helpers (beats, easing, reduced-motion progress)
src/lib/lessonState.ts   Pure reducer: start/pause/replay/next/goto/submit/reset, locks, double-press guard
src/components/          LessonApp (layout, playback clock, focus, shortcuts),
                         AdditionStage / ArrayStage (SVG renderers that only interpolate model positions),
                         QuestionCard (choices, number pad, live feedback)
tests/unit/              Vitest: verification cases, count preservation, layouts, leaks, reducer
e2e/                     Playwright: controls, navigation, feedback, transfer, keyboard/touch,
                         robustness, reduced motion, answer leaks, screenshots
screenshots/             Initial / intermediate / final states at 390 px and 1280 px
VERIFICATION.md          Math and visual verification report
```

Note: `next dev` in Next 16.3 writes `AGENTS.md` and `CLAUDE.md` (guidance files for AI coding agents) into the project root. They are not part of the app.
