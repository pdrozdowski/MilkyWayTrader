---
name: responsive-ui-audit
description: Audit a specified DOM-based game screen across desktop and mobile landscape viewports, classify responsiveness, visual layout integrity and usability defects, sequentially delegate critical repairs, and independently verify fixes with Playwright screenshots and DOM measurements.
---

# Responsive UI Audit

## Mission

Given one explicitly named game scene, modal, or screen, autonomously inspect its desktop and mobile presentation, find reproducible experience-breaking defects, and repair **Critical** defects one at a time. Preserve desktop quality and gameplay behavior. Finish with an evidence-based report. **A technically clickable DOM is not sufficient: a visibly broken, unreadable, or unusable layout fails the audit.** Do not claim verification without fresh screenshots and checks.

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
10. Never equate successful Playwright assertions, DOM containment, or lack of console errors with acceptable visual layout. Explicit visual inspection is a mandatory acceptance gate.
11. If auditing multiple related screens, enumerate them as separate screen/state/viewport combinations, preserve shared design conventions, and recheck all consumers of any changed shared component.

## Execution observability and recovery (mandatory)

The orchestrator owns a durable, continuously updated execution ledger. Never rely on the final narrative alone to reconstruct what happened.

### Step ledger and checkpoints

- Before executing work, create `execution-status.json` and `execution-log.jsonl` inside `artifacts_dir`. If filesystem writing is unavailable, retain an in-memory ledger and disclose that persistence failed.
- Break every phase into explicit, uniquely identified steps, including each viewport/state capture, DOM inspection, interaction, repair attempt, and verification. Record dependencies, attempt count, start/end timestamps, elapsed time, tool/command, exit code, output artifact paths and status.
- Valid step statuses: `PENDING`, `RUNNING`, `PASS`, `FAIL`, `RETRYING`, `BLOCKED`, `SKIPPED`. Only `PASS` counts as completed. Record a reason for `BLOCKED` and `SKIPPED`.
- Write a `RUNNING` event before a step starts and its terminal outcome immediately after it finishes. Append events rather than overwriting history; atomically refresh the current status snapshot when possible.
- On startup, load any existing ledger for this screen. Preserve previous runs using a `run_id`; never mistake a previous run's PASS for verification in the current run. Resume only when artifacts and state are still valid, otherwise re-run the affected step.
- Keep successfully produced evidence even if a later step fails. Never overwrite immutable baseline screenshots or claim all viewports failed when only one failed.
- Provide concise progress updates at phase boundaries and when an environment failure is encountered. The final response must include a step-status table and the precise failed step, if any.

Example `execution-status.json` (illustrative, not a fixed set of steps):

```json
{
  "run_id": "2026-10-15T10-00-00Z",
  "screen": "in-game-menu",
  "overall_status": "RUNNING",
  "steps": [
    {"id":"ENV-01","name":"Node child-process smoke test","status":"PASS","attempts":1},
    {"id":"ENV-02","name":"Vite explicit config startup","status":"FAIL","attempts":1,"error_id":"ERR-001"},
    {"id":"CAP-MOBILE","name":"Mobile baseline capture","status":"BLOCKED","blocked_by":["ENV-02"]}
  ],
  "errors": [
    {"id":"ERR-001","step_id":"ENV-02","category":"ENVIRONMENT","code":"EPERM","operation":"spawn","executable":"<resolved path if known>","message":"spawn EPERM","retryable":true}
  ]
}
```

### Environment preflight

Before browser work, independently check and record:

1. Runtime availability and versions: Node, package manager, Playwright and browser executable.
2. Node child-process smoke test (`spawnSync(process.execPath, ['-v'])`), separately from Vite/esbuild/browser checks.
3. Existing listeners on the project's designated ports; reuse the established server where valid. Respect single-instance enforcement.
4. Start Vite with the **exact project configuration and flags** required by the test suite. Apply the verified targeted escalation recovery above when needed. Confirm readiness using an HTTP probe, not just a successful CLI launch, and maintain server availability for subsequent phases.
5. Verify browser launch, navigation, and screenshot creation with the actual Playwright context.
6. Check that the target fixture and test setup can be reached. Record each check separately.

A passing generic Node spawn test does **not** prove Vite's esbuild service can spawn. A passing Vite CLI invocation without the explicit config does **not** prove the actual dev server works. A Playwright `--list` result does **not** prove Chromium can run the test. Never conflate these checks.

### Failure capture and attribution

For every failed step, record: step ID, phase, state/viewport, command and sanitized arguments, working directory, relevant environment details, executable path if known, exit code/signal, exception name/message, error code/errno/syscall, stack, bounded stdout/stderr excerpts, timeout, artifact paths, and whether failure is reproducible. Never log credentials, tokens, cookies, or private environment variable values.

Categorize as `ENVIRONMENT`, `SETUP`, `CAPTURE`, `INSPECTION`, `INTERACTION`, `IMPLEMENTATION`, `VERIFICATION`, or `UNKNOWN`. Use `UNKNOWN` when evidence is insufficient. Do not infer a sandbox root cause solely from `EPERM`.

### Verified Windows Vite/esbuild sandbox recovery (mandatory)

A reproducible project-specific failure has been observed on Windows: starting the exact Vite test server in the default Codex sandbox can fail while esbuild starts its service (`spawn EPERM`), even when a generic Node child-process smoke test and a direct Playwright Chromium launch both PASS. The **same Vite command** has been verified to start successfully with the host-supported `require_escalated` execution path (Vite 6.4.3 ready; HTTP 200 on port 8081). This establishes a sandbox-dependent process-launch restriction for that operation, not the underlying Windows policy mechanism. Treat this as a known recovery case, not as an instruction to repeat a broad investigation.

- For this repository, the verified test-server command is `npm.cmd run dev:test-nolog -- --host 127.0.0.1 --port 8081 --strictPort`, from the project root, using `vite/config.dev.mjs` through the existing script. First check whether the expected server is already healthy; reuse it when appropriate.
- Attempt the exact server startup in the default sandbox. If it fails with esbuild `spawn EPERM` (including `ensureServiceIsRunning` / Vite config bundling), **immediately request the host-supported `require_escalated` retry for this exact server command**. Do not gate this retry on Node or Chromium failing, and do not waste attempts on unrelated smoke tests. Provide a narrow permission justification; respect user approval and host policy. Never pretend escalation happened if it was unavailable or denied.
- Keep the successful server alive and reachable **for the entire capture, inspection, repair and regression workflow**. An HTTP 200 followed by immediately stopping the server is not recovery. Manage its lifecycle using the project's established conventions, respecting single-instance rules. Record how the process is kept alive, its port, readiness result and ownership. Do not assume a process survives the end of an execution tool call; verify readiness before each dependent phase and restart through the same approved path if necessary.
- Run Playwright/Chromium with normal permissions when it works there. Escalate a separate failing operation only if it independently demonstrates an access restriction; never escalate all commands by default.
- If escalation succeeds, mark the default attempt `FAIL` with `EPERM`, the escalated attempt `PASS` with `permission_mode: escalated`, and the environment step `PASS (RECOVERED)` in the ledger; continue automatically with the requested UI audit, not a diagnostic-only report. If approval is denied or escalation is unsupported, mark the precise step `BLOCKED` and explain the dependency.
- Never modify application code, package dependencies, Vite configuration, or system security settings to work around this sandbox restriction. Do not request permanent unrestricted permissions.

### Bounded recovery

- Retry a transient infrastructure failure **once** in a fresh process or browser context, after recording the initial error and cleaning up only resources owned by this run. Do not loop identical commands indefinitely.
- For the known Vite/esbuild `spawn EPERM` case, follow the verified targeted escalation path above before generic retries. For other failures, if the retry fails, isolate the smallest failing operation (for example Node spawn vs esbuild service vs Vite config bundling vs Chromium launch). Escalate permissions only through the host's supported mechanism, only when evidence supports an access restriction and only with the required approval. Never silently disable sandboxing, security tools, or change global permissions.
- Do not reinstall dependencies, change app code, change Vite/Playwright configuration, or kill unrelated processes as an automatic environment workaround.
- If a dependency remains unavailable, mark its dependent steps `BLOCKED` with `blocked_by`, but preserve independent completed steps and continue safe independent diagnostics. Do not attempt UI repairs without a reliable baseline and verification path.
- Record permission mode and whether escalation was requested, approved, denied, or unavailable for each relevant attempt. A recovered environment error is not a terminal audit failure.
- Recovery retries for environment steps do **not** consume `max_attempts_per_defect`. A failed screenshot due to tooling is not evidence that a CSS repair failed.
- Distinguish `overall_status` from `audit_status`: an interrupted audit may be `PARTIAL` with completed evidence; use `BLOCKED` when no reliable audit can proceed. Never report `PASS` unless all required checks were completed.

## Workflow

### Phase 0 — Environment preflight, discover and reproduce

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

### Phase 2 — Analyze using four inspectors

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

**D. Responsive Layout Integrity Inspector (mandatory, independent acceptance gate)**

Inspect the **actual captured viewport screenshots** at native dimensions, alongside DOM geometry. For each screen, state and viewport, explicitly answer the following questions and store results in `layout-integrity.json`:

1. **Text legibility and fragmentation:** Are labels, titles, commodity names, button captions, prices and status text readable without awkward character-by-character wrapping, mid-word breaks, extreme multi-line fragmentation, clipping, ellipsis hiding essential meaning, or font sizes too small to read? Check `overflow-wrap`, `word-break`, `white-space`, computed width and line height. A box fully inside the viewport can still contain catastrophically broken text. Compare actual rendered line count with reasonable label length; use screenshots as the deciding evidence. Avoid false positives for intentionally stacked or short labels.
2. **Card and column integrity:** Are cards wide enough to support their intended content? Detect desktop multi-column grids compressed into narrow phone columns, collapsed icons, distorted images, and buttons narrower than their labels. Do **not** accept five desktop cards squeezed into a phone viewport merely because no boxes overflow.
3. **Reachability of content and actions:** Is all essential content visible or reachable via an obvious, working, touch-friendly scroll or navigation path? Check viewport clipping, nested overflow, scrolling bounds and actual gesture/scroll behavior. Content below the fold is not automatically defective if scrolling works; essential controls that cannot be reached are Critical.
4. **Visual hierarchy and usability:** Can a player identify the screen, understand each card, read primary values and find the primary action without deciphering vertical letter stacks or visually collapsed content? Evaluate usable space, spacing, visual order, touch-target separation and consistent treatment across related screens.
5. **Responsive adaptation:** Does the layout meaningfully adapt at 844×390 and 640×360, rather than just shrinking a desktop grid? Consider preserving sensible minimum card widths with horizontal scrolling, paging, fewer columns, or a compact alternate layout. Select based on existing interaction conventions; **do not mandate a specific implementation** or change gameplay rules.
6. **Visual evidence:** Reference specific screenshot filenames, affected selectors/regions and observed symptoms. Record each check as `PASS`, `FAIL`, or `UNVERIFIED`, with reasons. Do not infer legibility from computed CSS alone. If images cannot be inspected, record `UNVERIFIED` and never claim overall PASS.

**Known failure examples (must be detected):** `Dairy Farm`, `Grain Farm`, `Cheese Factory`, `Cargo Capacity`, `Engine System`, `Weapon System`, `Booster` splitting into vertical character stacks; five facility/shipyard cards squeezed to unusable widths; trade/upgrade/transfer controls clipped without a reachable scroll path. These are examples of symptoms, not hardcoded selectors or guaranteed severities.

**Acceptance rule:** An obvious broken layout on any required viewport is a defect even when every Playwright interaction succeeds. If text fragmentation prevents comprehension or the screen is effectively unusable, classify it as **Critical**. If it substantially impairs reading but the task remains possible, classify **Major**. Do not label a merely unconventional but readable intentional design Critical.

**Mandatory visual review checkpoint:** After baseline captures, after **every** repair attempt, and before final PASS, review all relevant screenshots for the six checks above. Never mark a repair VERIFIED based solely on DOM assertions or passing tests. Include `layout-integrity.json` (or attempt-specific equivalent) in verification evidence.

### Phase 3 — Classify and prioritize

Create `defects.json`. Each defect must include (and record the inspection step IDs that support it):

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

- **Critical**: blocks an essential action, makes the screen unusable, makes vital content unreachable, prevents navigation/closing, **or renders core UI labels/controls so fragmented or unreadable that a player cannot reliably understand or operate the screen**.
- **Major**: materially harms usability/readability (including severe but still decipherable text wrapping or card compression) but the player can still complete the flow.
- **Minor**: noticeable sizing, spacing, alignment or consistency issue without significant usability impact.
- **Cosmetic**: purely aesthetic difference.

Assign Critical only with concrete evidence of player impact, not simply because an element differs from desktop. Group duplicates caused by the same root cause when appropriate. Order Critical defects by impact and dependencies.

### Phase 4 — Sequential Critical repair loop

For each currently OPEN Critical defect, subject to `max_total_repairs`:

1. Reconfirm it remains reproducible; previous fixes may have resolved it indirectly.
2. Delegate **exactly one defect** to one implementation agent, if delegation is available. Give the agent its evidence, relevant code, expected outcome, constraints and a narrow scope. Instruct it to edit code and report changed files; it must not self-certify the fix.
3. Wait for completion. If delegation is unavailable, make the same narrowly scoped change directly and disclose that fact.
4. Run targeted lint/typecheck/tests as supported by the project.
5. Independently re-create the screen and capture **all three profiles**, plus fresh DOM geometry, **visual layout integrity review** and safe interaction checks. Use attempt-specific filenames, e.g. `C1/attempt-1-mobile.png`.
6. Perform a **full screen re-audit including visual readability and card integrity**, not just a check of the selected selector. Update statuses of all previously known defects; record newly introduced ones and any indirect resolutions.
7. Mark the selected defect `VERIFIED` only if the player-impact issue is gone, **the screenshots pass the visual acceptance gate**, and no new Critical desktop/mobile regression was introduced. Otherwise mark the attempt `FAILED`, record evidence and retry (up to the per-defect limit).
8. If the attempt introduces a Critical regression, require correction within the retry budget; do not silently proceed as if the repair succeeded. Do not blindly revert user-authored changes.
9. After the retry budget is exhausted, mark `BLOCKED`, record the remaining problem, and continue with other independent Critical defects when safe.
10. Stop if the overall repair budget is reached or the same unresolved root cause is cycling; report the blocker.

Do not rely on an implementation agent's verbal assurance or code diff as proof of success.

### Phase 5 — Final regression and report

- Reproduce and capture final screenshots for all three profiles.
- Re-run all four inspectors, including the independent visual acceptance gate, and relevant Playwright tests.
- Write `final-report.md` with: execution summary by phase/step, environment checks, retry/recovery outcomes, error IDs and root-cause confidence, untested states/profiles, plus layout-integrity outcomes (text fragmentation, card width, reachable controls, visual gate), tested screen/state/profiles, baseline defects, verified fixes, indirectly resolved defects, remaining Critical/Major/Minor/Cosmetic defects, blocked attempts, changed files, tests/results, before/after evidence paths, and limitations.
- Result is `PASS` only when all required captures and checks succeeded, **all required viewport screenshots were visually inspected, layout-integrity checks passed for all required states**, no Critical defects remain, and no Critical regression was introduced. **If the requested fix scope is `critical`, Major defects may remain but must be explicitly reported; do not describe a screen with obvious Major readability failures as visually healthy.**
- Result is `PARTIAL` if meaningful progress occurred but Critical issues remain or verification is incomplete.
- Result is `BLOCKED` if the screen cannot be reproduced or reliable verification cannot run.
- Never declare PASS based on screenshots alone if essential interaction checks were not completed; **never declare PASS based on passing interaction checks alone if visual layout integrity was not established**.

## Recommended artifact layout

```text
context/responsive-ui-audit/<screen>/
  baseline-desktop.png
  baseline-desktop.json
  baseline-mobile.png
  baseline-mobile.json
  baseline-mobile_16_9.png
  baseline-mobile_16_9.json
  execution-status.json
  execution-log.jsonl
  defects.json
  layout-integrity.json
  C1/
    attempt-1-desktop.png
    attempt-1-mobile.png
    attempt-1-mobile_16_9.png
    verification.json
    layout-integrity.json
  final-desktop.png
  final-mobile.png
  final-mobile_16_9.png
  final-report.md
```

## Completion response

Summarize the final status, number of Critical defects found and verified, any remaining blockers, test results, and report path. Include a compact step-by-step PASS/FAIL/BLOCKED/SKIPPED summary and an explicit per-viewport visual integrity verdict with exact failed command/operation and error code, plus completed evidence that remains usable. Do not claim any unperformed steps were completed.
