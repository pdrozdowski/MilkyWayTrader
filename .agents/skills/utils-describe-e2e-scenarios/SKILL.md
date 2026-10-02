---
name: utils-describe-e2e-scenarios
description: Generate and refresh MilkyWayTrader's inventory of implemented Playwright E2E scenarios, including each test's source file and PC/mobile target. Use when explicitly asked to describe, list, or update implemented E2E/Playwright scenarios, and immediately after adding, removing, renaming, or changing a Playwright E2E test.
---

# Utils Describe E2e Scenarios

Run from the repository root:

```powershell
node .agents/skills/utils-describe-e2e-scenarios/scripts/describe-e2e-scenarios.mjs
```

The command discovers test files from `playwrightConfig.ts`, replaces `context/foundation/e2e_scenarios.md`, and prints the discovered scenario count. Do not hand-edit that document: rerun the command after every Playwright test change.

Treat a test scoped by `test.use({ isMobile: true })`, `hasTouch: true`, or a mobile device profile as **mobile**. Treat other tests as **PC**, unless the configured Playwright project runs both targets, in which case record both. If a new configuration cannot be classified deterministically, update the script first so the generated document remains accurate.

Review the generated entries against the test names before finishing. The inventory describes only implemented scenarios; it is not a test plan and must not list proposed or skipped coverage.
