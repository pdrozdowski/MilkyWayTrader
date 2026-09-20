# Test results contract

`run-tests.mjs` writes `.cache/test-runs/<run-id>/results.md` on every run and one raw `.log` per suite.

The report contains:

- `Status`: `PASS`, `TEST_FAILURE`, or `ENVIRONMENT_FAILURE`.
- UTC timestamp, repository revision, dirty state, Node/platform data and workspace fingerprint.
- A table with every suite, command, status, exit code, duration and raw log.
- Condensed ANSI-free failure excerpts and exact reproduction commands.
- Playwright report, trace or screenshot locations when present.
- A stable failure fingerprint made from normalized failing suite output.

Exit codes are `0` for PASS, `1` for test failures and `2` for environment/configuration failures. Missing npm scripts, process-launch failures and unavailable Playwright browsers are environment failures. Assertions, compilation failures and application browser-test failures are test failures.

`cicd-fix-tests` must reject a report whose workspace fingerprint no longer matches. After a repair, the old report is intentionally stale and control returns to `cicd-run-tests` for a new complete report.
