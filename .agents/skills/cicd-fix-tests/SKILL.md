---
name: cicd-fix-tests
description: Diagnose and repair MilkyWayTrader failures from a current cicd-run-tests results.md report, then return to the full runner. Use only with that report; environment setup failures are routed back without product edits.
---

Require the `results.md` path. Validate it before inspecting failures:

```powershell
node .agents/skills/cicd-fix-tests/scripts/validate-report.mjs <results.md>
```

If stale, run [$cicd-run-tests](../cicd-run-tests/SKILL.md) and use its new report. Read the condensed failure section first, then only the relevant raw log, Playwright trace/screenshot, source and test. The shared [report contract](../cicd-run-tests/references/report-contract.md) defines statuses and fingerprints.

For `TEST_FAILURE`, reproduce the narrowest failing suite, identify the root cause and make the smallest coherent fix. Treat accepted requirements as authoritative. Change a test only when it contradicts them; never skip tests, weaken assertions, hide errors, add arbitrary retries or update snapshots blindly. Preserve unrelated changes.

Run focused verification, then hand control to `cicd-run-tests` for every suite. Continue while the failure fingerprint changes or the failing set shrinks. If the same fingerprint remains after three repair cycles, record attempts in the latest report and stop as blocked. Also stop for missing external dependencies, unresolved requirements or unsafe required actions.

For `ENVIRONMENT_FAILURE`, do not change product code; surface the setup command or blocker. Never commit, push, deploy or rewrite history.
