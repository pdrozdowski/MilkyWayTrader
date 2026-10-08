# Commands (Windows / PowerShell)

Use the `.cmd` shims (`npm.cmd`, `npx.cmd`); plain `npm`/`npx` hit PowerShell execution-policy shims.

- Dev server: `npm.cmd run dev-nolog` (Vite, port 8080).
- Production build: `npm.cmd run build-nolog` → `dist/`.
- Typecheck: `npm.cmd run typecheck` — `tsc --noEmit` for `src` plus `tsconfig.tests.json`; `build` alone does not typecheck.
- Focused Node suites: `npm.cmd run test:domain`, `test:mechanics`, `test:objects`, `test:audio`, `test:ui-presentation`.
- Aggregates: `npm.cmd run test:unit` (all Node product suites), `test:fast` (adds architecture), `test:architecture`, `test:project` (fast + typecheck + Playwright), `test:ci` (= `validate:deployment`).
- Playwright: `npm.cmd run playwright:install` (one-time Chromium), `npm.cmd run test:ui`.
- Deploy: `npm.cmd run deploy:preview`, `npm.cmd run deploy:production` (Wrangler; need `.env.deploy.local`).
- Raw test diagnostics: `.agents/skills/cicd-run-tests/SKILL.md`; repair from its report with `.agents/skills/cicd-fix-tests/SKILL.md`.

Avoid `npm.cmd run dev` / `npm.cmd run build`: they run `node log.js`, which sends telemetry to gryzor.co. The `*-nolog` variants exist for that reason.

Search with `rg` (`rg --files`, `rg -n --no-heading`) rather than unix-flavored `grep -r`; `Select-String` is the PowerShell fallback. Never run recursive forced removal — the project rule forbids `rm -rf` and equivalents; delete with `Remove-Item -LiteralPath` against explicit paths.
