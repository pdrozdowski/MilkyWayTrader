<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: S-10 Player Sign-in, Status, and Telemetry Implementation Plan

- **Plan**: context/changes/s10-player-sign-in-status/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-09-29
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 1 warning, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

## Findings

### F1 — Event payload fields are not server-allowlisted

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: supabase/functions/ingest-game-events/index.ts
- **Detail**: The function bounds event payloads as objects and by size, but accepts arbitrary event-data keys. A malicious browser caller could therefore store a free-text field despite the documented no-free-text telemetry policy.
- **Fix**: Validate an event-specific allowlist and types for every event-data field before insertion.
  - Strength: Enforces the privacy boundary at the trusted ingestion point.
  - Tradeoff: New event fields require an explicit function update.
  - Confidence: HIGH — it removes the policy bypass without changing the browser contract.
  - Blind spot: The allowed catalog needs maintenance as future event types are added.
- **Decision**: FIXED via event-specific allowlist and value validation

### F2 — Credentialed Supabase and OAuth acceptance checks are pending

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: docs/telemetry-release-verification.md
- **Detail**: No user-managed Supabase test project, Google OAuth client, or function secrets are configured in this workspace, so migration/RLS/Cron/function and real OAuth acceptance cannot be verified locally.
- **Fix**: Follow the documented test-project setup and public-only release verification checklist before production collection.
  - Strength: Validates the exact deployed security and identity path.
  - Tradeoff: Requires owner dashboard access and test credentials.
  - Confidence: HIGH — these checks cannot safely be emulated by the static frontend test suite.
  - Blind spot: Provider dashboards may have changed labels or workflows.
- **Decision**: PENDING
