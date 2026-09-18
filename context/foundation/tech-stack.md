---
starter_id: phaser-vite-ts
package_manager: npm
project_name: milky-way-trader
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  deployment_plan: free
  database_engine: postgresql
  database_provider: supabase
  supabase_plan: free
  auth_provider: supabase-auth
  auth_methods: [google-oauth]
  auth_token_format: jwt
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: best-effort
  path_taken: custom
  quality_override: false
  self_check_answers:
    typed: true
    from_official_starter: true
    conventions: true
    docs_current: true
    can_judge_agent: true
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
---

## Why this stack

MilkyWayTrader uses the official Phaser Vite TypeScript template with installed versions Phaser 4.0.0, Vite 6.4.3 and TypeScript 5.7.3, as recorded in package-lock.json. Phaser handles the map and animations, while native HTML5/CSS provides market, cargo and session controls. Keep game economy functions independent of Phaser scenes and each player's economy state separate, following context/foundation/prd.md. Anonymous play remains available; Google OAuth login, cloud saves and session resume are required for the MVP, while leaderboards remain nice-to-have. Supabase is the selected PostgreSQL hosting platform, and Supabase Auth is the identity and JWT provider for Google OAuth, the application's only login method. Enable Google OAuth as the sole login provider for the application. Plan browser access through the Supabase API using @supabase/supabase-js, a public publishable key and the signed-in user's JWT; enforce access to each user's session records with PostgreSQL Row Level Security, and never expose secret or service_role keys in the browser. Host the static web application on Cloudflare Pages, using npm run build-nolog and publishing dist/. Supabase and Cloudflare will use free plans for now. GitHub Actions with deployment after merge to main is the intended CI/CD flow and still needs configuration. Playwright and ESLint with typescript-eslint are planned additions after scaffolding; the existing TypeScript compiler can already be run separately with npx --no-install tsc --noEmit, since Vite build does not perform type checking. Supabase integration, authentication, persistence and deployment are selected architecture, not implemented functionality yet. The phaser-vite-ts starter is registered locally with best-effort bootstrapper confidence. Scaffolding was completed and the production build and type check passed on 2026-09-16; the historical verification and dependency audit are recorded in context/changes/bootstrap-verification/verification-v2.md.
