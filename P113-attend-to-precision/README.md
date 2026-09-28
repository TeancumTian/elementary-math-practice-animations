# Math-Message Repair Shop — Attend to Precision (Grade 2, MP.6)

An interactive SVG animation for ages 6–9. Juno the fixer runs a shop that repairs math messages that other people can't understand. Learners fix three broken messages, then solve one new problem on their own:

| Chapter | Broken message (stamped **NEEDS REPAIR**) | Repair |
| --- | --- | --- |
| 1 · Leo's pencil | "My pencil is 7 long." (no unit) | Count 7 one-centimeter spaces → "My pencil is 7 cm long." |
| 2 · Fruit graph | Side axis labeled 0, 1, 2, 3, **5**, 6, 7, 8 (skips 4) | Relabel the axis 0–7 by 1 student; the bars don't move; Apples reads 5, matching the tally chart |
| 3 · Sam's stickers | `8 + 2 = 10 + 3 = 13` (false: 10 ≠ 13) | A balance shows the false link, then the message is rebuilt as `8 + 2 = 10`, then `10 + 3 = 13` |
| 4 · Ella's ribbon | New transfer problem: 9 cm, plus a 1 cm piece, then a 4 cm piece | Pick the one precise message: `9 + 1 = 10, then 10 + 4 = 14. The ribbon is 14 cm long.` |

Each job follows **Look → Predict → Watch → Explain → Try**, one focus at a time. Every question waits for the learner and gives specific feedback for each wrong choice. Without learner pauses, the animation runs **2 min 50 s** in total, split into short chapters you can replay.

Built with **Next.js 16 (App Router), React 19, TypeScript, and inline SVG**. It needs no backend, API key, paid service, or external asset (not even web fonts).

## Requirements

- Node.js 20 or newer (tested with **Node 22.12.0**, npm 10.9.0)
- For end-to-end tests only: Playwright's Chromium (`npx playwright install chromium`)

| Package | Version | Why |
| --- | --- | --- |
| `next` | 16.3.6 | App Router, build, and server |
| `react`, `react-dom` | 19.3.0 | UI |
| `typescript` | 7.0.2 | Types. Next 16.3.6 type-checks with TS 7 during `next build` (checked: a deliberate type error fails the build). If your toolchain needs the classic compiler API, pin `typescript@^5.9`. |
| `vitest` | 5.0.2 | Unit tests for the math model and the state machine |
| `@playwright/test` | 1.63.0 | Browser tests and screenshots |
| `@types/react`, `@types/react-dom`, `@types/node` | 19.3 / 19.3 / 26.6 | Type definitions |

## Setup and run

```bash
npm install
```

```bash
npm run dev
```

Open **http://localhost:3113**. For a production build:

```bash
npm run build
```

```bash
npm start
```

That also serves on http://localhost:3113.

## Tests

| Command | What it does |
| --- | --- |
| `npm test` | Vitest: 80 unit tests of the math model (every verification case) and the state machine |
| `npm run test:e2e` | Playwright: 45 browser tests on desktop (1280×800) and mobile (390×844, touch). If nothing is already on port 3113, it runs `npm run build && npm run start` first. |
| `npm run screenshots` | Regenerates `screenshots/*.png` (initial, intermediate, and final states at both widths) |
| `npm run typecheck` | `tsc --noEmit` |

Results and the review notes are in [VERIFICATION.md](VERIFICATION.md).

## Using it

- **Start** opens the shop. **Next** is always under the learner's control. Scenes wait at their last frame, and questions keep Next disabled until a correct answer is checked.
- **Pause/Resume**, **Back**, **Replay chapter** (restarts the chapter and clears only its answers), **Start over** (full reset), and chapter buttons for jumping around.
- **Captions** (on by default), **Reduce motion** (follows the operating-system setting until the learner changes it; pictures jump to each caption's finished state instead of moving), and **Read aloud** (optional, off by default, uses the browser's built-in speech).
- Keyboard: Tab / Shift+Tab, arrow keys inside answer choices, Enter/Space. Shortcuts: **N** next, **B** back, **P** pause/resume, **R** replay chapter. A skip link jumps to the activity.
- Touch: all controls are at least 44 px tall, and the page never scrolls sideways at 390 px.

## Project structure

```
src/model/precision-model.ts   THE single model: quantities, ruler/graph/balance/ribbon coordinates,
                               message text, captions, scene states as pure functions of time,
                               accessible descriptions, questions, and the only answer check
src/model/precision-model.test.ts
src/state/shop-state.ts        pure reducer: playback clock, navigation, answers, preferences
src/state/shop-state.test.ts
src/components/RepairShop.tsx  page shell, rAF clock, focus management, keyboard shortcuts
src/components/Stage.tsx       picks the scene renderer, SVG title/description
src/components/scenes.tsx      SVG renderers (they draw the model's state objects; no math of their own)
src/components/QuestionPanel.tsx  native radio questions with feedback
src/app/                       Next.js App Router layout, page, CSS
e2e/                           Playwright specs and helpers
screenshots/                   captured states used in the visual review
```

### How the model drives the animation

`sceneState(sceneId, t)` returns every object in a scene at time `t`: the positions of tokens, pencil, hops, ticks, bars, pans and dots, ribbon pieces, plus stamps and opacities. Each object keeps a stable id across the whole scene. React only draws that state. Captions come from the same module (`SCENES[...].cues`), and so do the numbers in them. Answers are checked by `checkAnswer()`. Every mathematical choice (a length, a graph count, a balance outcome, a set of equations) is judged by the model's own predicates: `isChainTrue`, `isPreciseLength`, `readBar`, `balanceOutcome`. There is no separate answer key for those. "Why" choices in Explain questions carry an authored validity flag, and where possible that flag is computed from the model too, for example `scaleStep(CORRECT_SCALE) === 1`.
