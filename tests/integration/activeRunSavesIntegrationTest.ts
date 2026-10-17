import { randomUUID } from 'node:crypto';
import { expect, type APIRequestContext } from '@playwright/test';
import { test, type AuthenticatedTestIdentity } from './testSessionFixture';
import { seedGlobalScore, type PublicTestEnvironment } from '../testSessionSupport';

interface Response { readonly status: number; readonly body: unknown; }

// Database risk: owner/profile checks and revision locking must hold at the public RPC boundary, independently of browser UI.
test('active run persistence requires an authenticated profiled owner and isolates slots', async ({ request, testRunId, supabaseTestEnvironment, authenticatedIdentity, secondaryAuthenticatedIdentity }) => {
    const noProfile = await rpc(request, supabaseTestEnvironment, authenticatedIdentity, 'load_active_run', {});
    expect(noProfile.status).toBeGreaterThanOrEqual(400);
    await addProfile(request, supabaseTestEnvironment, authenticatedIdentity, `Pilot${testRunId.replace(/-/gu, '').slice(0, 8)}`);
    await addProfile(request, supabaseTestEnvironment, secondaryAuthenticatedIdentity, `Pilot${testRunId.replace(/-/gu, '').slice(8, 16)}`);
    const unauthenticated = await rpc(request, supabaseTestEnvironment, null, 'load_active_run', {});
    expect(unauthenticated.status).toBeGreaterThanOrEqual(400);
    const runId = randomUUID();
    const created = await rpc(request, supabaseTestEnvironment, authenticatedIdentity, 'create_active_run', mutation('create', null, 0, randomUUID(), runId));
    expect(created.status).toBe(200);
    expect(created.body).toMatchObject({ revision: 1, run_id: runId, status: 'active' });
    const unconfirmedDiscard = await rpc(request, supabaseTestEnvironment, authenticatedIdentity, 'discard_active_run', { expected_run_id: runId, expected_revision: 1, mutation_id: randomUUID(), confirmed: false });
    expect(unconfirmedDiscard.status).toBeGreaterThanOrEqual(400);
    expect((await rpc(request, supabaseTestEnvironment, authenticatedIdentity, 'load_active_run', {})).body).toMatchObject({ status: 'active', revision: 1 });
    const malformed = await rpc(request, supabaseTestEnvironment, authenticatedIdentity, 'save_active_run', {
        ...mutation('save', runId, 1, randomUUID(), runId),
        next_snapshot: { schemaVersion: 20, runId, credits: 0, clock: { activeElapsedMs: 'not-a-number', budgetMs: 100 } }
    });
    expect(malformed.status).toBeGreaterThanOrEqual(400);
    expect((await rpc(request, supabaseTestEnvironment, authenticatedIdentity, 'load_active_run', {})).body).toMatchObject({ status: 'active', revision: 1 });
    expect((await rpc(request, supabaseTestEnvironment, secondaryAuthenticatedIdentity, 'load_active_run', {})).body).toMatchObject({ status: 'empty' });
    const stale = await rpc(request, supabaseTestEnvironment, authenticatedIdentity, 'save_active_run', mutation('save', runId, 0, randomUUID(), runId));
    expect(stale.status).toBeGreaterThanOrEqual(400);
    const replayId = randomUUID();
    const first = await rpc(request, supabaseTestEnvironment, authenticatedIdentity, 'save_active_run', mutation('save', runId, 1, replayId, runId));
    expect(first.body).toMatchObject({ revision: 2 });
    const replay = await rpc(request, supabaseTestEnvironment, authenticatedIdentity, 'save_active_run', mutation('save', runId, 1, replayId, runId));
    expect(replay.body).toEqual(first.body);
    const revival = await rpc(request, supabaseTestEnvironment, authenticatedIdentity, 'discard_active_run', mutation('discard', runId, 2, randomUUID(), null));
    expect(revival.status).toBe(200);
    const cannotRevive = await rpc(request, supabaseTestEnvironment, authenticatedIdentity, 'save_active_run', mutation('save', runId, 2, randomUUID(), runId));
    expect(cannotRevive.status).toBeGreaterThanOrEqual(400);
});

// Database risk: terminal history, global best and active-slot cleanup must commit or roll back as one transaction.
test('active run persistence finalizes terminal data atomically and preserves idempotent replay', async ({ request, testRunId, supabaseTestEnvironment, authenticatedIdentity }) => {
    const runId = randomUUID();
    await addProfile(request, supabaseTestEnvironment, authenticatedIdentity, `Saver${testRunId.replace(/-/gu, '').slice(0, 8)}`);
    const seededNickname = await seedGlobalScore(authenticatedIdentity.sessionId, 99_999);
    const create = await rpc(request, supabaseTestEnvironment, authenticatedIdentity, 'create_active_run', mutation('create', null, 0, randomUUID(), runId));
    expect(create.status).toBe(200);
    const finalizeId = randomUUID();
    const finalization = { expected_run_id: runId, expected_revision: 1, mutation_id: finalizeId, outcome: 'abandoned', active_elapsed_ms: 12, final_credits: 5, final_score: 7 };
    const invalid = await rpc(request, supabaseTestEnvironment, authenticatedIdentity, 'finalize_active_run', { ...finalization, mutation_id: randomUUID(), final_score: null });
    expect(invalid.status).toBeGreaterThanOrEqual(400);
    const first = await rpc(request, supabaseTestEnvironment, authenticatedIdentity, 'finalize_active_run', finalization);
    expect(first.status, JSON.stringify(first.body)).toBe(200);
    expect((await rpc(request, supabaseTestEnvironment, authenticatedIdentity, 'load_active_run', {})).body).toMatchObject({ status: 'empty' });
    expect((await rpc(request, supabaseTestEnvironment, authenticatedIdentity, 'finalize_active_run', finalization)).body).toEqual(first.body);
    const mismatch = await rpc(request, supabaseTestEnvironment, authenticatedIdentity, 'finalize_active_run', { ...finalization, final_score: 8 });
    expect(mismatch.status).toBeGreaterThanOrEqual(400);
    const revisionMismatch = await rpc(request, supabaseTestEnvironment, authenticatedIdentity, 'finalize_active_run', { ...finalization, expected_revision: 2 });
    expect(revisionMismatch.status).toBeGreaterThanOrEqual(400);
    const newerRunId = randomUUID();
    expect((await rpc(request, supabaseTestEnvironment, authenticatedIdentity, 'create_active_run', mutation('create', null, 2, randomUUID(), newerRunId))).status).toBe(200);
    const removedHistory = await request.fetch(new URL(`/rest/v1/run_results?run_id=eq.${runId}`, supabaseTestEnvironment.url).toString(), {
        method: 'DELETE', headers: { apikey: supabaseTestEnvironment.publishableKey, authorization: `Bearer ${authenticatedIdentity.accessToken}`, prefer: 'return=minimal' }
    });
    expect(removedHistory.status()).toBe(204);
    expect((await rpc(request, supabaseTestEnvironment, authenticatedIdentity, 'finalize_active_run', finalization)).body).toEqual(first.body);
    expect((await rpc(request, supabaseTestEnvironment, authenticatedIdentity, 'load_active_run', {})).body).toMatchObject({ status: 'active', run_id: newerRunId });
    const history = await request.fetch(new URL(`/rest/v1/run_results?run_id=eq.${runId}&select=outcome`, supabaseTestEnvironment.url).toString(), {
        headers: { apikey: supabaseTestEnvironment.publishableKey, authorization: `Bearer ${authenticatedIdentity.accessToken}` }
    });
    expect(await history.json()).toEqual([]);
    const lowerFinalization = await rpc(request, supabaseTestEnvironment, authenticatedIdentity, 'finalize_active_run', {
        expected_run_id: newerRunId, expected_revision: 3, mutation_id: randomUUID(), outcome: 'death', active_elapsed_ms: 13, final_credits: 4, final_score: 6
    });
    expect(lowerFinalization.status).toBe(200);
    const equalRunId = randomUUID();
    expect((await rpc(request, supabaseTestEnvironment, authenticatedIdentity, 'create_active_run', mutation('create', null, 4, randomUUID(), equalRunId))).status).toBe(200);
    const equalFinalization = await rpc(request, supabaseTestEnvironment, authenticatedIdentity, 'finalize_active_run', {
        expected_run_id: equalRunId, expected_revision: 5, mutation_id: randomUUID(), outcome: 'death', active_elapsed_ms: 14, final_credits: 8, final_score: 99_999
    });
    expect(equalFinalization.status).toBe(200);
    const best = await rpc(request, supabaseTestEnvironment, null, 'global_high_scores', {});
    expect(best.status).toBe(200);
    expect((best.body as Array<{ nickname: string; score: number; achieved_at: string }>).find((row) => row.nickname === seededNickname)).toEqual({ rank: expect.any(Number), nickname: seededNickname, achieved_at: '2026-10-14T10:00:00+00:00', score: 99_999 });
});

test('active run persistence retains terminal results when the run never had a save slot', async ({ request, testRunId, supabaseTestEnvironment, authenticatedIdentity }) => {
    const runId = randomUUID();
    await addProfile(request, supabaseTestEnvironment, authenticatedIdentity, `Fresh${testRunId.replace(/-/gu, '').slice(0, 8)}`);
    const finalization = { expected_run_id: runId, expected_revision: 0, mutation_id: randomUUID(), outcome: 'death', active_elapsed_ms: 12, final_credits: 5, final_score: 7 };
    const first = await rpc(request, supabaseTestEnvironment, authenticatedIdentity, 'finalize_active_run', finalization);
    expect(first.status, JSON.stringify(first.body)).toBe(200);
    expect((await rpc(request, supabaseTestEnvironment, authenticatedIdentity, 'load_active_run', {})).body).toMatchObject({ status: 'empty', revision: 1 });
    const staleFinalization = await rpc(request, supabaseTestEnvironment, authenticatedIdentity, 'finalize_active_run', { ...finalization, mutation_id: randomUUID(), expected_revision: 1 });
    expect(staleFinalization.status).toBeGreaterThanOrEqual(400);
});

test('active run persistence serializes concurrent first-run creation', async ({ request, testRunId, supabaseTestEnvironment, authenticatedIdentity }) => {
    await addProfile(request, supabaseTestEnvironment, authenticatedIdentity, `Race${testRunId.replace(/-/gu, '').slice(0, 8)}`);
    const runIds = [randomUUID(), randomUUID()];
    const outcomes = await Promise.all(runIds.map((runId) => rpc(request, supabaseTestEnvironment, authenticatedIdentity, 'create_active_run', mutation('create', null, 0, randomUUID(), runId))));
    expect(outcomes.filter((outcome) => outcome.status === 200)).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status >= 400)).toHaveLength(1);
    const active = (await rpc(request, supabaseTestEnvironment, authenticatedIdentity, 'load_active_run', {})).body as { run_id: string; revision: number; status: string };
    expect(active.status).toBe('active');
    expect(runIds).toContain(active.run_id);
    expect(active.revision).toBe(1);
});

test('active run persistence rolls back slot cleanup when duplicate history identity conflicts', async ({ request, testRunId, supabaseTestEnvironment, authenticatedIdentity }) => {
    const runId = randomUUID();
    await addProfile(request, supabaseTestEnvironment, authenticatedIdentity, `Roll${testRunId.replace(/-/gu, '').slice(0, 8)}`);
    expect((await rpc(request, supabaseTestEnvironment, authenticatedIdentity, 'create_active_run', mutation('create', null, 0, randomUUID(), runId))).status).toBe(200);
    const conflict = await request.fetch(new URL('/rest/v1/run_results', supabaseTestEnvironment.url).toString(), {
        method: 'POST', headers: { apikey: supabaseTestEnvironment.publishableKey, authorization: `Bearer ${authenticatedIdentity.accessToken}`, 'content-type': 'application/json', prefer: 'return=minimal' },
        data: { run_id: runId, user_id: authenticatedIdentity.userId, outcome: 'death', active_elapsed_ms: 1, final_credits: 2, final_score: 3 }
    });
    expect(conflict.status()).toBe(201);
    const failed = await rpc(request, supabaseTestEnvironment, authenticatedIdentity, 'finalize_active_run', {
        expected_run_id: runId, expected_revision: 1, mutation_id: randomUUID(), outcome: 'abandoned', active_elapsed_ms: 12, final_credits: 5, final_score: 7
    });
    expect(failed.status).toBeGreaterThanOrEqual(400);
    expect((await rpc(request, supabaseTestEnvironment, authenticatedIdentity, 'load_active_run', {})).body).toMatchObject({ status: 'active', run_id: runId, revision: 1 });
});

function mutation (operation: string, expectedRunId: string | null, expectedRevision: number, mutationId: string, nextRunId: string | null): Record<string, unknown>
{
    const snapshot = nextRunId ? { schemaVersion: 20, runId: nextRunId, credits: 0, clock: { activeElapsedMs: 0, budgetMs: 100 } } : null;
    return operation === 'create'
        ? { expected_revision: expectedRevision, mutation_id: mutationId, next_run_id: nextRunId, next_snapshot: snapshot, next_schema_version: snapshot ? 20 : null }
        : operation === 'discard'
            ? { expected_run_id: expectedRunId, expected_revision: expectedRevision, mutation_id: mutationId, confirmed: true }
            : { expected_run_id: expectedRunId, expected_revision: expectedRevision, mutation_id: mutationId, next_snapshot: snapshot, next_schema_version: snapshot ? 20 : null };
}
async function addProfile (request: APIRequestContext, environment: PublicTestEnvironment, identity: AuthenticatedTestIdentity, nickname: string): Promise<void>
{
    const response = await request.fetch(new URL('/rest/v1/player_profiles?on_conflict=user_id', environment.url).toString(), {
        method: 'POST', headers: { apikey: environment.publishableKey, authorization: `Bearer ${identity.accessToken}`, 'content-type': 'application/json', prefer: 'resolution=merge-duplicates,return=minimal' },
        data: { user_id: identity.userId, nickname }
    });
    expect([200, 201, 204]).toContain(response.status());
}
async function rpc (request: APIRequestContext, environment: PublicTestEnvironment, identity: { readonly accessToken: string } | null, name: string, body: Record<string, unknown>): Promise<Response>
{
    const response = await request.fetch(new URL(`/rest/v1/rpc/${name}`, environment.url).toString(), {
        method: 'POST', headers: { apikey: environment.publishableKey, ...(identity ? { authorization: `Bearer ${identity.accessToken}` } : {}), 'content-type': 'application/json' }, data: body
    });
    return { status: response.status(), body: response.status() === 204 ? null : await response.json() };
}
