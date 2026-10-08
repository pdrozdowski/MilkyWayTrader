# Testing Policy

## Levels

- Domain and mechanics: Node's built-in test runner, no Phaser/DOM/adapter mocks — test public behavior.
- Architecture tests: dependency direction, ownership, layout and naming (`tests/architecture.test.mjs`).
- Playwright (real Chromium, one project): only critical player journeys and browser integrations that cheaper layers cannot expose.
- Build, npm audit and Pages-size checks are deployment validation, not substitutes for behavioral tests.

## Business rules

Tests live in `tests/domain/`. Every new or changed rule covers threshold values, invalid inputs, state transitions and input immutability; use table-driven cases for multi-range rules and assert integer rounding explicitly wherever credits, prices or tax are involved. The PRD and accepted architecture are the contract: fix implementation defects first, and never skip, weaken or retry assertions to obtain a pass.

Provider/codec tests cover detached immutable snapshots, schema and shape rejection, migrations, atomic failure, duplicate IDs, reset, subscriptions and JSON round trips. Reducer tests cover transition boundaries and input immutability. Clock tests cover overlapping pause reasons, idempotent pause/resume, long active frames and no progress while paused or closed. Serialization tests compare uninterrupted and restored simulation results, excluding held input and presentation effects.

## Playwright admission gate

Before adding or changing a spec, record the player-visible failure scenario, why a cheaper test level cannot expose it, and the unique browser behavior it verifies (in the plan, change description, or a comment above the test). Prefer one representative journey over overlapping UI checks. Do not add Playwright coverage for calculations, authoritative state transitions, validation, economy/cargo rules, serialization, telemetry, fake-port component rendering, listener cleanup or implementation details.

Locators: `getByRole` / `getByLabel` / `getByText` first; `getByTestId` only when accessibility attributes are ambiguous; never CSS, XPath or DOM structure. Never use `page.waitForTimeout()` — wait on state (`toBeVisible`, `waitForURL`, `waitForResponse`). Tests must be independently runnable with unique ids and their own cleanup. After adding, removing, renaming or changing a spec, refresh `context/foundation/e2e_scenarios.md` via `/utils-describe-e2e-scenarios`.

## Local Supabase lifecycle

- `npm.cmd run test:ui` is the only local-Supabase entry point; it starts Vite via `dev:test-nolog` (ignored `.env.test`) and runs Playwright.
- `tests/ui/globalSetup.ts` runs `node scripts/prepare-test-database.mjs`, which rejects any non-loopback `.env.test` URL, verifies Docker Supabase and resets the local database from `supabase/migrations/` — it deliberately deletes local test data only. Never run this lifecycle against remote Supabase.
- `.env.test` is ignored and holds only local public settings plus `TEST_USER_EMAIL` / `TEST_USER_PASSWORD`. Never add service-role keys to `.env.test`, to `VITE_*` or to source.
- Specs import `test` from `tests/ui/testSessionFixture.ts`, not `@playwright/test`. Default is an isolated anonymous session; opt into a local programmatic sign-in with `test.use({ testSessionMode: 'authenticated' })`. Never automate Google OAuth.
- The fixture exclusively owns `scripts/create-test-session.mjs anonymous|authenticated` and `scripts/cleanup-test-session.mjs`; never call them inside a test body or log their session/artifact values. Traces, reports and screenshots stay under ignored `.cache/playwright/`.
- `npm.cmd run dev-nolog` loads `.env.local` and stays on the real development Supabase project and Google OAuth; `dev:test-nolog` is test-only.

## Command selection

Choose the narrowest command that gives a real regression signal (see `mem:task_completion`). Local test commands never install npm dependencies or browsers implicitly; GitHub Actions performs `npm ci` → `npm run playwright:install:ci` → `validate:deployment`. Never add skill, agent, generator or other repository-tooling tests to a product test command — tooling is validated only in its explicitly requested owning workflow.
