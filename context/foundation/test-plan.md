# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-09-29

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost × signal.** The cheapest test that gives a real signal for the risk wins. Do not promote to e2e because e2e "feels safer." Do not put a vision model on top of a deterministic visual diff that already catches the regression.
2. **User concerns are first-class evidence.** Background identity or telemetry work must not ruin the player experience; UI alignment and authoritative game state are frequent-change areas.
3. **Risks are scenarios, not code locations.** This plan documents *what could fail* and *why we believe it's likely* — drawn from documents, interview, and codebase *signal* (churn, structure, test base). It does NOT claim to know which line owns the failure. That knowledge is produced by `/10x-research` during each rollout phase. If the plan and research disagree about where the failure lives, research is the ground truth.

Prefer fast deterministic tests. Use browser coverage only for accessible, desktop/touch interaction risks that cheaper layers cannot expose. Hot-spot scope used for likelihood weighting: `src/`.

## 2. Risk Map

The top failure scenarios are ordered by impact × likelihood. Sources are evidence, not code anchors.

| # | Risk (failure scenario) | Impact | Likelihood | Source (evidence — not anchor) |
|---|---|---|---|---|
| 1 | Identity or telemetry background work interrupts, delays, or corrupts an active anonymous game. | High | High | S-10 implementation plan; interview Q1/Q4; hot-spot dir `src/game/scenes` (44 changes/30d) |
| 2 | Sign-in, cancellation/error, or local sign-out leaves misleading controls or stale account status. | High | High | S-10 implementation plan; interview Q3/Q4; hot-spot dir `src/ui/components` (21 changes/30d) |
| 3 | Missing or malformed public configuration starts OAuth or telemetry instead of safely disabling those actions. | High | Medium | S-10 implementation plan |
| 4 | Client-supplied telemetry attributes, malformed batches, or unsupported origins are accepted by ingestion. | High | Medium | S-10 implementation plan; tech-stack Supabase/JWT constraint |
| 5 | Authentication transitions alter authoritative game state or attach identity retrospectively to earlier events. | High | Medium | S-10 implementation plan; interview Q3/Q4; hot-spot dir `src/game/state` (19 changes/30d) |
| 6 | UI changes harm core-control layout or accessibility. | Medium | Medium | interview Q3; existing desktop/touch Playwright setup |

### Risk Response Guidance

| Risk | What would prove protection | Must challenge | Context `/10x-research` must ground | Likely cheapest layer | Anti-pattern to avoid |
|---|---|---|---|---|---|
| #1 | Failed or unavailable background services leave gameplay responsive and unchanged. | Async work is harmless. | Service lifecycle, gameplay entry points, failure paths. | application/integration | e2e for a service-only failure |
| #2 | Every visible auth state and teardown outcome is coherent and accessible. | OAuth happy path covers cancellation and errors. | UI state contract, subscriptions, destruction. | component/application | happy-path-only assertions |
| #3 | Invalid configuration disables actions without side effects. | Defaults are safe. | Public configuration validation and UI wiring. | unit/application | implementation mirror |
| #4 | Ingestion rejects untrusted values and derives identity server-side. | Client identity claims are trustworthy. | Request contract, JWT boundary, CORS, database privilege. | integration/function | over-mocking the boundary |
| #5 | Auth transitions leave game state unchanged; prior events are not backfilled. | Signing in changes all session history. | State ownership, event queue, send-time identity. | unit/integration | copied production calculation |
| #6 | Named controls remain usable in desktop and touch layouts. | Rendering implies accessibility. | Semantic controls, input isolation, viewport behavior. | targeted e2e | pixel-perfect snapshot |

## 3. Phased Rollout

| # | Phase name | Goal (one line) | Risks covered | Test types | Status | Change folder |
|---|---|---|---|---|---|---|
| 1 | Auth UI and non-blocking gameplay | Prove auth transitions preserve anonymous play and active game state. | #1, #2, #3, #5 | unit, component, application, targeted e2e | complete | `s10-player-sign-in-status` |
| 2 | Telemetry ingestion and isolation | Prove only bounded, trusted telemetry is accepted without blocking play. | #1, #4, #5 | unit, integration/function | not started | — |
| 3 | Release-facing quality gates | Lock fast coverage and high-value browser smoke checks into project gates. | #2, #6 | project gates, targeted e2e | not started | — |

## 4. Stack

| Layer | Tool | Version | Notes |
|---|---|---|---|
| unit + integration | Node test runner | Node runtime | Existing domain, mechanics, object, audio, skill, and architecture suites. |
| e2e | Playwright | ^1.63.0 | Existing desktop and touch projects; use semantic locators. |
| typecheck | TypeScript | ~5.7.2 | Includes production and test configurations. |
| build | Vite | ^6.3.1 | Use `npm.cmd run build-nolog`. |

**Stack grounding tools (current session):**
- Docs: none — no dedicated documentation MCP available; checked: 2026-09-29.
- Search: web search — available, not needed for local test-base inventory; checked: 2026-09-29.
- Runtime/browser: in-app browser — available for manual verification and targeted browser tests; checked: 2026-09-29.
- Provider/platform: none — no Supabase or GitHub connector available; checked: 2026-09-29.

## 5. Quality Gates

| Gate | Where | Required? | Catches |
|---|---|---|---|
| typecheck | local + CI | required | Type and public-environment drift |
| unit + integration | local + CI | required after §3 Phase 1 | Auth, state, and telemetry regressions |
| targeted e2e | local + CI | required after §3 Phase 1 | Broken desktop/touch auth controls |
| `test:project` | local + CI | required after §3 Phase 3 | Combined repository regression |
| pre-release manual smoke | localhost/staging | required for credentialed setup | OAuth/provider behavior unavailable to safe automation |

## 6. Cookbook Patterns

### 6.1 Auth UI and game-state protection

- Exercise `unavailable`, `unsigned`, `signed-in`, action-error, and local-sign-out transitions through the public auth port; assert that subscriptions are released on UI teardown.
- Keep auth and telemetry failures non-blocking: application/UI tests must prove starting, playing, landing, launching, trading, signing in, and signing out remain usable when delivery fails.
- Add targeted Playwright coverage only for a representative critical desktop or touch journey whose browser/device behavior cannot be proven by cheaper layers. Use semantic locators. Test auth-control state transitions, visibility, and local sign-out through fast component/application tests unless a real-browser boundary is uniquely at risk.

### 6.2 Telemetry boundary and failure isolation

- TBD — see §3 Phase 2 for allowlisted ingestion, server-derived identity, bounded queues, and dropped-failure patterns.

### 6.3 Targeted browser validation

- TBD — see §3 Phase 3 for semantic desktop/touch auth-control smoke coverage.

## 7. What We Deliberately Don't Test

- **Pixel-perfect styling outside core controls** — visual alignment is manually reviewed unless it harms usability. Re-evaluate if a core control becomes unreadable. (Source: interview Q5.)
- **Low-signal slow tests** — prefer fast tests when they provide equal or better regression signal. Re-evaluate if a unique production failure mode cannot be represented faster. (Source: interview Q5.)
- **Real provider credentials in automated tests** — retain credentialed OAuth checks as manual localhost/staging smoke tests. Re-evaluate if a safe isolated provider test environment is introduced.
- **Guaranteed telemetry delivery after tab close or crash** — delivery is explicitly best effort. Re-evaluate if the product changes that guarantee.

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-09-29
- Stack versions last verified: 2026-09-29
- AI-native tool references last verified: 2026-09-29

Refresh (`/10x-test-plan --refresh`) when a new top-3 risk surfaces, a checked tool date is older than three months, the stack changes, or §7 no longer reflects the team's priorities.
