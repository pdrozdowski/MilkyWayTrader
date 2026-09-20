---
name: cicd-run-tests
description: Run every MilkyWayTrader unit, architecture and Playwright UI test, preserving raw logs and a concise diagnostic report. Use for complete test validation or after cicd-fix-tests; deployment checks remain separate.
---

From the repository root run:

```powershell
node .agents/skills/cicd-run-tests/scripts/run-tests.mjs
```

The script runs all suites even after failures and prints the generated `results.md` path. Read that report first; open only linked raw logs or Playwright artifacts needed to understand a failure. The [report contract](references/report-contract.md) defines statuses and handoff fields.

On PASS, report the file and suite totals. On `TEST_FAILURE`, immediately follow [$cicd-fix-tests](../cicd-fix-tests/SKILL.md) with the report path, then run this workflow again. On `ENVIRONMENT_FAILURE`, surface the report's setup command or blocker; do not edit product code to mask an unavailable runner, browser or dependency.

Do not commit, push, deploy, delete artifacts or skip suites. Continue the run/fix cycle while failures change or measurable progress occurs; the fixer owns the repeated-fingerprint stopping rule.
