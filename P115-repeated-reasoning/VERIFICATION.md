# Verification Report: Crates of Five (MP.8, Grade 3)

Date: 2026-09-27. Machine: macOS, Node 22.12.0, npm 10.9.0, Next 16.3.6 (Turbopack),
React 19.3.0, TypeScript 7.0.2, Vitest 5.0.2, Playwright 1.63.0 (Chromium build 1243).

This report keeps **tests that were actually run** separate from **code review only**.

---

## 1. Tests actually run

| Command | Result |
| --- | --- |
| `npx tsc --noEmit` | Pass, 0 errors |
| `npm run build` | Pass. `/` prerendered as static content, and Next's TypeScript step passed |
| `npm test` (Vitest) | **57 / 57 passed** in 3 files |
| `npm run test:e2e` (Playwright, production build on :3115) | **39 passed, 1 skipped, 0 failed** (desktop 1280×800 and mobile 390×844 with touch) |

The one skipped test is the touch test on the **desktop** project, which skips itself by
design. The same touch test passed on the mobile project.

### 1a. Math verification cases (unit tests in `src/model/repeatedReasoning.test.ts`)

| Required case | How it is checked | Result |
| --- | --- | --- |
| 1–6 groups of 5 give 5, 10, 15, 20, 25, 30 | `runningTotals(6)` and `totalFor(1..6)` | Pass |
| Successive totals differ by 5 | `differences(...)` equals `[5,5,5,5,5]` | Pass |
| The fifth total is 25, not 24 | `totalFor(5) === 25`, `checkGroupTotal('24', 5)` is wrong, `'25'` is right | Pass |
| The proposed 24 is rejected with a reason from the groups | Only the option "24 is only 4 more than 20, but one more crate adds 5" satisfies `claimHolds` | Pass |
| The rule is justified by equal groups, not assumed | Repeated addition of the built groups equals `groups × 5` for 0–40 groups, and every such total ends in 0 or 5 | Pass |
| Transfer: 7 sheets of 5 stars | `runningTotals(7, STICKERS)` is 5…35 | Pass |
| Specific corrective feedback | 24 → "only 4 more than 20"; 20 → "total for 4 crates"; 30 → "one crate too many"; 10 → "adds the number of crates…"; 27 → "end in 0 or 5"; 12 (7 sheets) → "7 + 5"; 40 → "one sheet too many" | Pass |
| Wrong-answer feedback never states the answer | Every input 0–300 for the 5-crate, 6-crate, and 7-sheet questions | Pass. This test found a real leak (input 125 produced "25 crates"), which I fixed before delivery |
| Layout coordinates | In both layouts, crates fit and don't overlap, all 5 apples sit inside their crate, jumps stay on the board, no text is smaller than 13 units, and confetti stays clear of text and characters | Pass. This test found a real overlap (narrow "Crate 5/6" labels touching the board), which I fixed |

### 1b. Lesson script and frames (`src/lesson/script.test.ts`)

- 5 chapters in the teaching order: build → repeat and predict → rule → check the wrong term → transfer.
- Playback without learner pauses totals **173 s (2 min 53 s)**, within the 2–4 minute target.
- All four phases are used: predict, animate ("Watch"), explain, and try.
- The build chapter records exactly 5, 10, 15, 20, with one learner "Pack crate" gate for each crate.
- The questions are predict-5 (25), check-pip (choice "short"), monitor-6 (30), and one transfer question, transfer-7 (35).
- Every number in every caption belongs to the model-derived set.
- Frames: after four crates there are 20 apples. The crate-5 count reads 22 mid-way, then stops at 24 with one empty spot; after the fix, 24 is crossed out and 25 is written.
- Reduced motion: for every beat in both layouts, the frame at t = 0 equals the full-motion final frame.
- Apple ids stay stable across beats. No element with progress 0 is ever placed in a frame.
- **Answer leaks:** for each number question, no caption, SVG label, or accessible description of any earlier beat in its chapter contains the answer. This was checked at many timeline samples in both layouts, with and without reduced motion.

### 1c. Playback state machine (`src/lesson/player.test.ts`)

Checked: start; ticking; holding at gates; pause freezing the clock and resume continuing it;
Next blocked at an unanswered question even after 50 attempts; empty input not counting as an
attempt; "Show me" only after 2 wrong attempts; double submissions ignored; replay and chapter
navigation clearing that chapter's answers; out-of-range chapters ignored; reset; a full
playthrough reaching the end.

A **20,000-step random fuzz** of next/back/tick/toggle/replay/goTo/submit/reveal/reset/start
confirmed these invariants after every step:

- the chapter and beat are always in range;
- elapsed time stays between 0 and the beat's duration;
- the lesson is never past an unanswered question.

### 1d. End-to-end (`e2e/lesson.spec.ts`, both projects unless noted)

| Area | What was exercised | Result |
| --- | --- | --- |
| Start | Title screen, then Start → c1-meet with the correct caption and chapter marker; playback reaches the "Pack crate 1" gate and waits; no console errors | Pass |
| Pause / resume | The elapsed clock stays frozen for 800 ms while paused, then advances after Resume | Pass |
| Build | Four gated crates → 20 apples in the DOM and board cells 5, 10, 15, 20 | Pass |
| Replay | A correct answer, then Replay chapter → back to c2-jump1 with the answer box and feedback cleared and Next disabled | Pass |
| Chapter navigation | Chapters 3, 5, 2, 4, 1 each show the right title, first beat, and `aria-current`. Jumping to chapter 4 during the crate-1 drop leaves exactly 20 apples and 5 crates | Pass |
| Corrective feedback | Empty input, 24, and 30 each get specific messages. "Show me with the model" appears only after 2 wrong attempts, Continue receives focus, and Next is enabled | Pass |
| Wrong proposed term | An empty Check → "Choose an answer first"; two wrong reasons ("up by 4", "bigger than 20") each get specific feedback and a "✗ tried" marker (the third wrong reason is covered only by unit tests); the correct reason → Right!; "Pack crate 5" → counter at 24 → board shows 25; 6-crate check: 25 is diagnosed, 30 is accepted | Pass |
| Transfer | 7 sheets and 35 stars are drawn; 12 → "7 + 5", 34 → "end in 0 or 5", 35 is correct; the lesson finishes with "7 × 5 = 35 stars" and "Lesson complete!" | Pass |
| Full playthrough | Start to the end at 30× speed with no console or page errors | Pass |
| Keyboard only | Tab + Enter to start; Space pause/resume; N packs; B back; R replay; Enter on a chapter; focus lands on the question prompt; Tab to the input, type, Enter; Continue focused; the choice question answered with arrow keys | Pass |
| Touch (mobile) | Taps on Start, Pack crate, chapter nav, keypad (2, 4, ⌫, 5), Check, and Continue; narrow layout active; no horizontal overflow at 390 px | Pass (the desktop run skips by design) |
| Reset | Start over mid-question → title screen, no chapter marker, no feedback; after restarting, the question is fresh | Pass |
| Rapid input | A double-click on "Pack crate 1" advances one step; 60 mashed N/→ presses cannot pass the unanswered question; a double-click on Check submits once; 45 mixed key presses leave a consistent state; five fast chapter hops mid-animation end cleanly (0 apples, 1 crate); 5 fast Replays; no console errors | Pass |
| Reduced motion | With emulated `prefers-reduced-motion: reduce`: the toggle shows On, all 5 apples sit in their final slots on the first frame of the fill beat (transforms equal the slot centers, opacity 1), the crate offset is 0, and `document.getAnimations()` is empty. The in-app toggle switches it off and on | Pass |
| Answer leaks | At predict-5, monitor-6, and transfer-7 I sampled all DOM text nodes (including SVG `<title>`/`<desc>` and visually hidden text), `aria-label`/`title`/`alt`/`placeholder`/`aria-valuetext`, input values, and live regions three times each. The answer was absent before submission and after a wrong attempt, and present after a correct one. At the Pip check, "25" was absent and there were no `data-correct`/`data-answer` attributes | Pass |

### 1e. Contrast (computed with the WCAG formula)

All key text/background pairs were measured, and each is at least 4.5:1. Examples: body text
13.1:1, chalk totals on the board 10.5:1, "+5" chalk 7.4:1, Pip's guess 6.2:1,
wrong-answer feedback 8.0:1, correct-answer feedback 7.2:1, primary buttons 5.8:1,
"+5" on the desk 5.9:1.

---

## 2. Visual verification (screenshots captured by Playwright and inspected by me)

The screenshots are in `screenshots/`, as `desktop-*` (1280×800 viewport) and `mobile-*`
(390 px wide, full page, 3× density).

| File | State |
| --- | --- |
| `01-initial-title` | Title card over the faded opening scene |
| `02-intermediate-building` | 2 crates packed, board 5, 10, waiting at "Pack crate 3" |
| `03-intermediate-predict-feedback` | Predict question after a wrong 24, with specific feedback; "?" in column 5; Next disabled |
| `04-intermediate-pip-check` | Pip's bubble "5 crates: 24 apples!", crate 5 with 4 apples and a "?" empty spot, counter 24 |
| `05-intermediate-six-crates` | 6 crates, totals 5–30 with 24 crossed out above 25, the rule row 1 × 5 … 6 × 5 |
| `06-final` | Sticker sheets with running totals 5–35, "7 × 5 = 35 stars", finale, "Lesson complete!" |
| `07-mid-animation` | Paused mid-drop in crate 2; count-on counter at 7 |

I inspected every screenshot. Problems I found and fixed before delivery:

1. SVG text was too small at a 1024 px desktop width (crate labels rendered at about 11 px). I enlarged every wide-layout font and made the side panel fluid.
2. On mobile, oversized arrowheads covered the "+5" labels. Narrow jumps are now flatter, have smaller arrowheads, and put the label below the jump.
3. Dashed focus outlines crossed "+5" labels and the count bubble. Board outlines now draw beneath the jumps, labels have a chalkboard-colored backing, and scene outlines draw beneath the counter.
4. Finale confetti covered the header's "7" and Leo's shirt. Confetti positions now come from the model layout, and a unit test keeps them clear of text and characters.
5. On mobile, the dashed box around Pip's "24" cut into the digits. The box is now wider.
6. The crate-3 outline touched the "Crate 1" label, and narrow "Crate 5/6" labels touched the board. I increased the row spacing and moved the board down.
7. A behavior bug surfaced in the keyboard e2e test: typing fast after a wrong answer could produce "242", because the box was cleared in an effect. The box is now cleared synchronously on submit.

The final screenshots show no clipped, overlapping, or unreadable labels at either width.

---

## 3. Code review only (not executed)

These were **not** tested with real tools or devices. They are reasoned from the code:

- **Screen readers** (VoiceOver, NVDA, TalkBack) were not run. By code review: the SVG has
  `role="img"` with a `<title>` and a frame-derived `<desc>`; captions use a polite live region;
  feedback uses `role="status"`; the current chapter and phase carry `aria-current="step"`;
  focus moves to each new question prompt and then to Continue. How announcements are actually
  voiced is unverified.
- **Browsers other than Chromium** (Safari/WebKit, Firefox) and **physical phones or tablets**
  were not tested. Touch was emulated in Chromium (`hasTouch`, `isMobile`). The code uses only
  standard SVG, CSS grid, `ResizeObserver`, `matchMedia`, and `requestAnimationFrame`.
- **Motion when the tab is hidden:** browsers pause `requestAnimationFrame` in hidden tabs. The
  clock caps each frame at 250 ms, so returning to the tab resumes smoothly instead of jumping.
  In the IDE's embedded preview pane, rAF was throttled to about 1 fps, so playback there was slow;
  this is an artifact of that pane and was not seen in Playwright's Chromium.
- **Pedagogical fit** of the wording for ages 6–9 (sentence length, vocabulary) is a judgment
  from review. It was not tested with learners.
- **No audio narration** is included. The lesson relies on captions, as the prompt requires.
