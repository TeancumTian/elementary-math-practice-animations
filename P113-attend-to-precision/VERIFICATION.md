# Verification report — P113 Attend to Precision

Date: 2026-09-27 · Machine: macOS, Node 22.12.0, npm 10.9.0, Chromium 153 (Playwright 1.63.0)

This report keeps two things apart: **(A) tests that were actually run**, with their results, and **(B) things checked only by reading code or looking at screenshots**.

---

## A. Tests actually run

| Command | Result |
| --- | --- |
| `npm run build` (Next 16.3.6 + TypeScript 7.0.2 type check) | ✅ Compiled, type-checked, 1 static route |
| `npx tsc --noEmit` | ✅ no errors (`strict: true`) |
| `npm test` (Vitest 5.0.2) | ✅ **80 / 80 passed** (2 files) |
| `npm run test:e2e` (Playwright 1.63.0, production server on :3113) | ✅ **45 / 45 passed** (41 desktop 1280×800, 4 mobile 390×844 with touch) |

### A1. Math verification cases (unit tests in `src/model/precision-model.test.ts`)

| Required case | Asserted |
| --- | --- |
| 8 + 2 equals 10 | `valueOf([8, 2]) === 10` |
| 10 + 3 equals 13 | `valueOf([10, 3]) === 13` |
| The original chain is false | `formatChain(...) === "8 + 2 = 10 + 3 = 13"`, `isChainTrue === false`; the first `=` link is 10 vs 13 (`holds: false`) |
| Rebuilt as 8 + 2 = 10, then 10 + 3 = 13 | the text matches exactly and both equations are true; the balance tips right (13 > 10) for the false link and is level (angle 0) for each true equation; the repaired lines' `=` signs line up |
| A 7-cm length requires a length unit | "My pencil is 7 long." fails `isPreciseLength`; only `{7, cm}` passes (not `7`, `7 inches`, or `8 cm`); the pencil drawn on the ruler measures exactly 7 cm; 7 one-cm hops; the `cm` token lands in its slot, giving "My pencil is 7 cm long." |
| Graph values match the labeled scale | repaired scale is 0..7 by 1; every bar top sits on the gridline labeled with its tally count; the broken scale 0,1,2,3,5,6,7,8 skips 4 and misreads Apples as 6 and Grapes as 7; bars have identical positions before and after the repair |
| Transfer | 9 + 1 = 10, then 10 + 4 = 14 are true; the run-on chain is false; the joined ribbon measures 14 cm on the ruler |

Other model tests: every question has exactly one precise option, unique letters, and distinct, specific feedback for each wrong option. The correct letter varies (A–D). Style and speed choices ("neater", "tidier", "faster", "brighter colors") are never correct. The total runtime is 170 s, which falls within 2–4 min. Captions are contiguous and cover each scene. Scene state is deterministic, and object ids stay the same at every 250 ms sample of every scene. Reduced-motion time snaps to each caption's end. Every faulty display is stamped NEEDS REPAIR before its question and REPAIRED afterward. Before submission, no prompt, picture description, earlier caption, or wrong-option feedback contains the correct option's text or its success message.

### A2. Behavior (Playwright, `e2e/`)

- **Start / pause / resume / replay / chapters** (`playback.spec.ts`, 8 tests):
  - the welcome screen waits for Start;
  - pause freezes both elapsed time and the drawn frame, and resume continues;
  - finished scenes wait for Next instead of advancing on their own;
  - questions keep Next disabled until a correct check;
  - Replay chapter restarts the chapter and clears only that chapter's answers;
  - every chapter button jumps to its first step;
  - Back keeps a solved answer;
  - the captions toggle works.
- **Keyboard only** (`keyboard.spec.ts`):
  - Tab from the top of the page to Start;
  - P pauses and resumes, and Enter / N move forward;
  - a whole job (3 questions), each answered wrong first and then right, using only arrow keys, Tab, and Enter;
  - focus moves to the question heading, and then to Next after a correct answer;
  - B and R work;
  - the skip link and visible focus outline.
- **Touch** (`touch.spec.ts`, mobile project with `hasTouch`): tap Start, a chapter, answers, Check, Next, Pause/Resume, and Replay. All visible controls are at least 44 px tall.
- **Specific corrective feedback** (`feedback.spec.ts`, 11 tests):
  - For all 10 questions, each wrong option shows its own model feedback plus a "✗ Not yet" badge, and Next stays disabled. The correct option shows the success text.
  - After solving, every faulty option is labeled with its flaw, for example "✗ missing the unit".
- **Transfer question**: the prompt is a new context (Ella, 9 cm) and does not reuse Sam's 8 + 2. The missing-unit, run-on-chain, and wrong-sum choices each get their own feedback. The correct answer plays the ribbon animation, which ends with "The ribbon is 14 cm long.", a PRECISE stamp, and a 14 cm bracket. The wrap-up follows, and Play again resets.
- **Reset and rapid input** (`robustness.spec.ts`, 6 tests):
  - double-clicking Check produces one feedback message and one badge;
  - double-clicking Next cannot skip past a waiting question;
  - mashing 71 keys (n, b, p, r) leaves exactly one current step, stops at the first unanswered question, and the app still works;
  - switching chapters mid-animation, including while paused, restarts cleanly with no stale frames or leftover ruler;
  - a storm of 14 rapid chapter clicks ends on the last one clicked;
  - Start over returns to the welcome screen with every answer cleared.
- **Reduced motion** (`reduced-motion.spec.ts`):
  - with `prefers-reduced-motion: reduce` emulated, the toggle starts on;
  - the drawn frame equals each caption's end state, so all 7 hops appear at once and nothing tweens;
  - captions keep normal timing, and the CSS nudge animation on Next is `none`;
  - the manual toggle switches on and off.
- **Answer leaks** (`leaks.spec.ts`, 10 tests, one per question), checked before submitting and again after one wrong submission:
  - the correct option's text exists in exactly one DOM text node, inside its own option label;
  - the success message is nowhere in the DOM;
  - no `aria-*`, `data-*`, `title`, `alt`, or `value` attribute contains it;
  - live regions (caption and feedback) don't contain it;
  - there are no `correct` / `answer` markers;
  - all options have identical markup;
  - model-derived "reveal phrases" (for example `14 cm` and `10 + 4 = 14` for the transfer, or `skip` for the axis) appear nowhere outside the option labels.
  - **Mutation check (run):** I temporarily brought back a real bug I had found, where the transfer scene kept its future answer lines in the DOM at opacity 0. The leak test failed and named `"14 cm in “The ribbon is 14 cm long.”"`. I then restored the fix, and the test passes.
- **Layout** (`layout.spec.ts`, desktop and mobile): at the finished frame of every one of the 20 steps, the test checks:
  - no horizontal page scroll;
  - the smallest rendered SVG label is at least 12 px;
  - no two visible SVG labels overlap;
  - no label is clipped outside the picture.
- **Screenshots** (`screenshots.spec.ts`, both widths): saved to `screenshots/`.

---

## B. Visual review (screenshots I looked at) and code review only

### B1. Screenshots inspected

`screenshots/{desktop,mobile}-1-initial.png`, `-2-intermediate-feedback.png` (Try question after a wrong answer), `-3-intermediate-balance.png` (paused while 8 + 2 vs 10 + 3 tips, "≠ not equal"), `-4-intermediate-graph-repaired.png`, `-5-final.png` (wrap-up checklist). I also reviewed a temporary 21-state gallery at both widths during development; it is not shipped.

Problems found in those screenshots and fixed before delivery:

- the stamp's warning icon collided with "NEEDS REPAIR";
- the intro stamp covered the "Class" job card;
- on mobile, Start sat below the fold and the controls wrapped onto 4 rows;
- SVG labels were 13 px or smaller on mobile (fonts raised, with 12 px now enforced by a test);
- the "≠ not equal" badge touched the balance beam;
- the tally "✓ matches" was clipped on desktop;
- the gap "?" marker lingered after 4 was restored;
- the ruler's "10" and "cm" boxes overlapped;
- the finale panel said "Press Next" on the last step.

The final screenshots show no clipped, overlapping, or unreadable text at 390 px or 1280 px.

### B2. Code review only (not verified by an automated test)

- **Screen readers:** the semantics are native radios in a fieldset/legend, `role="img"` SVGs with title and description, polite live regions, `aria-current`, and `aria-pressed`. No real screen reader (VoiceOver or NVDA) was run.
- **Read aloud** (Web Speech API): the code cancels speech on pause and navigation. It was only exercised as "off" in tests, and no audio was heard.
- **Browsers:** only Chromium was run, on desktop and with mobile emulation. Safari/WebKit, Firefox, and physical phones were not tested.
- **Color contrast:** the palette was chosen for about 4.5:1 or better for text (ink #1f2a44 on cream, white on teal #0f766e, amber #b45309 and green #15803d on white). It was not measured with a tool. Status never depends on color alone: the dashed amber border and "⚠ NEEDS REPAIR", the solid green border and "✓ REPAIRED", "✗ / ✓" with words, filled vs. hollow dots, and the bold repaired axis labels all carry meaning without color.
- **Pedagogy:**
  - Grade 2 fit: centimeter rulers (2.MD.A.1), single-unit bar graphs (2.MD.D.10), and make-a-ten sums within 20.
  - The wording is friendly American English.
  - There are no timers, scores, or speed rewards. Style and speed distractors get feedback saying neatness or speed is not the math reason.
  - Faulty messages use the same neat font as repaired ones, so appearance never signals the answer.
  - These are professional judgments, not tests.

### B3. Known limitations

- The app runs entirely in the browser, so the answer logic is in the JavaScript bundle. The leak guarantees apply to rendered DOM text, attributes, and live regions, which is what was required and tested.
- Decorative drawing coordinates (Juno the fox, the shop sign, the stamp outline, check icons) are in `scenes.tsx`. Every mathematical quantity, coordinate, label, caption, and answer check comes from `src/model/precision-model.ts`.
- The ribbon card writes the two equations on separate lines, while the caption and option use "…, then …". The math is identical.
