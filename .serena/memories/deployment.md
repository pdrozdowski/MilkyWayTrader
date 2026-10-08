# Deployment

- Target: Cloudflare Pages via Wrangler, project `milky-way-trader`; static output in `dist/` (Vite `base: './'`).
- `npm.cmd run deploy:preview` → `validate:deployment` then `wrangler pages deploy dist --project-name=milky-way-trader --branch=staging`; `deploy:production` uses `--branch=main`. Both read credentials from the ignored `.env.deploy.local`.
- `npm.cmd run validate:deployment` = `npm.cmd run test:ci` = project tests + HIGH/CRITICAL npm audit + production build + Pages asset-size check (`scripts/check-pages-assets.mjs`).
- CI: `.github/workflows/deploy.yml` performs `npm ci` → `npm run playwright:install:ci` → `validate:deployment`, then deploys.
- `package.json` `dev` and `build` run `node log.js`, which phones home to gryzor.co; the `*-nolog` variants exist for that reason and are what normal local runs and CI use.
- Operational details, accounts and secrets: `context/deployment/README.md`; current publication status: `context/deployment/verification.md`.
- Deleting production Pages projects/databases and rotating the primary secret are manual, user-only actions — never automate them.
- Testing prerequisite: `npm.cmd run test:ui` resets local Docker Supabase from `supabase/migrations/` and must never point at a remote project (see `mem:testing_policy`).
