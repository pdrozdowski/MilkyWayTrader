import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { test as base, type Page } from '@playwright/test';

const execute = promisify(execFile);
const sessionDirectory = resolve(process.cwd(), '.cache', 'playwright', 'sessions');

type SessionMode = 'anonymous' | 'authenticated';

interface SessionArtifact
{
    readonly id: string;
    readonly mode: SessionMode;
    readonly anonymousId: string;
    readonly userId: string | null;
    readonly authStorageKey: string | null;
    readonly authSession: unknown;
}

export interface TestSession
{
    readonly id: string;
    readonly mode: SessionMode;
    readonly anonymousId: string;
    readonly userId: string | null;
}

type Fixtures = {
    readonly testSessionMode: SessionMode;
    readonly testSession: TestSession;
    readonly secondaryAuthenticatedPage: Page;
    readonly anonymousPage: Page;
};

export const test = base.extend<Fixtures>({
    testSessionMode: ['anonymous', { option: true }],
    testSession: async ({ page, testSessionMode }, use) => {
        const artifact = await createSession(testSessionMode);
        await page.addInitScript(session => {
            window.localStorage.setItem('milky-way-trader:anonymous_id', session.anonymousId);
            if (session.authStorageKey && session.authSession) window.localStorage.setItem(session.authStorageKey, JSON.stringify(session.authSession));
        }, artifact);
        try {
            await use({ id: artifact.id, mode: artifact.mode, anonymousId: artifact.anonymousId, userId: artifact.userId });
        } finally {
            await cleanupSession(artifact);
        }
    },
    secondaryAuthenticatedPage: async ({ browser }, use) => {
        const artifact = await createSession('authenticated');
        const context = await browser.newContext();
        const page = await context.newPage();
        await page.addInitScript(initializeSession, artifact);
        try {
            await use(page);
        } finally {
            await context.close();
            await cleanupSession(artifact);
        }
    },
    anonymousPage: async ({ browser }, use) => {
        const context = await browser.newContext();
        const page = await context.newPage();
        try {
            await use(page);
        } finally {
            await context.close();
        }
    }
});

function initializeSession (session: SessionArtifact): void
{
    window.localStorage.setItem('milky-way-trader:anonymous_id', session.anonymousId);
    if (session.authStorageKey && session.authSession) window.localStorage.setItem(session.authStorageKey, JSON.stringify(session.authSession));
}

async function createSession (mode: SessionMode): Promise<SessionArtifact>
{
    const result = await execute(process.execPath, ['scripts/create-test-session.mjs', mode], {
        cwd: process.cwd(),
        env: process.env
    });
    const output = JSON.parse(result.stdout) as { sessionFile?: unknown };
    if (typeof output.sessionFile !== 'string' || !/^[0-9a-f-]+\.json$/u.test(output.sessionFile)) throw new Error('Test session setup returned an invalid artifact name.');
    return JSON.parse(await readFile(resolve(sessionDirectory, output.sessionFile), 'utf8')) as SessionArtifact;
}

async function cleanupSession (artifact: SessionArtifact): Promise<void>
{
    await execute(process.execPath, ['scripts/cleanup-test-session.mjs'], {
        cwd: process.cwd(),
        env: { ...process.env, PLAYWRIGHT_TEST_SESSION_FILE: `${artifact.id}.json` }
    });
}
