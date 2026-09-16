---
bootstrapped_at: 2026-09-16T13:26:30Z
starter_id: phaser-vite-ts
starter_name: "Phaser 4 + Vite + TypeScript (official Phaser template)"
project_name: milky-way-trader
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: best-effort
phase_3_status: ok
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
| npm package | not run | n/a | The template invokes git clone, not a create-* npm CLI. |
| GitHub repo | phaserjs/template-vite-ts last pushed 2026-04-21T08:31:29Z | aged | Public GitHub API successfully checked earlier on the same day. About five months old. gh is unavailable. |

Source: https://api.github.com/repos/phaserjs/template-vite-ts

## Scaffold log

**Resolved invocation**: `git clone https://github.com/phaserjs/template-vite-ts .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`
**Executed clone**: `git -c http.sslBackend=schannel clone https://github.com/phaserjs/template-vite-ts .bootstrap-scaffold`
**Strategy**: git-clone
**Final scaffold exit code**: 0, after recovering dependency installation as described below.
**Starter commit**: `d1d7d58acfcf47f97642bcb8b4967071b85f8db9`
**Starter files moved**: 23 (including two conflict siblings).
**Dependency directory moved**: `node_modules/`, 4115 files; moved as one directory.
**Conflicts (.scaffold siblings)**: `LICENSE.scaffold`, `README.md.scaffold`.
**.gitignore handling**: moved silently; no existing root .gitignore.
**.bootstrap-scaffold cleanup**: deleted after all files were moved; no leftovers.
**Upstream history handling**: only `.bootstrap-scaffold/.git/` was removed, after verifying its absolute path. The existing root `.git/` was not changed.
**Existing repository HEAD**: `1e11561f62d2060aeea02d09ea0ad2dbc14a2ede`.
**Preservation verification**: SHA-256 hashes of every pre-existing root file, context file (including the previous verification log) and .git file matched the pre-run snapshot. HEAD was unchanged.
**Log collision handling**: prior `verification.md` was preserved; this retry is recorded as `verification-v2.md`.

### Installation recovery

The user explicitly requested cloning into a temporary subdirectory, moving files up, deleting the temporary directory and continuing.

1. Git's OpenSSL certificate trust failed in the previous run. The clone used `-c http.sslBackend=schannel` for this command only and succeeded. This uses Windows certificate trust; existing local/global Git configuration was not modified. [Git configuration documentation](https://git-scm.com/docs/git-config#Documentation/git-config.txt-httpsslBackend).
2. `npm.cmd install` selected user-installed npm 8.14.0 and failed with `UNABLE_TO_VERIFY_LEAF_SIGNATURE`.
3. A retry with `NODE_USE_SYSTEM_CA=1` and the same npm launcher also failed.
4. A direct Node HTTPS check with `--use-system-ca` returned HTTP 200 from the public npm registry.
5. Installation succeeded using npm bundled with Node, invoked directly with `node --use-system-ca 'C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js' install`. No persistent npm configuration was modified; HTTPS verification remained enabled.

#### Initial clone and failed installation output (overall exit 1)

```text
Cloning into '.bootstrap-scaffold'...
npm ERR! code UNABLE_TO_VERIFY_LEAF_SIGNATURE
npm ERR! errno UNABLE_TO_VERIFY_LEAF_SIGNATURE
npm ERR! request to https://registry.npmjs.org/phaser failed, reason: unable to verify the first certificate; if the root CA is installed locally, try running Node.js with --use-system-ca

npm ERR! A complete log of this run can be found in:
npm ERR!     C:\Users\pdroz\AppData\Local\npm-cache\_logs\2026-09-16T13_22_15_642Z-debug-0.log
```

#### Second installation attempt output (exit 1)

```text
npm ERR! code UNABLE_TO_VERIFY_LEAF_SIGNATURE
npm ERR! errno UNABLE_TO_VERIFY_LEAF_SIGNATURE
npm ERR! request to https://registry.npmjs.org/phaser failed, reason: unable to verify the first certificate; if the root CA is installed locally, try running Node.js with --use-system-ca

npm ERR! A complete log of this run can be found in:
npm ERR!     C:\Users\pdroz\AppData\Local\npm-cache\_logs\2026-09-16T13_23_42_541Z-debug-0.log
```

#### Successful installation output (exit 0)

```text

added 28 packages, and audited 29 packages in 14s

5 packages are looking for funding
  run `npm fund` for details

5 high severity vulnerabilities

To address all issues, run:
  npm audit fix

Run `npm audit` for details.
npm warn install-scripts 1 package has install scripts not yet covered by allowScripts:
npm warn install-scripts   esbuild@0.25.2 (postinstall: node install.js)
npm warn install-scripts
npm warn install-scripts Run `npm install-scripts ls` to review, or `npm install-scripts approve <pkg>` to allow.
```

### File move log

| Starter path | Destination | Action |
| --- | --- | --- |
| .gitignore | .gitignore | moved |
| LICENSE | LICENSE.scaffold | conflict sibling |
| README.md | README.md.scaffold | conflict sibling |
| index.html | index.html | moved |
| log.js | log.js | moved |
| package-lock.json | package-lock.json | moved |
| package.json | package.json | moved |
| public/assets/bg.png | public/assets/bg.png | moved |
| public/assets/logo.png | public/assets/logo.png | moved |
| public/favicon.png | public/favicon.png | moved |
| public/style.css | public/style.css | moved |
| screenshot.png | screenshot.png | moved |
| src/game/main.ts | src/game/main.ts | moved |
| src/game/scenes/Boot.ts | src/game/scenes/Boot.ts | moved |
| src/game/scenes/Game.ts | src/game/scenes/Game.ts | moved |
| src/game/scenes/GameOver.ts | src/game/scenes/GameOver.ts | moved |
| src/game/scenes/MainMenu.ts | src/game/scenes/MainMenu.ts | moved |
| src/game/scenes/Preloader.ts | src/game/scenes/Preloader.ts | moved |
| src/main.ts | src/main.ts | moved |
| src/vite-env.d.ts | src/vite-env.d.ts | moved |
| tsconfig.json | tsconfig.json | moved |
| vite/config.dev.mjs | vite/config.dev.mjs | moved |
| vite/config.prod.mjs | vite/config.prod.mjs | moved |
| node_modules/ | node_modules/ | moved as one directory (4115 files) |

### Local verification

- Production build: passed, exit 0. Command: `node 'C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js' run build-nolog`.
- TypeScript: passed, exit 0. Command: `node node_modules/typescript/bin/tsc --noEmit`.
- Build artifacts: `dist/index.html` and the production JavaScript bundle in `dist/assets/` exist.
- All pre-existing context, root and .git file hashes are unchanged.
- Temporary scaffold directory is absent.
- The build-nolog script avoids the template's optional anonymous logging call.

#### Build output

```text

> template-vite-ts@1.4.0 build-nolog
> vite build --config vite/config.prod.mjs

Building for production...
---------------------------------------------------------
❤️❤️❤️ Tell us about your game! - games@phaser.io ❤️❤️❤️
---------------------------------------------------------
✨ Done ✨
```

## Post-scaffold audit

**Tool**: npm audit --json
**Executed command**: `node --use-system-ca 'C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js' audit --json`
**Exit code**: 1 (vulnerabilities found; informational).
**Summary**: 0 CRITICAL, 5 HIGH, 0 MODERATE, 0 LOW, 0 INFO.
**Direct vs transitive**: 1 HIGH direct (vite), 4 HIGH transitive (nanoid, picomatch, postcss, rollup).
**Automatic fixes**: not run; bootstrapper v1 reports findings without applying npm audit fix.

### CRITICAL findings

None.

### HIGH findings

### HIGH: nanoid

- Installed version(s): 3.3.11.
- Dependency: transitive.
- Affected range: `<=3.3.17`.
- Fix available: `true` (reported by npm; not applied).
- Advisory causes:
  - nanoid: non-secure generators can loop indefinitely with negative size; source 1138811; severity high; range `<3.3.16`; https://github.com/advisories/GHSA-28wg-ghj8-5hjv
  - nanoid: custom generators can loop indefinitely when size is zero; source 1139427; severity high; range `<3.3.18`; https://github.com/advisories/GHSA-2v37-7h3g-55p8
  - nanoid: Integer Overflow or Wraparound; source 1153189; severity high; range `<3.3.12`; https://github.com/advisories/GHSA-xwg4-73v4-xw9w

### HIGH: picomatch

- Installed version(s): 4.0.2.
- Dependency: transitive.
- Affected range: `4.0.0 - 4.0.3`.
- Fix available: `true` (reported by npm; not applied).
- Advisory causes:
  - Picomatch: Method Injection in POSIX Character Classes causes incorrect Glob Matching; source 1115551; severity moderate; range `>=4.0.0 <4.0.4`; https://github.com/advisories/GHSA-3v7f-55p6-f55p
  - Picomatch has a ReDoS vulnerability via extglob quantifiers; source 1115554; severity high; range `>=4.0.0 <4.0.4`; https://github.com/advisories/GHSA-c2c7-rcm5-vvqj

### HIGH: postcss

- Installed version(s): 8.5.3.
- Dependency: transitive.
- Affected range: `<=8.5.22`.
- Fix available: `true` (reported by npm; not applied).
- Advisory causes:
  - PostCSS has XSS via Unescaped </style> in its CSS Stringify Output; source 1117015; severity moderate; range `<8.5.10`; https://github.com/advisories/GHSA-qx2v-qp2m-jg93
  - PostCSS: Arbitrary file read and information disclosure via attacker-controlled sourceMappingURL in CSS comments; source 1124252; severity high; range `<=8.5.11`; https://github.com/advisories/GHSA-6g55-p6wh-862q
  - PostCSS: incomplete fix of GHSA-6g55-p6wh-862q — attacker-controlled sourceMappingURL reads arbitrary .map files when `from` is unset; source 1130709; severity moderate; range `<=8.5.22`; https://github.com/advisories/GHSA-fxqj-rqcc-2cmp
  - PostCSS: Path Traversal in Previous Source Map Auto-Loading (sourceMappingURL) leads to Arbitrary .map File Disclosure; source 1139510; severity high; range `<=8.5.17`; https://github.com/advisories/GHSA-r28c-9q8g-f849

### HIGH: rollup

- Installed version(s): 4.40.0.
- Dependency: transitive.
- Affected range: `4.0.0 - 4.58.0`.
- Fix available: `true` (reported by npm; not applied).
- Advisory causes:
  - Rollup 4 has Arbitrary File Write via Path Traversal; source 1113515; severity high; range `>=4.0.0 <4.59.0`; https://github.com/advisories/GHSA-mw96-cpmx-2vgc

### HIGH: vite

- Installed version(s): 6.3.2.
- Dependency: direct.
- Affected range: `<=6.4.2`.
- Fix available: `true` (reported by npm; not applied).
- Advisory causes:
  - Vite's server.fs.deny bypassed with /. for files under project root; source 1104176; severity moderate; range `>=6.3.0 <=6.3.3`; https://github.com/advisories/GHSA-859w-5945-r5v3
  - Vite middleware may serve files starting with the same name with the public directory; source 1107324; severity low; range `>=6.0.0 <=6.3.5`; https://github.com/advisories/GHSA-g4jq-h2w9-997c
  - Vite's `server.fs` settings were not applied to HTML files; source 1107328; severity low; range `>=6.0.0 <=6.3.5`; https://github.com/advisories/GHSA-jqfw-vq24-v9c3
  - vite allows server.fs.deny bypass via backslash on Windows; source 1109135; severity moderate; range `>=6.0.0 <=6.4.0`; https://github.com/advisories/GHSA-93m4-6634-74q7
  - Vite Vulnerable to Path Traversal in Optimized Deps `.map` Handling; source 1116229; severity moderate; range `<=6.4.1`; https://github.com/advisories/GHSA-4w7w-66w2-5vf9
  - Vite Vulnerable to Arbitrary File Read via Vite Dev Server WebSocket; source 1116234; severity high; range `>=6.0.0 <=6.4.1`; https://github.com/advisories/GHSA-p9ff-h696-f583
  - launch-editor: NTLMv2 hash disclosure via UNC path handling on Windows; source 1120784; severity moderate; range `<=6.4.2`; https://github.com/advisories/GHSA-v6wh-96g9-6wx3
  - vite: `server.fs.deny` bypass on Windows alternate paths; source 1123525; severity high; range `<=6.4.2`; https://github.com/advisories/GHSA-fx2h-pf6j-xcff


### MODERATE findings

None.

### LOW / INFO findings

None.

### Raw audit output

```json
{
  "auditReportVersion": 2,
  "vulnerabilities": {
    "nanoid": {
      "name": "nanoid",
      "severity": "high",
      "isDirect": false,
      "via": [
        {
          "source": 1138811,
          "name": "nanoid",
          "dependency": "nanoid",
          "title": "nanoid: non-secure generators can loop indefinitely with negative size",
          "url": "https://github.com/advisories/GHSA-28wg-ghj8-5hjv",
          "severity": "high",
          "cwe": [
            "CWE-835"
          ],
          "cvss": {
            "score": 5.9,
            "vectorString": "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:N/A:H"
          },
          "range": "<3.3.16"
        },
        {
          "source": 1139427,
          "name": "nanoid",
          "dependency": "nanoid",
          "title": "nanoid: custom generators can loop indefinitely when size is zero",
          "url": "https://github.com/advisories/GHSA-2v37-7h3g-55p8",
          "severity": "high",
          "cwe": [
            "CWE-835"
          ],
          "cvss": {
            "score": 5.9,
            "vectorString": "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:N/A:H"
          },
          "range": "<3.3.18"
        },
        {
          "source": 1153189,
          "name": "nanoid",
          "dependency": "nanoid",
          "title": "nanoid: Integer Overflow or Wraparound",
          "url": "https://github.com/advisories/GHSA-xwg4-73v4-xw9w",
          "severity": "high",
          "cwe": [
            "CWE-190"
          ],
          "cvss": {
            "score": 7.4,
            "vectorString": "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:N"
          },
          "range": "<3.3.12"
        }
      ],
      "effects": [],
      "range": "<=3.3.17",
      "nodes": [
        "node_modules/nanoid"
      ],
      "fixAvailable": true
    },
    "picomatch": {
      "name": "picomatch",
      "severity": "high",
      "isDirect": false,
      "via": [
        {
          "source": 1115551,
          "name": "picomatch",
          "dependency": "picomatch",
          "title": "Picomatch: Method Injection in POSIX Character Classes causes incorrect Glob Matching",
          "url": "https://github.com/advisories/GHSA-3v7f-55p6-f55p",
          "severity": "moderate",
          "cwe": [
            "CWE-1321"
          ],
          "cvss": {
            "score": 5.3,
            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:L/A:N"
          },
          "range": ">=4.0.0 <4.0.4"
        },
        {
          "source": 1115554,
          "name": "picomatch",
          "dependency": "picomatch",
          "title": "Picomatch has a ReDoS vulnerability via extglob quantifiers",
          "url": "https://github.com/advisories/GHSA-c2c7-rcm5-vvqj",
          "severity": "high",
          "cwe": [
            "CWE-1333"
          ],
          "cvss": {
            "score": 7.5,
            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"
          },
          "range": ">=4.0.0 <4.0.4"
        }
      ],
      "effects": [],
      "range": "4.0.0 - 4.0.3",
      "nodes": [
        "node_modules/picomatch"
      ],
      "fixAvailable": true
    },
    "postcss": {
      "name": "postcss",
      "severity": "high",
      "isDirect": false,
      "via": [
        {
          "source": 1117015,
          "name": "postcss",
          "dependency": "postcss",
          "title": "PostCSS has XSS via Unescaped </style> in its CSS Stringify Output",
          "url": "https://github.com/advisories/GHSA-qx2v-qp2m-jg93",
          "severity": "moderate",
          "cwe": [
            "CWE-79"
          ],
          "cvss": {
            "score": 6.1,
            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N"
          },
          "range": "<8.5.10"
        },
        {
          "source": 1124252,
          "name": "postcss",
          "dependency": "postcss",
          "title": "PostCSS: Arbitrary file read and information disclosure via attacker-controlled sourceMappingURL in CSS comments",
          "url": "https://github.com/advisories/GHSA-6g55-p6wh-862q",
          "severity": "high",
          "cwe": [
            "CWE-22",
            "CWE-200"
          ],
          "cvss": {
            "score": 7.5,
            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N"
          },
          "range": "<=8.5.11"
        },
        {
          "source": 1130709,
          "name": "postcss",
          "dependency": "postcss",
          "title": "PostCSS: incomplete fix of GHSA-6g55-p6wh-862q — attacker-controlled sourceMappingURL reads arbitrary .map files when `from` is unset",
          "url": "https://github.com/advisories/GHSA-fxqj-rqcc-2cmp",
          "severity": "moderate",
          "cwe": [
            "CWE-22",
            "CWE-200"
          ],
          "cvss": {
            "score": 0,
            "vectorString": null
          },
          "range": "<=8.5.22"
        },
        {
          "source": 1139510,
          "name": "postcss",
          "dependency": "postcss",
          "title": "PostCSS: Path Traversal in Previous Source Map Auto-Loading (sourceMappingURL) leads to Arbitrary .map File Disclosure",
          "url": "https://github.com/advisories/GHSA-r28c-9q8g-f849",
          "severity": "high",
          "cwe": [
            "CWE-22"
          ],
          "cvss": {
            "score": 7.5,
            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N"
          },
          "range": "<=8.5.17"
        }
      ],
      "effects": [],
      "range": "<=8.5.22",
      "nodes": [
        "node_modules/postcss"
      ],
      "fixAvailable": true
    },
    "rollup": {
      "name": "rollup",
      "severity": "high",
      "isDirect": false,
      "via": [
        {
          "source": 1113515,
          "name": "rollup",
          "dependency": "rollup",
          "title": "Rollup 4 has Arbitrary File Write via Path Traversal",
          "url": "https://github.com/advisories/GHSA-mw96-cpmx-2vgc",
          "severity": "high",
          "cwe": [
            "CWE-22"
          ],
          "cvss": {
            "score": 0,
            "vectorString": null
          },
          "range": ">=4.0.0 <4.59.0"
        }
      ],
      "effects": [],
      "range": "4.0.0 - 4.58.0",
      "nodes": [
        "node_modules/rollup"
      ],
      "fixAvailable": true
    },
    "vite": {
      "name": "vite",
      "severity": "high",
      "isDirect": true,
      "via": [
        {
          "source": 1104176,
          "name": "vite",
          "dependency": "vite",
          "title": "Vite's server.fs.deny bypassed with /. for files under project root",
          "url": "https://github.com/advisories/GHSA-859w-5945-r5v3",
          "severity": "moderate",
          "cwe": [
            "CWE-22"
          ],
          "cvss": {
            "score": 0,
            "vectorString": null
          },
          "range": ">=6.3.0 <=6.3.3"
        },
        {
          "source": 1107324,
          "name": "vite",
          "dependency": "vite",
          "title": "Vite middleware may serve files starting with the same name with the public directory",
          "url": "https://github.com/advisories/GHSA-g4jq-h2w9-997c",
          "severity": "low",
          "cwe": [
            "CWE-22",
            "CWE-200",
            "CWE-284"
          ],
          "cvss": {
            "score": 0,
            "vectorString": null
          },
          "range": ">=6.0.0 <=6.3.5"
        },
        {
          "source": 1107328,
          "name": "vite",
          "dependency": "vite",
          "title": "Vite's `server.fs` settings were not applied to HTML files",
          "url": "https://github.com/advisories/GHSA-jqfw-vq24-v9c3",
          "severity": "low",
          "cwe": [
            "CWE-23",
            "CWE-200",
            "CWE-284"
          ],
          "cvss": {
            "score": 0,
            "vectorString": null
          },
          "range": ">=6.0.0 <=6.3.5"
        },
        {
          "source": 1109135,
          "name": "vite",
          "dependency": "vite",
          "title": "vite allows server.fs.deny bypass via backslash on Windows",
          "url": "https://github.com/advisories/GHSA-93m4-6634-74q7",
          "severity": "moderate",
          "cwe": [
            "CWE-22"
          ],
          "cvss": {
            "score": 0,
            "vectorString": null
          },
          "range": ">=6.0.0 <=6.4.0"
        },
        {
          "source": 1116229,
          "name": "vite",
          "dependency": "vite",
          "title": "Vite Vulnerable to Path Traversal in Optimized Deps `.map` Handling",
          "url": "https://github.com/advisories/GHSA-4w7w-66w2-5vf9",
          "severity": "moderate",
          "cwe": [
            "CWE-22",
            "CWE-200"
          ],
          "cvss": {
            "score": 0,
            "vectorString": null
          },
          "range": "<=6.4.1"
        },
        {
          "source": 1116234,
          "name": "vite",
          "dependency": "vite",
          "title": "Vite Vulnerable to Arbitrary File Read via Vite Dev Server WebSocket",
          "url": "https://github.com/advisories/GHSA-p9ff-h696-f583",
          "severity": "high",
          "cwe": [
            "CWE-200",
            "CWE-306"
          ],
          "cvss": {
            "score": 0,
            "vectorString": null
          },
          "range": ">=6.0.0 <=6.4.1"
        },
        {
          "source": 1120784,
          "name": "vite",
          "dependency": "vite",
          "title": "launch-editor: NTLMv2 hash disclosure via UNC path handling on Windows",
          "url": "https://github.com/advisories/GHSA-v6wh-96g9-6wx3",
          "severity": "moderate",
          "cwe": [
            "CWE-73",
            "CWE-522"
          ],
          "cvss": {
            "score": 0,
            "vectorString": null
          },
          "range": "<=6.4.2"
        },
        {
          "source": 1123525,
          "name": "vite",
          "dependency": "vite",
          "title": "vite: `server.fs.deny` bypass on Windows alternate paths",
          "url": "https://github.com/advisories/GHSA-fx2h-pf6j-xcff",
          "severity": "high",
          "cwe": [
            "CWE-22",
            "CWE-200"
          ],
          "cvss": {
            "score": 7.5,
            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N"
          },
          "range": "<=6.4.2"
        }
      ],
      "effects": [],
      "range": "<=6.4.2",
      "nodes": [
        "node_modules/vite"
      ],
      "fixAvailable": true
    }
  },
  "metadata": {
    "vulnerabilities": {
      "info": 0,
      "low": 0,
      "moderate": 0,
      "high": 5,
      "critical": 0,
      "total": 5
    },
    "dependencies": {
      "prod": 15,
      "dev": 58,
      "optional": 46,
      "peer": 0,
      "peerOptional": 0,
      "total": 72
    }
  }
}
```

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

The hand-off rationale requests Playwright, ESLint, a separate TypeScript check and agent conventions. Bootstrapper v1 does not add these configurations or generate agent/CI files. The existing TypeScript compiler was run directly for verification, without adding a new script.

## Next steps

Your project is scaffolded and verified. A future skill will configure agent context.

- Start local development: `npm run dev-nolog` (default URL: http://localhost:8080).
- Review `README.md.scaffold` and `LICENSE.scaffold` to compare starter documentation and license with preserved project files.
- Review the five HIGH audit findings before deploying; npm reports fixes available, but no fixes were applied during bootstrap.
- Configure Playwright, ESLint and a dedicated type-check script as a follow-up.
- The existing repository already has its own history; no git init is needed.

