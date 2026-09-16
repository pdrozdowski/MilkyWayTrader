---
starter_id: phaser-vite-ts
package_manager: npm
project_name: milky-way-trader
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
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
  has_auth: false
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
---

## Why this stack

MilkyWayTrader uses the official Phaser Vite TypeScript template, currently shipping Phaser 4.0.0, Vite 6.3.1 and TypeScript 5.7.2, to deliver a single-player browser game within a one-week, after-hours MVP budget. Phaser handles the map and animations, while native HTML5/CSS provides market, cargo and session controls. Keep game economy functions independent of Phaser scenes for testability. During bootstrap add Playwright for UI tests, ESLint with typescript-eslint for readable, consistent TypeScript, and a separate tsc --noEmit type check. Use the official template layout, version-matched Phaser 4 source and types, and document game-logic and UI conventions in AGENTS.md. The first release is anonymous; Google login, cloud persistence and leaderboards are deferred. Use npm, Cloudflare Pages and GitHub Actions with automatic deployment on merge to main. This custom starter is registered locally with best-effort bootstrapper confidence; scaffolding and tool configuration remain unverified.

