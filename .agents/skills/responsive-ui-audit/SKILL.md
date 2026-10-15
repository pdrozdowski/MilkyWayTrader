---
name: responsive-ui-audit
description: Audit a specified DOM-based game screen across desktop and mobile landscape viewports, classify responsiveness and usability defects, sequentially delegate critical repairs, and independently verify fixes with Playwright screenshots and DOM measurements.
---

# Responsive UI Audit

## Mission

Given one explicitly named game scene, modal, or screen, autonomously inspect its desktop and mobile presentation, find reproducible experience-breaking defects, and repair **Critical** defects one at a time. Preserve desktop quality and gameplay behavior. Finish with an evidence-based report. Do not claim verification without fresh screenshots and checks.

## Input contract

Required: `screen` (screen/scene/modal identifier). Optional:

- `state`: deterministic state/fixture needed to display the screen; discover existing fixtures before requesting details.
- `desktop`: default `1920x1080` CSS viewport.
- `mobile`: default `844x390` CSS viewport, landscape, mobile context with touch enabled.
- `mobile_16_9`: default `640x360` CSS viewport, landscape, mobile context with touch enabled.
- `fix`: default `critical` (only Critical defects are automatically repaired).
- `max_attempts_per_defect`: default `2`.
- `max_total_repairs`: default `10` (protect against cycles).
- `artifacts_dir`: default `context/responsive-ui-audit/<screen>/`.

Example:

```text
/responsive-ui-audit screen=personal-best-modal state=authenticated-with-5-scores fix=critical
```

Treat viewport values as **CSS pixels**, not screenshot output pixels. Use `deviceScaleFactor` explicitly and record it. Do not resize screenshots and mistake normalized image dimensions for actual viewport geometry. Preserve the same logical UI state in all captures. If the game supports only fixed 16:9 layouts, still test a realistic landscape phone viewport and report whether that constraint causes inaccessible content; do not silently stretch or crop screenshots to conceal it.

## Operating constraints

1. UI controls are DOM-based. Prefer Playwright DOM APIs (`locator`, `boundingBox`, `evaluate`, computed styles, elementFromPoint) for objective measurements; screenshots remain necessary for visual judgment.
2. Reuse the project's existing Playwright setup, helpers, test IDs, debug menu, authentication fixtures, and server lifecycle. Discover the relevant code before adding any new test infrastructure.
3. Avoid touching gameplay/business logic, unrelated scenes, database migrations, authentication configuration, or global CSS unless a demonstrated root cause requires it.
4. Never weaken tests, suppress errors, hide controls, or add viewport-specific hacks that merely conceal a defect.
5. Do not run multiple editing agents simultaneously on the same working tree. Wait for each to finish before verification or the next delegation.
6. Never assume that a subagent is available. Use the host Codex's supported delegation facility if present; otherwise perform the scoped repair directly and record `delegation: unavailable`.
7. Do not commit unless explicitly authorized.
8. Respect existing dev/test server ports and single-instance enforcement. Never start a competing server without checking existing listeners and project conventions.
9. Do not modify fixtures to make the screen artificially pass. Test fixtures must represent a valid game state.

## Workflow

### Phase 0 — Discover and reproduce

- Locate the target screen's DOM implementation, CSS, responsive logic, entry point, and existing tests.
- Determine how to open it deterministically. Prefer existing Playwright `prepareGameState` / debug-menu helpers over long gameplay journeys.
- Verify the target screen is actually visible and ready in all profiles. Wait for relevant assets/fonts and stable layout; disable or freeze nonessential animations when supported by existing test utilities.
- If reproduction is impossible, stop with `BLOCKED: cannot reproduce` and explain the missing precondition. Do not invent screenshots.

### Phase 1 — Capture baseline

For each profile (`desktop`, `mobile`, `mobile_16_9`):

1. Start a fresh browser context with explicit viewport, deviceScaleFactor, mobile/touch flags and consistent browser engine.
2. Navigate to the target screen and establish identical logical state.
3. Record metadata: viewport, DPR, screen orientation, route, browser, fixture name, timestamp.
4. Capture a full **viewport** screenshot, without changing dimensions after capture. Optionally capture a full-page screenshot separately for debugging.
5. Collect a DOM snapshot for visible UI controls and key containers: stable selector/test ID, text/role, bounding rect, computed font size, line height, visibility, overflow, scroll size, client size, transform, pointer-events, z-index, and ancestor clipping context.
6. Save artifacts as `baseline-<profile>.png` and `baseline-<profile>.json`.

Use deterministic filenames and keep raw baseline captures immutable.

### Phase 2 — Analyze using three inspectors

**A. DOM Geometry Inspector**

- Find meaningful UI elements outside the usable viewport or clipped by an overflow ancestor.
- Find content that overflows containers with no reachable scroll/navigation path.
- Find collisions between unrelated interactive controls. Exclude intentional parent/child overlap and decorative layers.
- Detect suspiciously small text or touch targets, unexpected transforms, inconsistent scaling and stacking/pointer interception.
- Record geometry in CSS pixels and reference stable selectors. Do not flag invisible, offscreen-by-design, or disabled elements without understanding their state.

**B. Visual Inspector**

- Compare desktop and mobile screenshots for hierarchy, readability, scale consistency, distorted graphics, padding, alignment, layout and available screen area.
- Desktop is a design-intent reference, **not** a pixel-perfect mobile oracle. Reflow and adaptive sizing are valid.
- Do not use raw pixel diffs as proof of a defect; animations, canvas content and responsive layouts naturally differ.

**C. Interaction Inspector**

- Check essential actions (including modal close, navigation, pagination, save/confirm) using safe non-destructive interactions.
- Confirm controls can be reached, tapped and used without an obscuring overlay.
- For destructive controls (delete, reset, purchase), validate reachability without confirming the destructive action, unless an isolated disposable fixture explicitly permits it.
- Restore the baseline state before subsequent captures.

### Phase 3 — Classify and prioritize

Create `defects.json`. Each defect must include:

```json
{
  "id": "C1",
  "severity": "Critical",
  "profile": "mobile",
  "selector": "[data-testid='close-button']",
  "summary": "Close button is clipped and cannot be tapped",
  "evidence": {
    "screenshot": "baseline-mobile.png",
    "bounds_css_px": { "x": 820, "y": 12, "width": 48, "height": 48 },
    "viewport_css_px": { "width": 844, "height": 390 }
  },
  "expected": "Player can close the modal with a visible, tappable control",
  "status": "OPEN",
  "attempts": 0
}
```

Severity:

- **Critical**: blocks an essential action, makes the screen unusable, makes vital content unreachable, or prevents navigation/closing.
- **Major**: materially harms usability/readability but the player can still complete the flow.
- **Minor**: noticeable sizing, spacing, alignment or consistency issue without significant usability impact.
- **Cosmetic**: purely aesthetic difference.

Assign Critical only with concrete evidence of player impact, not simply because an element differs from desktop. Group duplicates caused by the same root cause when appropriate. Order Critical defects by impact and dependencies.

### Phase 4 — Sequential Critical repair loop

For each currently OPEN Critical defect, subject to `max_total_repairs`:

1. Reconfirm it remains reproducible; previous fixes may have resolved it indirectly.
2. Delegate **exactly one defect** to one implementation agent, if delegation is available. Give the agent its evidence, relevant code, expected outcome, constraints and a narrow scope. Instruct it to edit code and report changed files; it must not self-certify the fix.
3. Wait for completion. If delegation is unavailable, make the same narrowly scoped change directly and disclose that fact.
4. Run targeted lint/typecheck/tests as supported by the project.
5. Independently re-create the screen and capture **all three profiles**, plus fresh DOM geometry and safe interaction checks. Use attempt-specific filenames, e.g. `C1/attempt-1-mobile.png`.
6. Perform a **full screen re-audit**, not just a check of the selected selector. Update statuses of all previously known defects; record newly introduced ones and any indirect resolutions.
7. Mark the selected defect `VERIFIED` only if the player-impact issue is gone and no new Critical desktop/mobile regression was introduced. Otherwise mark the attempt `FAILED`, record evidence and retry (up to the per-defect limit).
8. If the attempt introduces a Critical regression, require correction within the retry budget; do not silently proceed as if the repair succeeded. Do not blindly revert user-authored changes.
9. After the retry budget is exhausted, mark `BLOCKED`, record the remaining problem, and continue with other independent Critical defects when safe.
10. Stop if the overall repair budget is reached or the same unresolved root cause is cycling; report the blocker.

Do not rely on an implementation agent's verbal assurance or code diff as proof of success.

### Phase 5 — Final regression and report

- Reproduce and capture final screenshots for all three profiles.
- Re-run the three inspectors and relevant Playwright tests.
- Write `final-report.md` with: tested screen/state/profiles, baseline defects, verified fixes, indirectly resolved defects, remaining Critical/Major/Minor/Cosmetic defects, blocked attempts, changed files, tests/results, before/after evidence paths, and limitations.
- Result is `PASS` only when all required captures and checks succeeded, no Critical defects remain, and no Critical regression was introduced.
- Result is `PARTIAL` if meaningful progress occurred but Critical issues remain or verification is incomplete.
- Result is `BLOCKED` if the screen cannot be reproduced or reliable verification cannot run.
- Never declare PASS based on screenshots alone if essential interaction checks were not completed.

## Recommended artifact layout

```text
context/responsive-ui-audit/<screen>/
  baseline-desktop.png
  baseline-desktop.json
  baseline-mobile.png
  baseline-mobile.json
  baseline-mobile_16_9.png
  baseline-mobile_16_9.json
  defects.json
  C1/
    attempt-1-desktop.png
    attempt-1-mobile.png
    attempt-1-mobile_16_9.png
    verification.json
  final-desktop.png
  final-mobile.png
  final-mobile_16_9.png
  final-report.md
```

## Completion response

Summarize the final status, number of Critical defects found and verified, any remaining blockers, test results, and report path. Do not claim any unperformed steps were completed.
