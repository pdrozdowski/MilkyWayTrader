# Task Completion

Pick the narrowest validation that can detect the changed risk; the full pipeline is only the release gate.

- TypeScript or configuration change: `npm.cmd run typecheck`.
- Matching focused Node suite: `npm.cmd run test:domain`, `test:mechanics`, `test:objects`, `test:audio`, or `test:ui-presentation`.
- All Node product suites: `npm.cmd run test:unit`; cross-cutting local changes add `npm.cmd run test:fast` (unit + architecture).
- Browser-level risk only: `npm.cmd run test:ui` — needs Docker Supabase running and Chromium already installed, and resets local Supabase data.
- Complete local pipeline: `npm.cmd run test:project` (fast + typecheck + Playwright).
- Release/deployment validation: `npm.cmd run test:ci` (alias `validate:deployment`) — adds HIGH/CRITICAL npm audit, production build and Pages asset-size check.

Do not install dependencies or browsers during ordinary local validation. Do not add skill/agent/generator tooling tests to any product test command. Full diagnostic run with preserved raw logs: `.agents/skills/cicd-run-tests/SKILL.md`; repair a failing report with `.agents/skills/cicd-fix-tests/SKILL.md`.

Extra gates that apply to specific change types:

- Authoritative state/clock/timer/lifecycle/snapshot/save/restore: follow `.agents/skills/utils-add-state/SKILL.md`.
- `context/foundation/prd.md` creation or edit: run `10x-prd-en-capability` validation to completion.
- New project skill: run `.agents/skills/utils-refine-skill/SKILL.md` and accept only with no HIGH/MEDIUM findings.
- Production changes: require an approved plan.
