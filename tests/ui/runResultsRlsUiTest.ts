import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { expect } from '@playwright/test';
import { test } from './testSessionFixture';

interface RunResultRow
{
    readonly run_id: string;
    readonly user_id: string;
    readonly outcome: 'death';
    readonly active_elapsed_ms: number;
    readonly final_credits: number;
}

interface RestResult
{
    readonly status: number;
    readonly body: unknown;
}

// Browser risk: the local Supabase RLS policies can only be proven with distinct real browser sessions, not adapter fakes.
// This uniquely verifies public-key REST authorization for owner, other authenticated user, and anonymous browser contexts.
test.describe('local run-results RLS', () => {
    test.use({ testSessionMode: 'authenticated' });

    test('an owner can insert and select a result while another user and an anonymous browser cannot access it', async ({ page, testSession, secondaryAuthenticatedPage, anonymousPage }) => {
        test.setTimeout(60_000);
        expect(testSession.mode).toBe('authenticated');
        const runId = randomUUID();
        const owner = await runResultsRequest(page, '/run_results', {
            method: 'POST',
            body: { run_id: runId, outcome: 'death', active_elapsed_ms: 1_234, final_credits: 5_678 }
        });
        expect(owner.status).toBe(201);

        const ownerRows = await runResultsRequest(page, `/run_results?run_id=eq.${runId}&select=run_id,outcome,active_elapsed_ms,final_credits`);
        expect(ownerRows.status).toBe(200);
        assert.deepEqual(ownerRows.body, [{ run_id: runId, outcome: 'death', active_elapsed_ms: 1234, final_credits: 5678 }]);

        const otherUserRows = await runResultsRequest(secondaryAuthenticatedPage, `/run_results?run_id=eq.${runId}&select=run_id`);
        expect(otherUserRows.status).toBe(200);
        expect(otherUserRows.body).toEqual([]);

        const anonymousInsert = await runResultsRequest(anonymousPage, '/run_results', {
            method: 'POST',
            body: { run_id: randomUUID(), outcome: 'death', active_elapsed_ms: 1, final_credits: 1 }
        });
        expect(anonymousInsert.status).toBe(401);
        const anonymousRows = await runResultsRequest(anonymousPage, `/run_results?run_id=eq.${runId}&select=run_id`);
        expect(anonymousRows.status).toBe(401);
    });
});

async function runResultsRequest (page: import('@playwright/test').Page, path: string, request: { method?: 'POST'; body?: Omit<RunResultRow, 'user_id'> } = {}): Promise<RestResult>
{
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    return page.evaluate(async ({ path, request }) => {
        const configurationModulePath = '/src/game/application/auth/configuration.ts';
        const { browserAuthConfiguration } = await import(/* @vite-ignore */ configurationModulePath) as {
            browserAuthConfiguration: () => { url?: string; publishableKey?: string };
        };
        const configuration = browserAuthConfiguration();
        if (!configuration.url || !configuration.publishableKey) throw new Error('Missing public Supabase browser configuration.');
        const serializedSession = Object.keys(window.localStorage)
            .filter(key => key.startsWith('sb-') && key.endsWith('-auth-token'))
            .map(key => window.localStorage.getItem(key))
            .find((value): value is string => value !== null);
        const session = serializedSession ? JSON.parse(serializedSession) as { access_token?: string; user?: { id?: string } } : null;
        const body = request.body && session?.user?.id ? { ...request.body, user_id: session.user.id } : request.body;
        const response = await fetch(`${configuration.url}/rest/v1${path}`, {
            method: request.method ?? 'GET',
            headers: {
                apikey: configuration.publishableKey,
                ...(session?.access_token ? { authorization: `Bearer ${session.access_token}` } : {}),
                ...(body ? { 'content-type': 'application/json', prefer: 'return=representation' } : {})
            },
            ...(body ? { body: JSON.stringify(body) } : {})
        });
        return { status: response.status, body: await response.json() };
    }, { path, request });
}
