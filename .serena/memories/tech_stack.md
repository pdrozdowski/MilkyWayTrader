# Tech Stack

- Language: TypeScript `~5.7.2`, `strict`, `noEmit`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `useDefineForClassFields`, `isolatedModules`, `moduleResolution: bundler`, target/module `ES2020`/`ESNext`, `lib` includes DOM. `tsconfig.json` includes only `src`; `tsconfig.tests.json` adds the test configs.
- Framework: Phaser `4.0.0` — pinned exactly, not a caret range.
- Build/dev: Vite ^6.3.1 with two configs: `vite/config.dev.mjs` (dev server port 8080, `base: './'`, manual `phaser` chunk) and `vite/config.prod.mjs`.
- `package.json` still carries the upstream Phaser template identity (`"name": "template-vite-ts"`, version 1.4.0) — that is expected, not stale project metadata.
- Tests: Node's built-in `node --test` for domain/mechanics/objects/audio/presentation/architecture; Playwright ^1.63.0 (Chromium only) for UI journeys.
- Backend: Supabase — `@supabase/supabase-js` ^2.117.2, `supabase` CLI ^2.119.0, migrations in `supabase/migrations/` (`game_events`, `run_results` with RLS). Local Docker Supabase is used by the Playwright lifecycle; no storage backend is wired into the game's state boundary yet.
- Deploy: Cloudflare Pages via Wrangler ^4.133.0, project `milky-way-trader`; details in `mem:deployment`.
- Package manager: npm. No ESLint/Prettier configured — style, naming and layering are enforced by `tests/architecture.test.mjs` instead (see `mem:conventions`).
