# Playwright Testing Principles

## P1. One Business Behavior per Test

Each Playwright test MUST verify one clearly defined user-facing business behavior.

A test may contain multiple actions and assertions when they belong to the same business operation.

Avoid long scenarios combining unrelated business operations.

**Example:** Test buying a commodity, not an entire journey involving authentication, flying, buying, transferring cargo, and selling.

## P2. Start from the Required State

Tests MUST begin from a predefined, deterministic application state that satisfies their preconditions.

State preparation belongs to fixtures, not to the test scenario.

A test for selling commodities should start with the player already authenticated, landed on the appropriate planet, and carrying the required cargo.

Do not replay unrelated gameplay to reach the required state.

## P3. Separate Setup from Behavior

Maintain a clear separation between:

- **Authentication fixtures:** establish player identity and session.
- **Game-state fixtures:** establish location, cash, cargo, and other domain state.
- **Test execution:** perform the business operation through the real UI.
- **Assertions:** verify observable business outcomes.

Test setup may use debug capabilities. The business operation under test MUST use the actual application functionality.

## P4. Tests Must Be Independent

Each test MUST be executable individually and in any order.

Tests MUST NOT depend on the successful execution or side effects of another test.

Shared immutable fixture definitions are allowed. Mutable game state, user profiles, and backend records MUST be isolated between tests.

Parallel execution should be supported wherever practical, but MUST NOT be enabled until database isolation has been verified under concurrency.

## P5. Prefer Fixture Composition Over Scenario Duplication

Build reusable, configurable fixtures rather than hardcoded game-state snapshots or duplicated setup sequences.

Fixtures should support composing relevant preconditions such as:

- Authenticated or anonymous player.
- Selected planet.
- Empty or preloaded cargo.
- Configurable cash.
- Required market or facility state.

Avoid creating a separate fixture implementation for every possible combination.

## P6. Reuse Existing Test Infrastructure

Before introducing new test infrastructure, inspect and reuse existing mechanisms.

Prefer the existing deterministic test-mode state bootstrap for preparing planetary location and game state. Reuse the Debug Menu and Playwright teleportation when those controls are themselves under test or when direct bootstrap cannot represent the required state.

Extend existing helpers when necessary instead of creating competing mechanisms.

Test infrastructure MUST NOT change production business rules.

## P7. Keep Tests Fast and Deterministic

Tests MUST avoid unnecessary navigation, animations, real-time gameplay, arbitrary sleeps, and repeated interactive authentication.

Use deterministic initial states and explicit readiness conditions.

Optimize total execution time without sacrificing meaningful coverage or test independence.

Do not increase timeouts to conceal slow or unstable test design.

## P8. Assert Business Outcomes, Not Implementation Details

Assertions SHOULD focus on observable business results rather than internal implementation details.

For trading, verify:

- Commodity quantity changes.
- Cash balance changes.
- Market stock changes where relevant.

Avoid assertions against internal variables unless they are necessary for validating otherwise unobservable behavior.

## P9. Use the Lowest Appropriate Testing Layer

Playwright E2E tests SHOULD validate user interactions and integration between application components.

Pure domain calculations, pricing algorithms, cargo accounting, and similar logic SHOULD be tested using unit tests.

Database authorization, RLS, and persistence contracts SHOULD primarily be tested through integration tests.

Do not use browser-based E2E tests when a lower-level test can provide equivalent confidence more efficiently.

## P10. Parameterize Equivalent Behaviors

When the same business behavior applies to multiple entities, prefer parameterized tests sharing the same implementation.

For example, buying and selling commodities across Seroton, Lactozis-7C, and Maslo-Prime should reuse common test logic with planet-specific inputs.

Each parameterized case MUST remain independently executable and identifiable in test reports.

## P11. Preserve Critical End-to-End Journeys

Decomposed business tests do not completely replace full user journeys.

Maintain a small number of genuine end-to-end smoke or release tests covering critical paths such as:

- Application startup and authentication.
- Starting and resuming gameplay.
- Complete trading flow across planets.
- Game completion and result persistence.

Keep these journeys separate from focused business tests and execute expensive scenarios at an appropriate frequency.

## P12. Optimize for Diagnostic Value

A failed test SHOULD clearly identify the business behavior that failed.

Prefer short, focused tests with meaningful names and explicit assertions.

Use `test.step()` when it improves reporting within a single business operation.

Do not combine unrelated behaviors merely to reduce the number of test cases.

## P13. Bounded Test Execution and Failure Handling

Automated test execution MUST have explicit time and retry limits.

- Run Playwright with a defined test timeout and global execution timeout.
- When browser launch fails with `EPERM` or another sandbox permission error, allow at most one retry using the approved execution environment.
- Do not repeatedly retry the same command without changing the underlying failure condition.
- Do not continuously poll a process without a fixed deadline.
- If a test runner exceeds its execution deadline, terminate the process and report the timeout.
- Capture the exit code, available logs, and failure details.
- Distinguish test failures from infrastructure failures.
- If the execution environment prevents validation, report the tests as **BLOCKED**, not PASSED or FAILED.
- Never enter an unbounded cycle of retries, process checks, or environment troubleshooting.

**Fail-fast rule:** After one unsuccessful environment recovery attempt, stop automated execution and report the blocker unless there is concrete evidence that a different corrective action will resolve it.

**Agent responsibility:** Test execution must never prevent the agent from completing its implementation report. If validation is blocked, report the implementation status and the unverified tests explicitly.

## P14. Direct State Bootstrap

Game-state fixtures SHOULD initialize the application directly in the required business state, without replaying unrelated UI navigation or gameplay.

Prefer deterministic test bootstrap mechanisms over sequences of menu interactions when those interactions are not under test.

Reuse existing game-state serialization and initialization mechanisms. Do not duplicate domain logic or introduce test-specific business behavior.

Measure setup time before introducing additional bootstrap infrastructure.

## P15. Fixture Lifecycle and State Integrity

Fixtures MUST preserve application state integrity throughout the test.

- Initial state injection must occur only at the intended bootstrap point.
- Fixture initialization must not silently overwrite state during subsequent navigation or reload.
- State must be isolated between tests.
- Prepared state must be validated before executing the business operation.
- Persistence tests must observe actual persisted state, not state repeatedly injected by fixtures.
- Test bootstrap mechanisms must not bypass the production business logic being verified.

## P16. One Database Baseline per Suite

The local Supabase test environment MUST be brought to a known schema and data baseline once per suite execution, using `supabase db reset` with the configured migrations and seeds.

- The reset MUST run before tests begin and MUST NOT be repeated between individual tests.
- Reset operations MUST target only the dedicated local test database, never cloud or production environments.
- Test setup MUST verify the target environment before destructive operations.
- A reset failure MUST stop the suite rather than allowing tests to run against unknown state.
- Schema migrations and baseline setup belong to suite infrastructure, not individual test fixtures.

## P17. Automatic Persistent-State Isolation

Test authors MUST NOT be responsible for manual database cleanup. The harness MUST establish isolation for each test using the actual persistence ownership model.

- Assign a unique test execution identifier per test attempt, including retries.
- Isolate game sessions, saved scores, telemetry, and other persisted records through existing user, session, or run ownership keys **only where those keys are enforced by application queries and policies**.
- A unique identifier alone does not establish isolation. Browser-context isolation alone does not establish database isolation.
- Where shared-user state cannot be reliably partitioned by run, use a dedicated test identity or another proven isolation boundary.
- Do not use global per-test `TRUNCATE` or maintain hardcoded lists of tables to clear.
- Tests MUST NOT delete or mutate another test's persistent data.
- Identify and explicitly handle shared global state that cannot be partitioned by user or run; do not claim isolation where it is absent.
- Validate isolation before enabling multiple workers.

## P18. Authentication Identity and Session Lifecycle

Authentication setup SHOULD be amortized across a suite when safe, without weakening isolation or security coverage.

- Reuse authenticated Playwright `storageState` for independent browser contexts when tests can safely share an identity.
- Shared `storageState` means shared identity, not isolated persisted data.
- Tests for RLS, cross-user access, authentication, account lifecycle, or user-owned mutable state MUST use separate identities when needed for correctness.
- Session artifacts MUST be stored only in temporary test locations, protected from source control, and cleaned up after the suite.
- Fixture setup and cleanup subprocesses MUST have explicit time limits and report failures clearly.

## P19. Test Infrastructure Ownership and Environment Safety

The test harness MUST have explicit ownership and lifecycle rules for its local services.

- Local development uses Vite on port `8080`; Playwright uses its dedicated Vite server on port `8081`.
- Both server configurations MUST enforce fixed ports without silent fallback to `8082` or higher.
- Playwright MUST use the intended local Supabase environment; development MUST use its configured cloud environment. Verify endpoints rather than assuming the selected Vite mode guarantees isolation.
- Do not attach to an incompatible pre-existing server. Do not terminate a server owned by an unrelated workflow.
- Start services once where practical; terminate only harness-owned processes after execution, including failure paths.
- Avoid duplicate Supabase stacks and unbounded subprocess waits.
- Never expose cloud credentials to test fixtures or run destructive test setup against cloud services.

## P20. Measure End-to-End Suite Cost

Performance decisions MUST consider both per-test duration and the complete suite lifecycle.

- Measure database reset/migrations, service readiness, authentication preparation, fixture bootstrap, business interaction, and teardown separately.
- Compare before/after timings using equivalent scenarios and execution conditions.
- Prefer eliminating repeated infrastructure and fixture work over weakening assertions or increasing timeouts.
- Maintain a small set of full-asset and full-journey smoke tests when faster bootstrap paths bypass normal startup behavior.
- Performance targets are diagnostic goals, not reasons to mark correct but slower tests as failures without an agreed budget.

---

## Definition of Done

A new or refactored Playwright test is acceptable when:

- It verifies one business behavior.
- It starts from a deterministic fixture.
- It is independent of other tests.
- It exercises the real UI for the behavior under test.
- It verifies meaningful business outcomes.
- It avoids unnecessary setup and gameplay delays.
- It reuses existing test infrastructure.
- It runs successfully in isolation and as part of the suite.
- It is implemented at the appropriate testing layer.
- Its execution time is reasonable and measurable.
- Its persistent data is isolated by an enforced ownership boundary, not merely a unique identifier.
- It requires no manual per-test database reset or global truncate.
- It uses the correct local test services and does not interfere with the development environment.
- Its fixture and infrastructure operations have bounded execution and cleanup.
