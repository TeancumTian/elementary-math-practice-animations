# Verification report

Tests were run on 2026-09-27 on macOS with Node 22.12.0 and npm 10.9.0, in Chromium via Playwright 1.63.0, using Next 16.3.6, React 19.3.0, TypeScript 7.0.2, and Vitest 5.0.2.

## 1. Tests actually run

| Command | Result |
| --- | --- |
| `npm run typecheck` | Pass (0 errors) |
| `npm run build` | Pass. Compiles, type-checks, and prerenders `/` as static. |
| `npm test` (Vitest) | **131 / 131 passed** in 3 files |
| `npm run test:e2e` (Playwright, fresh production build on :3114) | **38 / 38 passed** |
| Flakiness re-run: `controls`, `reduced-motion`, `robustness`, `keyboard-touch` specs with `--repeat-each=3` | **63 / 63 passed** |

### Math checks (unit tests, `tests/unit/model.test.ts`)

| Verification case | Checked in the model | Result |
| --- | --- | --- |
| 48 + 32 = 80 | `MAIN.sum`, `checkAddition(MAIN, "80")` returns correct, final equation label `48 + 32 = 80` | Pass |
| 8 ones + 2 ones = 1 ten | `onesSum = 10`, `newTens = 1`, `leftoverOnes = 0`. The new ten-stick's 10 members are exactly Juno's 8 loose cubes and Remy's 2. | Pass |
| Tens combine to 80 | Final layout has 8 sticks in the Total tens place, 0 loose ones, and count-by-tens labels 10…80. | Pass |
| Regrouping preserves quantity | At every stage (jumble → apart → onesTogether → snapTen → tradeTen → tensTogether), all 80 stable cube ids are present, every stick has exactly 10 members, no cube is in two sticks, sticks × 10 + loose = 80, and consecutive stages carry the same ids and total. The same holds for 36 + 24 = 60. | Pass |
| Footer sentences are arithmetic truths | For example, "7 tens + 10 ones = 80 cubes" is parsed and re-added at every stage. | Pass |
| Array has 12 under either grouping | Rows are 3 groups of 4, columns are 4 groups of 3, and both are the same 12 ids. Every array stage has 12 positions, footers read "4 + 4 + 4 = 12" and "3 + 3 + 3 + 3 = 12", and robots keep their relative order when regrouped. | Pass |
| Geometry | No two cubes or robots overlap, everything stays inside the SVG, and count chips fit inside their cells without touching labels or cubes. | Pass |
| Answer checks | 48 + 32: 70 → forgot the new ten, 710 → tens and ones side by side, 8 → tens count only, 17 → digits added as ones, 90 → one ten too many, 82 → ones place wrong. Matching checks for 36 + 24 and for the 3 × 4 array (7, 34/43, 8, 16, 9, 15). Blank or non-numeric input is not graded. | Pass |
| No answer in wrong-answer feedback | For every input 0–120, wrong-answer feedback never contains 80, 60, or 12. | Pass |

`tests/unit/lesson.test.ts` checks the following:
- The order is predict → watch → explain → try, then the optional bonus.
- Every question is used once.
- Beats leave time to move and to read.
- The full run is 120–240 s. Measured: 174 s with the bonus, 136 s without.
- No numeric answer appears in its question's visual, prompt, equation, or hint, or in earlier scenes of the same chapter.
- The wrap-up never mentions 12 if the bonus was skipped.

`tests/unit/lessonState.test.ts` covers the reducer:
- Pause, resume, and replay.
- Next waits at questions.
- The double-press guard.
- 200 rapid Next presses stop at the first question.
- Chapter locks and mid-scene `goto`.
- A full walkthrough, plus the path that skips the bonus.
- Reset.
- Repeated wrong answers count once, and Show me appears after 2 tries.

### Behavior checks (Playwright, `e2e/`)

- **Start / pause / resume / replay** (`controls.spec.ts`):
  - Start plays chapter 1.
  - Pause freezes the beat and cube coordinates for 1.2 s, and Resume moves them again.
  - Replay returns to beat 0.
  - A finished scene waits for Next.
  - Next is disabled at questions.
  - Captions can be hidden and remain in the screen-reader live region.
- **Chapter navigation** (`navigation.spec.ts`):
  - Chapters unlock as the learner advances, and completed chapters replay.
  - Navigating mid-animation restarts the chosen chapter at beat 0 with 80 cubes and no console errors.
  - The snap scene ends with 8 sticks, Total "80", labels 10…80, and "48 + 32 = 80".
  - The bonus can be skipped.
- **Keyboard only** (`keyboard-touch.spec.ts`):
  - Tab to Start and press Enter, then use P / P / R, Enter, Tab, ArrowDown, Tab, and Enter to answer.
  - Focus moves to Next after a correct answer.
  - Typing `n7p0` in the answer box yields "70" without navigating.
  - Chapter buttons work from the keyboard.
  - A visible focus outline is present.
- **Touch** (390×844, `hasTouch`):
  - Taps work for Start, Pause, choices, the number pad (digits, delete, clear), Check, and Next.
  - The layout viewport is exactly 390 px, with no sideways scroll.
  - Every button, toggle, answer choice, and unlocked chapter is at least 44 px tall.
- **Specific corrective feedback** (`feedback.spec.ts`):
  - Each wrong choice and each diagnosed wrong number shows its own clue.
  - Show me appears after 2 tries.
  - The explain questions and the array questions have their own feedback.
- **Transfer** (`transfer.spec.ts`):
  - 36 + 24 is shown with 60 cubes.
  - The hint doesn't reveal the answer.
  - 50 and 510 get specific clues, and 60 is correct.
  - The check animation counts 10…60 and shows "36 + 24 = 60".
- **Reset and rapid input** (`robustness.spec.ts`):
  - Start over clears answers and relocks chapters.
  - Reset during animation works.
  - Double-clicking Next advances exactly one step, both from a scene to a question and from a scene to a scene.
  - Mashing 40 × N and 72 mixed keys never skips a question and throws no errors.
  - Double-clicking Check with the same wrong answer counts as one try.
  - A correct double-click on Check followed by mashing Next moves exactly once.
  - 7 rapid pause toggles leave a consistent paused state.
  - 15 rapid chapter clicks end on the last chapter clicked.
- **Reduced motion** (`reduced-motion.spec.ts`, `reducedMotion: "reduce"`):
  - Cube coordinates are identical at 120 ms and 1 s, so objects jump instead of sliding.
  - The Next button has `animation-name: none`.
  - With full motion, the same cube is at an in-between position mid-move.
  - The in-app toggle works when the system setting is off.
- **Answer leaks** (`answer-leak.spec.ts`), at the 48 + 32, 36 + 24, and 3 × 4 questions:
  - The answer (80, 60, or 12) is not in any text node (visible or hidden, including the SVG `<title>`/`<desc>`), any `aria-*`, `data-*`, `title`, `alt`, `value`, or `content` attribute, any input value, the document title, any live region, or Playwright's ARIA snapshot.
  - The same holds after opening the hint and after a wrong answer.
  - The answer appears only after a correct submission.
  - Multiple-choice questions show no correct-answer marker before submission, and radio values are neutral (`a/b/c`).

## 2. Visual verification (screenshots inspected by eye)

`e2e/screenshots.spec.ts` captures the initial, intermediate, and final states. Phone images are real viewport captures: the stage at the top (`-a-top`), then scrolled to the panel (`-b-panel`). Desktop images are full-page captures at 1280×800.

| State | Files |
| --- | --- |
| Initial cover (jumbled cubes, Start) | `mobile-01-initial-*`, `desktop-01-initial.png` |
| Intermediate: prediction with corrective feedback (70) | `mobile-02-predict-feedback-*`, `desktop-02-predict-feedback.png` |
| Intermediate: mid-animation "Snap! 10 ones make 1 ten" | `mobile-03-snap-a-ten-*`, `desktop-03-snap-a-ten.png` |
| Intermediate: 12 robots regrouped into 4 columns of 3 | `mobile-04-array-columns-*`, `desktop-04-array-columns.png` |
| Final: wrap-up, 8 tens counted to 80, "You found the structure!" | `mobile-05-final-*`, `desktop-05-final.png` |

Problems found by looking at screenshots or by the tests, all fixed and re-verified:

1. **The "1 ten" chip was clipped** at the right edge of the ones place (mobile and desktop). Chip width is now computed in the model, and chips are right-aligned inside their cell. A unit test asserts that every chip fits its cell and clears count labels and cubes.
2. **The tens chip crowded the "40/50" count labels.** The tens column was widened and the ones column narrowed in the model. The gap is now asserted.
3. **The phone layout viewport was 1008 px wide.** The visually hidden "(locked)" text in chapter buttons was absolutely positioned relative to the page. It is now contained in its button, and tests assert `innerWidth` and `scrollWidth` are exactly 390.
4. **The sticky playback bar could cover new feedback and the finish card on phones.** Both now scroll into view with a bottom scroll margin.
5. **The current chapter pill could be scrolled out of view on phones.** The chapter list now auto-scrolls horizontally to the current chapter.
6. **A double-click on Next could land on the new "Skip bonus" button** because the layout shifted between steps. The desktop playback bar now sits at the top of the panel and never moves, and "Skip to the wrap-up" is placed after the bar.
7. **The Next button's endless nudge animation** kept moving the button. It was also flagged as unstable by Playwright. It is now 3 soft glows with no movement, and none at all with reduced motion.
8. **The double-press guard also swallowed a quick legitimate Next right after a correct answer.** A resolved answer now re-arms Next.
9. **New ten-stick outlines were drawn stretched across moving cubes.** They now fade in only as the cubes line up.
10. **Header toggles were 40 px tall on phones**, below the 44 px touch target. They are now 44 px, and the touch test asserts at least 44 px.

Readability at 390 px: the stage renders at about 0.95 scale. Key numbers (48, 32, the total) are about 19–21 px, headers about 14 px, and chips, names, and count labels about 11.5–12.5 px bold. Captions and questions are 18–20 px HTML text. Nothing overlaps or is clipped in the final screenshots.

## 3. Code review only (not exercised by automated tests)

- **Read aloud** (browser `speechSynthesis`) is off by default. Its code path cancels speech on pause, navigation, reset, and unmount, but it was not run, because headless Chromium has no voices.
- **Real devices and other browsers** were not tested. Only Chromium was run, including a 390×844 touch/mobile emulation. Safari/iOS and Firefox are unverified.
- **Screen readers** were not tested with actual assistive technology (VoiceOver or NVDA). The tests verify the DOM and ARIA they rely on: SVG `role="img"` with model-generated `<title>`/`<desc>`, `role="status"` live regions for captions and feedback, `aria-pressed` toggles, `aria-current` on chapters, and focus moving to the question and then to Next.
- **Color contrast** was chosen for AA-level contrast and checked visually, not with an automated contrast tool. The UI does not rely on color alone:
  - Remy's cubes are striped and Juno's are solid.
  - A new ten has a dashed outline and a "new ten" tag.
  - Row groups use dashed outlines and column groups use dotted outlines.
  - Feedback uses ✓/✗ icons with words.
  - Toggles show ON/OFF text.
  - The current chapter is underlined with a filled number badge.
- **Grade match:** MP.7 is the target practice, not an extra content standard. For context, the main task sits in Grade 2 place-value addition within 100 (2.NBT.B.5, 2.NBT.B.9). The array is labeled and kept as an optional Grade 3 bonus (equal groups and commutativity, 3.OA.A.1, 3.OA.B.5). "Shared shape attributes" from the MP.7 description is not part of the specified concrete task and is not taught here.
