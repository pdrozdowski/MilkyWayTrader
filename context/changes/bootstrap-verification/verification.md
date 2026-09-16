---
bootstrapped_at: 2026-09-16T13:12:34Z
starter_id: phaser-vite-ts
starter_name: "Phaser 4 + Vite + TypeScript (official Phaser template)"
project_name: milky-way-trader
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: best-effort
phase_3_status: failed
audit_command: "npm audit --json"
---

## Hand-off

Verbatim hand-off frontmatter and rationale:

```markdown
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
```

## Pre-scaffold verification

| Signal | Value | Severity | Notes |
| --- | --- | --- | --- |
| npm package | not run | n/a | Command starts with git clone; no create-* npm CLI package. |
| GitHub repo | phaserjs/template-vite-ts last pushed 2026-04-21T08:31:29Z | aged | About five months before this run. Public GitHub API via Invoke-RestMethod; gh is unavailable. The initial sandbox request failed with a receive error; the escalated read succeeded. |

Source: https://api.github.com/repos/phaserjs/template-vite-ts

## Scaffold log

**Resolved invocation**: `git clone https://github.com/phaserjs/template-vite-ts .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`
**Executed invocation**: `git clone https://github.com/phaserjs/template-vite-ts .bootstrap-scaffold && cd .bootstrap-scaffold && npm.cmd install` (cmd.exe; npm.cmd is the Windows npm launcher).
**Strategy**: git-clone
**Exit code**: 128
**Files moved**: 0
**Conflicts (.scaffold siblings)**: none; merge was not run.
**.gitignore handling**: untouched; merge was not run.
**.bootstrap-scaffold cleanup**: no cleanup by bootstrapper; Git did not leave this directory after the failed clone.
**Dependency installation**: not run because clone failed.
**Stderr / captured CLI output**:

```text
Cloning into '.bootstrap-scaffold'...
fatal: unable to access 'https://github.com/phaserjs/template-vite-ts/': SSL certificate OpenSSL verify result: unable to get local issuer certificate (20)
```

**Failure diagnosis**: Git uses the OpenSSL SSL backend. Certificate verification failed with "unable to get local issuer certificate (20)". HTTPS verification was not disabled, and no Git configuration was changed.

**Original repository HEAD before bootstrap**: `1e11561f62d2060aeea02d09ea0ad2dbc14a2ede`.
**Original repository preservation**: no mutating command was run against the existing repository; file hashes are verified after this log is written.

## Post-scaffold audit

**Audit not run**: scaffold halted; no project to audit.

## Hints recorded but not acted on

| Hint | Value |
| --- | --- |
| bootstrapper_confidence | best-effort |
| quality_override | false |
| path_taken | custom |
| self_check_answers | typed: true; from_official_starter: true; conventions: true; docs_current: true; can_judge_agent: true |
| team_size | solo |
| deployment_target | cloudflare-pages |
| ci_provider | github-actions |
| ci_default_flow | auto-deploy-on-merge |
| has_auth | false |
| has_payments | false |
| has_realtime | false |
| has_ai | false |
| has_background_jobs | false |

The rationale's Playwright, ESLint, separate TypeScript check and agent context requests are preserved above. Bootstrapper v1 does not add these configurations; no files were scaffolded in this failed run.

## Next steps

Address Git's HTTPS certificate trust error, then re-invoke `/10x-bootstrapper`. For a retry, consider Git for Windows' `schannel` backend, scoped to the clone command, so it uses Windows certificate trust without modifying existing repository configuration. Preserve HTTPS verification.

A future skill will configure agent context after scaffolding succeeds.

