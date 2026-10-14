import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests',
    testMatch: /.*(?:UiTest|IntegrationTest)\.ts/,
    fullyParallel: false,
    // Phaser startup is the limiting resource; this deliberately small journey suite runs serially.
    workers: 1,
    timeout: 60_000,
    globalTimeout: 15 * 60_000,
    forbidOnly: Boolean(process.env.CI),
    retries: 0,
    reporter: [
        ['list'],
        ['html', { outputFolder: '.cache/playwright/report', open: 'never' }]
    ],
    outputDir: '.cache/playwright/test-results',
    globalSetup: './tests/ui/globalSetup.ts',
    globalTeardown: './tests/ui/globalTeardown.ts',
    use: {
        baseURL: 'http://127.0.0.1:8081',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure'
    },
    projects: [
        { name: 'chromium', use: { browserName: 'chromium', viewport: { width: 1280, height: 800 } } }
    ],
    webServer: {
        command: 'npm run dev:test-nolog -- --host 127.0.0.1 --port 8081 --strictPort',
        url: 'http://127.0.0.1:8081',
        reuseExistingServer: false,
        timeout: 120_000,
        stdout: 'ignore',
        stderr: 'pipe'
    }
});
