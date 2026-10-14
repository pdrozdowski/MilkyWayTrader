import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBrowserResultStore } from '../../src/ui/adapters/browserResultStore.ts';

const configuration = { url: 'http://localhost:54321', publishableKey: 'public-test-key-that-is-long-enough' };
const terminalResult = Object.freeze({ runId: '00000000-0000-4000-8000-000000000001', outcome: 'death', activeElapsedMs: 12_345, finalCredits: 98_765, cargoValue: 12.5, shipUpgradeSpend: 100, facilityUpgradeSpend: 200, finalScore: 99_078 });
const globalSuccess = { submit: async () => ({ error: null }) };

function clientFor ({ session = { user: { id: '00000000-0000-4000-8000-000000000002' } }, sessionError = null, insert = async () => ({ error: null }) } = {})
{
    const rows = [];
    return { rows, client: {
        auth: { getSession: async () => ({ data: { session }, error: sessionError }) },
        from: table => { assert.equal(table, 'run_results'); return { insert: async row => { rows.push(row); return insert(row); } }; }
    } };
}

test('result store makes anonymous persistence a no-op', async () => {
    const fixture = clientFor({ session: null });
    let globalCalls = 0;
    const store = createBrowserResultStore(configuration, () => fixture.client, { submit: async () => { globalCalls++; return { error: null }; } });
    assert.deepEqual(await store.persist(terminalResult), { status: 'unsigned', message: null });
    assert.deepEqual(fixture.rows, []);
    assert.equal(globalCalls, 0);
});

test('signed-in persistence writes private cash and composite score and submits global score', async () => {
    const fixture = clientFor();
    const scores = [];
    const store = createBrowserResultStore(configuration, () => fixture.client, { submit: async score => { scores.push(score); return { error: null }; } });
    assert.deepEqual(await store.persist(terminalResult), { status: 'saved', message: null });
    assert.deepEqual(fixture.rows, [{ run_id: terminalResult.runId, user_id: '00000000-0000-4000-8000-000000000002', outcome: 'death', active_elapsed_ms: terminalResult.activeElapsedMs, final_credits: terminalResult.finalCredits, final_score: terminalResult.finalScore }]);
    assert.deepEqual(scores, [terminalResult.finalScore]);
});

test('partial failures retry safely and saved requires both stores', async () => {
    let insertAttempts = 0;
    let globalAttempts = 0;
    const fixture = clientFor({ insert: async () => ({ error: ++insertAttempts === 1 ? null : { code: '23505', message: 'duplicate' } }) });
    const store = createBrowserResultStore(configuration, () => fixture.client, { submit: async () => ({ error: ++globalAttempts === 1 ? 'offline' : null }) });
    assert.equal((await store.persist(terminalResult)).status, 'failed');
    assert.equal((await store.persist(terminalResult)).status, 'saved');
    assert.equal(insertAttempts, 2);
    assert.equal(globalAttempts, 2);
});

test('either persistence failure prevents saved status and invalid score is rejected', async () => {
    const fixture = clientFor({ insert: async () => ({ error: { message: 'private offline' } }) });
    let globalCalled = false;
    const store = createBrowserResultStore(configuration, () => fixture.client, { submit: async () => { globalCalled = true; return { error: null }; } });
    assert.deepEqual(await store.persist(terminalResult), { status: 'failed', message: 'private offline' });
    assert.equal(globalCalled, true);
    assert.equal((await store.persist({ ...terminalResult, finalScore: -1 })).status, 'failed');
});

test('session failure is surfaced for retry', async () => {
    const fixture = clientFor({ sessionError: { message: 'Session unavailable' } });
    assert.deepEqual(await createBrowserResultStore(configuration, () => fixture.client, globalSuccess).persist(terminalResult), { status: 'failed', message: 'Session unavailable' });
});
