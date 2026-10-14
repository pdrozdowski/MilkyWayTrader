import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { expect, type APIRequestContext } from '@playwright/test';
import { test, type AuthenticatedTestIdentity } from './testSessionFixture';
import type { PublicTestEnvironment } from '../testSessionSupport';

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

// Database integration risk: run-result RLS could allow anonymous writes or cross-user reads.
// A real local Supabase JWT and public PostgREST endpoint exercise the PostgreSQL policy without booting the UI.
test('an owner can save a result while another user and anonymous clients cannot access it', async ({ request, testRunId, supabaseTestEnvironment, authenticatedIdentity, secondaryAuthenticatedIdentity }) => {
    test.setTimeout(30_000);
    const runId = testRunId;
    const owner = await runResultsRequest(request, supabaseTestEnvironment, authenticatedIdentity, '/run_results', {
        method: 'POST',
        body: { run_id: runId, user_id: authenticatedIdentity.userId, outcome: 'death', active_elapsed_ms: 1_234, final_credits: 5_678 }
    });
    expect(owner.status).toBe(201);

    const ownerRows = await runResultsRequest(request, supabaseTestEnvironment, authenticatedIdentity, `/run_results?run_id=eq.${runId}&select=run_id,outcome,active_elapsed_ms,final_credits`);
    expect(ownerRows.status).toBe(200);
    assert.deepEqual(ownerRows.body, [{ run_id: runId, outcome: 'death', active_elapsed_ms: 1234, final_credits: 5678 }]);

    const otherUserRows = await runResultsRequest(request, supabaseTestEnvironment, secondaryAuthenticatedIdentity, `/run_results?run_id=eq.${runId}&select=run_id`);
    expect(otherUserRows.status).toBe(200);
    expect(otherUserRows.body).toEqual([]);

    const anonymousInsert = await runResultsRequest(request, supabaseTestEnvironment, null, '/run_results', {
        method: 'POST',
        body: { run_id: randomUUID(), user_id: authenticatedIdentity.userId, outcome: 'death', active_elapsed_ms: 1, final_credits: 1 }
    });
    expect(anonymousInsert.status).toBe(401);
    const anonymousRows = await runResultsRequest(request, supabaseTestEnvironment, null, `/run_results?run_id=eq.${runId}&select=run_id`);
    expect(anonymousRows.status).toBe(401);
});

async function runResultsRequest (
    request: APIRequestContext,
    environment: PublicTestEnvironment,
    identity: AuthenticatedTestIdentity | null,
    path: string,
    operation: { readonly method?: 'POST'; readonly body?: Omit<RunResultRow, never> } = {}
): Promise<RestResult>
{
    const response = await request.fetch(new URL(`/rest/v1${path}`, environment.url).toString(), {
        method: operation.method ?? 'GET',
        timeout: 10_000,
        headers: {
            apikey: environment.publishableKey,
            ...(identity ? { authorization: `Bearer ${identity.accessToken}` } : {}),
            ...(operation.body ? { 'content-type': 'application/json', prefer: 'return=representation' } : {})
        },
        ...(operation.body ? { data: operation.body } : {})
    });
    return { status: response.status(), body: await response.json() };
}
