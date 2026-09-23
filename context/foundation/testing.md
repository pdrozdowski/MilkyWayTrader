# Testing Guidelines

## Test levels

- Domain and mechanics use Node's built-in test runner. Test public behavior without Phaser, DOM or adapter mocks.
- Architecture tests enforce dependencies, ownership and naming.
- HTML UI uses Playwright against real Chromium. Component tests mount semantic HTML with fake typed ports; application smoke tests verify real boot and adapter wiring.
- Build, audit and Pages-size checks are deployment validation, not substitutes for behavioral tests.

## Business rules

Place business tests under `tests/domain/`. Every new or changed rule must cover threshold values, invalid inputs, state transitions and input immutability. Use table-driven cases when one rule has several ranges. Assert integer rounding explicitly where credits, prices or tax are involved. Do not add a production rule only to demonstrate the harness.

Treat the PRD and accepted architecture as the contract. Fix implementation defects first. Change an assertion only when the test contradicts an authoritative requirement; never skip, weaken or add arbitrary retries to obtain a pass.

## Authoritative state

State changes use `$utils-add-state`. Provider and codec tests cover detached immutable snapshots, schema and shape rejection, migrations, atomic failure, duplicate IDs, reset, subscriptions, and JSON round trips. Reducer tests cover transition boundaries and input immutability. Clock tests cover overlapping pause reasons, idempotent pause/resume, long active frames, and no progress while paused or closed. Serialization tests compare uninterrupted and restored simulation results while excluding held input and presentation effects.

When a task explicitly requests architecture artifacts, refresh `code-graph.json`, generate `data-logical-diagram.md`, and run the diagram checker. A `REFACTOR_REQUIRED` finding fails that artifact-validation task even when runtime tests pass.

## UI behavior

Prefer roles, labels and visible text as selectors. Use IDs only for stable component-owned elements and `data-*` attributes for cross-layer contracts such as ignored gameplay input. Component tests verify rendering, actions, subscriptions and idempotent cleanup. Application smoke tests verify boot, persistence, browser errors and representative adapter behavior.

Playwright runs desktop and touch-sized Chromium projects. Fullscreen success is tested through a fake port because headless browser fullscreen support varies; the application smoke suite only verifies real wiring. Store reports, traces and screenshots under ignored `.cache/` paths.

## Commands and failures

- `npm.cmd run test:unit`: domain/state, mechanics, object scaffolding, audio and skill scripts.
- `npm.cmd run test:architecture`: dependency and layout enforcement.
- `npm.cmd run test:ui`: Playwright UI tests.
- `npm.cmd run test:project`: every automated test.
- `npm.cmd run typecheck`: application and Playwright TypeScript configurations.

Use `cicd-run-tests` for a complete diagnostic report. Pass a failing report to `cicd-fix-tests`, then rerun all suites. Reports and raw logs are local diagnostics and remain under `.cache/`.
