import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { expect, type APIRequestContext } from '@playwright/test';
import { test, type AuthenticatedTestIdentity } from './testSessionFixture';
import type { PublicTestEnvironment } from '../testSessionSupport';

interface RunResultRow
{
    readonly run_id: string;
    readonly user_id: string;
    readonly outcome: 'death' | 'freedom' | 'imprisonment';
    readonly active_elapsed_ms: number;
    readonly final_credits: number;
    readonly final_score: number;
}

interface RestResult
{
    readonly status: number;
    readonly body: unknown;
}

interface RunResultSeed
{
    readonly run_id: string;
    readonly user_id: string;
    readonly outcome: 'death' | 'freedom' | 'imprisonment';
    readonly active_elapsed_ms: number;
    readonly final_credits: number;
    readonly final_score: number;
}

// Database integration risk: run-result RLS could allow anonymous writes or cross-user reads.
// A real local Supabase JWT and public PostgREST endpoint exercise the PostgreSQL policy without booting the UI.
test('an owner can save a result while another user and anonymous clients cannot access it', async ({ request, testRunId, supabaseTestEnvironment, authenticatedIdentity, secondaryAuthenticatedIdentity }) => {
    test.setTimeout(30_000);
    const runId = testRunId;
    const owner = await runResultsRequest(request, supabaseTestEnvironment, authenticatedIdentity, '/run_results', {
        method: 'POST',
        body: { run_id: runId, user_id: authenticatedIdentity.userId, outcome: 'death', active_elapsed_ms: 1_234, final_credits: 5_678, final_score: 6_789 }
    });
    expect(owner.status).toBe(201);

    const timedOutRuns = ['freedom', 'imprisonment'] as const;
    const timeoutRunIds: string[] = [];
    for (const [index, outcome] of timedOutRuns.entries()) {
        const timeoutRunId = randomUUID();
        timeoutRunIds.push(timeoutRunId);
        const response = await runResultsRequest(request, supabaseTestEnvironment, authenticatedIdentity, '/run_results', {
            method: 'POST',
            body: { run_id: timeoutRunId, user_id: authenticatedIdentity.userId, outcome, active_elapsed_ms: 1_234 + index, final_credits: 5_678, final_score: 6_789 }
        });
        expect(response.status).toBe(201);
    }
    const timeoutFilter = `?run_id=in.(${timeoutRunIds.join(',')})&select=run_id,outcome`;
    const savedTimeoutRows = await runResultsRequest(request, supabaseTestEnvironment, authenticatedIdentity, `/run_results${timeoutFilter}`);
    expect(savedTimeoutRows.body).toEqual(expect.arrayContaining([{ run_id: timeoutRunIds[0], outcome: 'freedom' }, { run_id: timeoutRunIds[1], outcome: 'imprisonment' }]));
    expect(savedTimeoutRows.body).toHaveLength(2);
    const isolatedTimeoutRows = await runResultsRequest(request, supabaseTestEnvironment, secondaryAuthenticatedIdentity, `/run_results${timeoutFilter}`);
    expect(isolatedTimeoutRows.body).toEqual([]);
    expect((await runResultsRequest(request, supabaseTestEnvironment, null, `/run_results${timeoutFilter}`)).status).toBe(401);
    const unknownOutcome = await runResultsRequest(request, supabaseTestEnvironment, authenticatedIdentity, '/run_results', {
        method: 'POST',
        body: { run_id: randomUUID(), user_id: authenticatedIdentity.userId, outcome: 'unknown', active_elapsed_ms: 1, final_credits: 1, final_score: 1 } as unknown as RunResultRow
    });
    expect(unknownOutcome.status).toBe(400);

    const ownerRows = await runResultsRequest(request, supabaseTestEnvironment, authenticatedIdentity, `/run_results?run_id=eq.${runId}&select=run_id,outcome,active_elapsed_ms,final_credits,final_score`);
    expect(ownerRows.status).toBe(200);
    assert.deepEqual(ownerRows.body, [{ run_id: runId, outcome: 'death', active_elapsed_ms: 1234, final_credits: 5678, final_score: 6789 }]);

    const otherUserRows = await runResultsRequest(request, supabaseTestEnvironment, secondaryAuthenticatedIdentity, `/run_results?run_id=eq.${runId}&select=run_id`);
    expect(otherUserRows.status).toBe(200);
    expect(otherUserRows.body).toEqual([]);

    const anonymousInsert = await runResultsRequest(request, supabaseTestEnvironment, null, '/run_results', {
        method: 'POST',
        body: { run_id: randomUUID(), user_id: authenticatedIdentity.userId, outcome: 'death', active_elapsed_ms: 1, final_credits: 1, final_score: 1 }
    });
    expect(anonymousInsert.status).toBe(401);
    const anonymousRows = await runResultsRequest(request, supabaseTestEnvironment, null, `/run_results?run_id=eq.${runId}&select=run_id`);
    expect(anonymousRows.status).toBe(401);
});

test('owners can delete one result and clear their history without changing global scores', async ({ request, testRunId, supabaseTestEnvironment, authenticatedIdentity, secondaryAuthenticatedIdentity }) => {
    test.setTimeout(30_000);
    const firstRunId = randomUUID();
    const remainingRunId = randomUUID();
    const nickname = `Delete${testRunId.replace(/-/gu, '').slice(0, 8)}`;
    // Keep the fixture below the ranking assertions in the following test, since global scores
    // intentionally survive this history-deletion scenario for the rest of the suite.
    const score = 7;
    await profileRequest(request, supabaseTestEnvironment, authenticatedIdentity, nickname);
    expect((await rpcRequest(request, supabaseTestEnvironment, authenticatedIdentity, 'submit_global_score', { submitted_score: score })).status).toBe(204);
    const globalBefore = (await globalRows(request, supabaseTestEnvironment, null)).find(row => row.nickname === nickname);
    expect(globalBefore?.score).toBe(score);

    for (const [index, runId] of [firstRunId, remainingRunId].entries()) {
        const row: RunResultSeed = {
            run_id: runId,
            user_id: authenticatedIdentity.userId,
            outcome: 'death',
            active_elapsed_ms: 1_000 + index,
            final_credits: 2_000 + index,
            final_score: 3_000 + index
        };
        expect((await runResultsRequest(request, supabaseTestEnvironment, authenticatedIdentity, '/run_results', { method: 'POST', body: row })).status).toBe(201);
    }

    const ownerFilter = `?run_id=in.(${firstRunId},${remainingRunId})&select=run_id`;
    const otherUserDelete = await runResultsRequest(request, supabaseTestEnvironment, secondaryAuthenticatedIdentity, `/run_results?run_id=eq.${firstRunId}&select=run_id`, { method: 'DELETE' });
    expect(otherUserDelete.status).toBe(200);
    expect(otherUserDelete.body).toEqual([]);
    const anonymousDelete = await runResultsRequest(request, supabaseTestEnvironment, null, `/run_results?run_id=eq.${remainingRunId}&select=run_id`, { method: 'DELETE' });
    expect(anonymousDelete.status).toBe(401);

    const afterDeniedDeletes = await runResultsRequest(request, supabaseTestEnvironment, authenticatedIdentity, `/run_results${ownerFilter}`);
    expect((afterDeniedDeletes.body as { run_id: string }[]).map(row => row.run_id).sort()).toEqual([firstRunId, remainingRunId].sort());

    const ownerDelete = await runResultsRequest(request, supabaseTestEnvironment, authenticatedIdentity, `/run_results?run_id=eq.${firstRunId}&select=run_id`, { method: 'DELETE' });
    expect(ownerDelete.status).toBe(200);
    expect(ownerDelete.body).toEqual([{ run_id: firstRunId }]);
    const clearHistory = await runResultsRequest(request, supabaseTestEnvironment, authenticatedIdentity, `/run_results?user_id=eq.${authenticatedIdentity.userId}&select=run_id`, { method: 'DELETE' });
    expect(clearHistory.status).toBe(200);
    expect(clearHistory.body).toEqual([{ run_id: remainingRunId }]);

    const remainingHistory = await runResultsRequest(request, supabaseTestEnvironment, authenticatedIdentity, `/run_results${ownerFilter}`);
    expect(remainingHistory.body).toEqual([]);
    const globalEntry = (await globalRows(request, supabaseTestEnvironment, null)).find(row => row.nickname === nickname);
    expect(globalEntry?.score).toBe(score);
    expect(globalEntry?.achieved_at).toBe(globalBefore?.achieved_at);
});

test('global score RPC keeps the strict best, exposes a safe ranked projection, and ranks private PB scores', async ({ request, testRunId, supabaseTestEnvironment, authenticatedIdentity, secondaryAuthenticatedIdentity }) => {
    test.setTimeout(30_000);
    const nickname = `Score${testRunId.replace(/-/gu, '').slice(0, 8)}`;
    const secondNickname = `${nickname}X`;
    await profileRequest(request, supabaseTestEnvironment, authenticatedIdentity, nickname);
    await profileRequest(request, supabaseTestEnvironment, secondaryAuthenticatedIdentity, secondNickname);

    const first = await rpcRequest(request, supabaseTestEnvironment, authenticatedIdentity, 'submit_global_score', { submitted_score: 500 });
    expect(first.status).toBe(204);
    const initial = await globalRows(request, supabaseTestEnvironment, null);
    const ownerRow = initial.find(row => row.nickname === nickname);
    expect(ownerRow).toBeDefined();
    const achievedAt = ownerRow?.achieved_at;
    const currentNickname = `${nickname}Y`;
    await profileRequest(request, supabaseTestEnvironment, authenticatedIdentity, currentNickname);
    expect((await globalRows(request, supabaseTestEnvironment, null)).some(row => row.nickname === currentNickname)).toBe(true);

    expect((await rpcRequest(request, supabaseTestEnvironment, authenticatedIdentity, 'submit_global_score', { submitted_score: 500 })).status).toBe(204);
    expect((await rpcRequest(request, supabaseTestEnvironment, authenticatedIdentity, 'submit_global_score', { submitted_score: 400 })).status).toBe(204);
    const unchanged = (await globalRows(request, supabaseTestEnvironment, null)).find(row => row.nickname === currentNickname);
    expect(unchanged?.score).toBe(500);
    expect(unchanged?.achieved_at).toBe(achievedAt);

    await rpcRequest(request, supabaseTestEnvironment, secondaryAuthenticatedIdentity, 'submit_global_score', { submitted_score: 500 });
    const tied = await globalRows(request, supabaseTestEnvironment, null);
    expect(tied.find(row => row.nickname === currentNickname)?.rank).toBe(tied.find(row => row.nickname === secondNickname)?.rank);
    expect(tied.every(row => Object.keys(row).sort().join(',') === 'achieved_at,nickname,rank,score')).toBe(true);
    expect(tied.filter(row => row.nickname === currentNickname)).toHaveLength(1);
    expect((await rpcRequest(request, supabaseTestEnvironment, authenticatedIdentity, 'global_score_rank', { personal_score: 450 })).body).toBe(2);
    expect((await rpcRequest(request, supabaseTestEnvironment, authenticatedIdentity, 'global_score_rank', { personal_score: 500 })).body).toBe(1);
    await rpcRequest(request, supabaseTestEnvironment, authenticatedIdentity, 'submit_global_score', { submitted_score: 700 });
    const improved = (await globalRows(request, supabaseTestEnvironment, null)).find(row => row.nickname === currentNickname);
    expect(improved?.score).toBe(700);
    expect(improved?.achieved_at).not.toBe(achievedAt);
    expect((await rpcRequest(request, supabaseTestEnvironment, null, 'global_score_rank', { personal_score: 500 })).status).toBeGreaterThanOrEqual(400);
    expect((await rpcRequest(request, supabaseTestEnvironment, null, 'submit_global_score', { submitted_score: 900 })).status).toBeGreaterThanOrEqual(400);
    expect((await globalRows(request, supabaseTestEnvironment, null)).length).toBeGreaterThanOrEqual(2);
});

test('anonymous leaderboard includes every player tied at rank 100', async ({ request, supabaseTestEnvironment, rank100CutoffSeed }) => {
    test.setTimeout(210_000);
    const rows = await globalRows(request, supabaseTestEnvironment, null);
    expect(rows).toHaveLength(101);
    const cutoffRows = rows.filter(row => row.rank === 100);
    expect(cutoffRows).toHaveLength(2);
    expect(cutoffRows.map(row => row.nickname).sort()).toEqual([...rank100CutoffSeed.cutoffNicknames].sort());
    expect(rows.every(row => row.rank <= 100)).toBe(true);
});

async function runResultsRequest (
    request: APIRequestContext,
    environment: PublicTestEnvironment,
    identity: AuthenticatedTestIdentity | null,
    path: string,
    operation: { readonly method?: 'POST' | 'DELETE'; readonly body?: Omit<RunResultRow, never> } = {}
): Promise<RestResult>
{
    const response = await request.fetch(new URL(`/rest/v1${path}`, environment.url).toString(), {
        method: operation.method ?? 'GET',
        timeout: 10_000,
        headers: {
            apikey: environment.publishableKey,
            ...(identity ? { authorization: `Bearer ${identity.accessToken}` } : {}),
            ...(operation.body ? { 'content-type': 'application/json', prefer: 'return=representation' } : operation.method === 'DELETE' ? { prefer: 'return=representation' } : {})
        },
        ...(operation.body ? { data: operation.body } : {})
    });
    return { status: response.status(), body: response.status() === 204 ? null : await response.json() };
}

interface GlobalRow { readonly rank: number; readonly nickname: string; readonly achieved_at: string; readonly score: number }

async function profileRequest (request: APIRequestContext, environment: PublicTestEnvironment, identity: AuthenticatedTestIdentity, nickname: string): Promise<void>
{
    const response = await request.fetch(new URL('/rest/v1/player_profiles?on_conflict=user_id', environment.url).toString(), {
        method: 'POST', timeout: 10_000,
        headers: { apikey: environment.publishableKey, authorization: `Bearer ${identity.accessToken}`, 'content-type': 'application/json', prefer: 'resolution=merge-duplicates,return=minimal' },
        data: { user_id: identity.userId, nickname }
    });
    expect([200, 201, 204]).toContain(response.status());
}

async function rpcRequest (request: APIRequestContext, environment: PublicTestEnvironment, identity: AuthenticatedTestIdentity | null, name: string, body: Record<string, number>): Promise<RestResult>
{
    const response = await request.fetch(new URL(`/rest/v1/rpc/${name}`, environment.url).toString(), {
        method: 'POST', timeout: 10_000,
        headers: { apikey: environment.publishableKey, ...(identity ? { authorization: `Bearer ${identity.accessToken}` } : {}), 'content-type': 'application/json' },
        data: body
    });
    return { status: response.status(), body: response.status() === 204 ? null : await response.json() };
}

async function globalRows (request: APIRequestContext, environment: PublicTestEnvironment, identity: AuthenticatedTestIdentity | null): Promise<GlobalRow[]>
{
    const response = await rpcRequest(request, environment, identity, 'global_high_scores', {});
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    return response.body as GlobalRow[];
}
