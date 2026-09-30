import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests/ui',
    testMatch: /.*UiTest\.ts/,
    fullyParallel: false,
    // Phaser startup is the limiting resource; this deliberately small journey suite runs serially.
    workers: 1,
    forbidOnly: Boolean(process.env.CI),
    retries: 0,
    reporter: [
        ['list'],
        ['html', { outputFolder: '.cache/playwright/report', open: 'never' }]
    ],
    outputDir: '.cache/playwright/test-results',
    use: {
        baseURL: 'http://127.0.0.1:8080',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure'
    },
    projects: [
        { name: 'chromium', use: { browserName: 'chromium', viewport: { width: 1280, height: 800 } } }
    ],
    webServer: {
        command: 'npm run dev-nolog -- --host 127.0.0.1 --strictPort',
        url: 'http://127.0.0.1:8080',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        stdout: 'ignore',
        stderr: 'pipe'
    }
});
