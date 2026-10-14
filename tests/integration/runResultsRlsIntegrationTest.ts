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
    readonly final_score: number;
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
        body: { run_id: runId, user_id: authenticatedIdentity.userId, outcome: 'death', active_elapsed_ms: 1_234, final_credits: 5_678, final_score: 6_789 }
    });
    expect(owner.status).toBe(201);

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
