# Testing Guidelines

## Test levels

- Domain and mechanics use Node's built-in test runner. Test public behavior without Phaser, DOM or adapter mocks.
- Architecture tests enforce dependencies, ownership and naming.
- Unit and integration tests cover business rules, authoritative state, adapters, telemetry, and component behavior with typed fakes where appropriate. Component tests that mount semantic HTML with fake ports belong in a fast non-Playwright DOM test environment when one is introduced.
- Playwright uses real Chromium only for a small set of critical player journeys and browser integrations that cheaper layers cannot expose. Application smoke tests verify real boot and adapter wiring only when that browser boundary is the risk.
- Build, audit and Pages-size checks are deployment validation, not substitutes for behavioral tests.

## Business rules

Place business tests under `tests/domain/`. Every new or changed rule must cover threshold values, invalid inputs, state transitions and input immutability. Use table-driven cases when one rule has several ranges. Assert integer rounding explicitly where credits, prices or tax are involved. Do not add a production rule only to demonstrate the harness.

Treat the PRD and accepted architecture as the contract. Fix implementation defects first. Change an assertion only when the test contradicts an authoritative requirement; never skip, weaken or add arbitrary retries to obtain a pass.

## Authoritative state

State changes use `$utils-add-state`. Provider and codec tests cover detached immutable snapshots, schema and shape rejection, migrations, atomic failure, duplicate IDs, reset, subscriptions, and JSON round trips. Reducer tests cover transition boundaries and input immutability. Clock tests cover overlapping pause reasons, idempotent pause/resume, long active frames, and no progress while paused or closed. Serialization tests compare uninterrupted and restored simulation results while excluding held input and presentation effects.

When a task explicitly requests architecture artifacts, refresh `code-graph.json`, generate `data-logical-diagram.md`, and run the diagram checker. A `REFACTOR_REQUIRED` finding fails that artifact-validation task even when runtime tests pass.

## UI behavior

Prefer roles, labels and visible text as Playwright selectors. Use IDs only for stable component-owned elements and `data-*` attributes for cross-layer contracts such as ignored gameplay input. Fast component tests verify rendering, actions, subscriptions and idempotent cleanup. Before adding Playwright coverage, record the player-visible failure scenario, why lower-level tests are insufficient, and the unique browser behavior under test.

Playwright has one Chromium project. A dedicated journey may opt into a touch viewport when the risk specifically concerns touch/browser layout. Fullscreen success is tested through a fake port because headless browser fullscreen support varies; the application smoke suite only verifies real wiring. Store reports, traces and screenshots under ignored `.cache/` paths.

## Local Supabase Playwright lifecycle

`npm.cmd run test:ui` is the only local-Supabase test entry point. It starts Vite using `npm.cmd run dev:test-nolog`, which selects Vite's ignored `.env.test`; normal `npm.cmd run dev-nolog` uses `.env.local` and remains connected to the real development Supabase project and Google OAuth.

Before tests, `tests/ui/globalSetup.ts` runs `node scripts/prepare-test-database.mjs`. It rejects any `.env.test` URL other than loopback HTTP, verifies Docker Supabase is available, and resets the local database with all repository migrations. This deliberately deletes local test data only. Never run this lifecycle against remote Supabase.

Every UI spec must import `test` from `tests/ui/testSessionFixture.ts`. It creates an isolated session before each test and removes it afterward; global teardown cleans any artifact left by an interrupted run. Use the default anonymous session unless the browser journey genuinely requires signed-in state. For that case add `test.use({ testSessionMode: 'authenticated' })`: the fixture provisions a local email/password user and injects a Supabase browser session, without Google OAuth.

The fixture exclusively owns these commands:

- `node scripts/create-test-session.mjs anonymous`
- `node scripts/create-test-session.mjs authenticated`
- `node scripts/cleanup-test-session.mjs`

Do not invoke them from a test body, store or print their session artifacts, add service-role keys to `.env.test`, or expose any admin credential through `VITE_*`. The scripts obtain local-only admin access from the active Supabase CLI and keep sensitive artifacts under ignored `.cache/playwright/`.

## Commands and failures

Choose the narrowest command that gives a real regression signal for the changed area. Local test commands never install npm dependencies or browsers implicitly.

- `npm.cmd run test:domain`, `test:mechanics`, `test:objects`, or `test:audio`: run the matching focused Node suite.
- `npm.cmd run test:unit`: domain/state, mechanics, object scaffolding and audio scripts.
- `npm.cmd run test:architecture`: dependency and layout enforcement.
- `npm.cmd run test:fast`: all Node tests plus architecture; use for cross-cutting local changes that do not need browser coverage.
- `npm.cmd run typecheck`: application and Playwright TypeScript configurations.
- `npm.cmd run playwright:install` (alias: `test:ui:install`): explicit one-time local Chromium installation.
- `npm.cmd run playwright:test` (alias: `test:ui`): starts the temporary Vite server and runs Playwright UI tests; use only when the changed risk needs a real browser.
- `npm.cmd run test:project`: fast tests, typecheck and Playwright; it assumes dependencies and Chromium are already available.
- `npm.cmd run test:ci` (alias: `validate:deployment`): project tests, HIGH/CRITICAL audit, production build and Pages-size validation; it also assumes installation was performed by the caller.

GitHub Actions performs the missing CI-only installation phases in order: `npm ci`, `playwright:install:ci`, then `validate:deployment`. Do not add these installation steps to normal local test commands.

Do not add skill, agent, generator, or other repository-tooling tests to any project test command. Run tooling validation only through its explicitly requested owning workflow; it is outside local product feedback and CI product-quality gates.

Use `cicd-run-tests` for a complete diagnostic report. Pass a failing report to `cicd-fix-tests`, then rerun all suites. Reports and raw logs are local diagnostics and remain under `.cache/`.
