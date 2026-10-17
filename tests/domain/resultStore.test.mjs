import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBrowserResultStore } from '../../src/ui/adapters/browserResultStore.ts';

const configuration = { url: 'http://localhost:54321', publishableKey: 'public-test-key-that-is-long-enough' };
const result = Object.freeze({ runId: '00000000-0000-4000-8000-000000000001', outcome: 'death', activeElapsedMs: 12_345, finalCredits: 98_765, cargoValue: 12.5, shipUpgradeSpend: 100, facilityUpgradeSpend: 200, finalScore: 99_078 });

function clientFor ({ session = { user: { id: '00000000-0000-4000-8000-000000000002' } }, sessionError = null, load = { run_id: result.runId, revision: 7, status: 'active' }, loadError = null, finalizeError = null } = {})
{
    const calls = [];
    return { calls, client: {
        auth: { getSession: async () => ({ data: { session }, error: sessionError }) },
        rpc: async (name, args) => {
            calls.push({ name, args });
            if (name === 'load_active_run') return { data: load, error: loadError };
            return { data: { status: 'saved' }, error: finalizeError };
        }
    } };
}

test('result store makes anonymous terminal persistence a no-op', async () => {
    const fixture = clientFor({ session: null });
    assert.deepEqual(await createBrowserResultStore(configuration, () => fixture.client).persist(result), { status: 'unsigned', message: null });
    assert.deepEqual(fixture.calls, []);
});

test('signed-in terminal results finalize through one atomic RPC with expected revision', async () => {
    const fixture = clientFor();
    const store = createBrowserResultStore(configuration, () => fixture.client);
    assert.deepEqual(await store.persist(result), { status: 'saved', message: null });
    assert.equal(fixture.calls[0].name, 'load_active_run');
    assert.equal(fixture.calls[1].name, 'finalize_active_run');
    assert.deepEqual(fixture.calls[1].args, {
        expected_run_id: result.runId, expected_revision: 7, mutation_id: result.runId, outcome: 'death',
        active_elapsed_ms: result.activeElapsedMs, final_credits: result.finalCredits, final_score: result.finalScore
    });
});

test('abandonment maps to the retained database outcome and mismatched slots are rejected', async () => {
    const fixture = clientFor();
    const store = createBrowserResultStore(configuration, () => fixture.client);
    assert.equal((await store.persist({ ...result, outcome: 'abandonment' })).status, 'saved');
    assert.equal(fixture.calls[1].args.outcome, 'abandoned');
    const mismatch = clientFor({ load: { run_id: '00000000-0000-4000-8000-000000000003', revision: 7, status: 'active' }, finalizeError: { message: 'Save revision conflict' } });
    assert.equal((await createBrowserResultStore(configuration, () => mismatch.client).persist(result)).status, 'failed');
    assert.equal(mismatch.calls.length, 2);
});

test('failed finalization is retryable and invalid scores are rejected', async () => {
    let attempts = 0;
    const fixture = clientFor();
    fixture.client.rpc = async (name, args) => {
        fixture.calls.push({ name, args });
        if (name === 'load_active_run') return { data: { run_id: result.runId, revision: 7, status: 'active' }, error: null };
        return { data: null, error: ++attempts === 1 ? { message: 'offline' } : null };
    };
    const store = createBrowserResultStore(configuration, () => fixture.client);
    assert.deepEqual(await store.persist(result), { status: 'failed', message: 'offline' });
    assert.deepEqual(await store.persist(result), { status: 'saved', message: null });
    assert.equal((await store.persist({ ...result, finalScore: -1 })).status, 'failed');
});

test('session failure is surfaced for retry', async () => {
    const fixture = clientFor({ sessionError: { message: 'Session unavailable' } });
    assert.deepEqual(await createBrowserResultStore(configuration, () => fixture.client).persist(result), { status: 'failed', message: 'Session unavailable' });
});
