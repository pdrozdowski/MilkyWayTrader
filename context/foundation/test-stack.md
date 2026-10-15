# Test stack

## E2E

<!-- Written by /10x-e2e-setup. Re-run it to change this section; other skills only read it. -->

- runner: Playwright Test, @playwright/test 1.63.0
- config: playwrightConfig.ts
- single-spec command: npm.cmd run playwright:test -- tests/ui/<name>UiTest.ts
- full-suite command: npm.cmd run test:ui
- base URL: http://127.0.0.1:8081
- port: 8081 (playwrightConfig.ts webServer; no E2E_PORT override; detected port 8081)
- web server command: npm run dev:test-nolog -- --host 127.0.0.1 --port 8081 --strictPort; reuseExistingServer: false
- auth setup project: none; tests/ui/testSessionFixture.ts provisions isolated local authenticated or anonymous sessions
- storageState: none; the fixture injects local session state into each browser context
- seed: none; each UI scenario provisions its own data through the session fixture or its test flow
- browser CLI: playwright-cli 0.1.22; command skill unavailable, use --help only
- updated: 2026-10-14
