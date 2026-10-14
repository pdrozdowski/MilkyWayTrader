import { randomUUID } from 'node:crypto';
import { test as base, type Page } from '@playwright/test';
import { prepareGameState, type GameStateFixtureOptions } from './gameStateFixture';
import type { PlanetId } from '../../src/game/state/planetState';
import { cleanupTestSession, createTestSession, seedGlobalScore, type SessionArtifact, type TestSessionMode } from '../testSessionSupport';

export interface TestSession
{
    readonly id: string;
    readonly testRunId: string;
    readonly mode: TestSessionMode;
    readonly anonymousId: string;
    readonly userId: string | null;
    readonly recordTiming: (name: string, durationMs: number) => void;
    readonly seedGlobalScore: (score: number) => Promise<string>;
}

type Fixtures = {
    readonly fixtureSetupStartedAt: number;
    readonly testSessionMode: TestSessionMode;
    readonly testRunId: string;
    readonly initialGameState: (GameStateFixtureOptions & { readonly planet: PlanetId }) | null;
    readonly testSession: TestSession;
    readonly gameStateSetup: void;
    readonly secondaryAuthenticatedPage: Page;
    readonly anonymousPage: Page;
};

export const test = base.extend<Fixtures>({
    fixtureSetupStartedAt: [async ({}, use) => { await use(performance.now()); }, { auto: true }],
    testSessionMode: ['anonymous', { option: true }],
    initialGameState: [null, { option: true }],
    testRunId: async ({}, use) => { await use(randomUUID()); },
    page: async ({ context, fixtureSetupStartedAt }, use, testInfo) => {
        const contextReadyAt = performance.now();
        const contextSetupMs = contextReadyAt - fixtureSetupStartedAt;
        const pageStartedAt = performance.now();
        const page = await context.newPage();
        const pageCreationMs = performance.now() - pageStartedAt;
        testInfo.annotations.push({
            type: 'fixture-timing',
            description: JSON.stringify([
                { name: 'Context fixture initialization (per-test)', durationMs: contextSetupMs },
                { name: 'Page creation (per-test)', durationMs: pageCreationMs },
                { name: 'Context + page initialization', durationMs: contextSetupMs + pageCreationMs }
            ])
        });
        await use(page);
    },
    testSession: async ({ page, testSessionMode, testRunId }, use, testInfo) => {
        const timings = testInfo.annotations.filter(annotation => annotation.type === 'fixture-timing')
            .flatMap(annotation => JSON.parse(annotation.description ?? '[]') as { name: string; durationMs: number }[]);
        const recordTiming = (name: string, durationMs: number): void => { timings.push({ name, durationMs }); };
        const sessionStartedAt = performance.now();
        const artifact = await createTestSession(testSessionMode, testRunId, recordTiming);
        recordTiming('Session setup total', performance.now() - sessionStartedAt);
        const injectStartedAt = performance.now();
        await page.addInitScript(session => {
            window.localStorage.setItem('milky-way-trader:anonymous_id', session.anonymousId);
            if (session.authStorageKey && session.authSession) window.localStorage.setItem(session.authStorageKey, JSON.stringify(session.authSession));
        }, artifact);
        recordTiming('Register authentication/session init script', performance.now() - injectStartedAt);
        try {
            await use({
                id: artifact.id,
                testRunId,
                mode: artifact.mode,
                anonymousId: artifact.anonymousId,
                userId: artifact.userId,
                recordTiming,
                seedGlobalScore: score => {
                    if (artifact.mode !== 'authenticated' || !artifact.userId) throw new Error('Global-score fixture requires an authenticated test session.');
                    return seedGlobalScore(artifact.id, score);
                }
            });
        } finally {
            const cleanupStartedAt = performance.now();
            await cleanupTestSession(artifact.id);
            recordTiming('Remove temporary session artifact', performance.now() - cleanupStartedAt);
            console.log(`FIXTURE_TIMINGS ${testInfo.title}: ${JSON.stringify(timings)}`);
        }
    },
    gameStateSetup: [async ({ page, initialGameState, testSession }, use) => {
        if (initialGameState) await prepareGameState(page, initialGameState.planet, initialGameState, testSession.recordTiming, testSession.testRunId);
        await use();
    }, { auto: true }],
    secondaryAuthenticatedPage: async ({ browser }, use) => {
        const artifact = await createTestSession('authenticated', randomUUID());
        const context = await browser.newContext();
        const page = await context.newPage();
        await page.addInitScript(initializeSession, artifact);
        try {
            await use(page);
        } finally {
            await context.close();
            await cleanupTestSession(artifact.id);
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


