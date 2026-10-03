import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBrowserResultStore } from '../../src/ui/adapters/browserResultStore.ts';

const configuration = {
    url: 'http://localhost:54321',
    publishableKey: 'public-test-key-that-is-long-enough'
};
const terminalResult = Object.freeze({
    runId: '00000000-0000-4000-8000-000000000001',
    outcome: 'death',
    activeElapsedMs: 12_345,
    finalCredits: 98_765
});

function clientFor ({ session = { user: { id: '00000000-0000-4000-8000-000000000002' } }, sessionError = null, insert = async () => ({ error: null }) } = {})
{
    const rows = [];
    return {
        rows,
        client: {
            auth: { getSession: async () => ({ data: { session }, error: sessionError }) },
            from: table => {
                assert.equal(table, 'run_results');
                return { insert: async row => { rows.push(row); return insert(row); } };
            }
        }
    };
}

test('result store makes anonymous persistence a no-op', async () => {
    const fixture = clientFor({ session: null });
    const store = createBrowserResultStore(configuration, () => fixture.client);

    assert.deepEqual(await store.persist(terminalResult), { status: 'unsigned', message: null });
    assert.deepEqual(fixture.rows, []);
});

test('result store derives the signed-in owner and writes the terminal result', async () => {
    const fixture = clientFor();
    const store = createBrowserResultStore(configuration, () => fixture.client);

    assert.deepEqual(await store.persist(terminalResult), { status: 'saved', message: null });
    assert.deepEqual(fixture.rows, [{
        run_id: terminalResult.runId,
        user_id: '00000000-0000-4000-8000-000000000002',
        outcome: 'death',
        active_elapsed_ms: terminalResult.activeElapsedMs,
        final_credits: terminalResult.finalCredits
    }]);
});

test('result store treats a duplicate retry as already saved', async () => {
    let attempts = 0;
    const fixture = clientFor({ insert: async () => ({ error: ++attempts === 1 ? null : { code: '23505', message: 'duplicate key value violates unique constraint' } }) });
    const store = createBrowserResultStore(configuration, () => fixture.client);

    assert.equal((await store.persist(terminalResult)).status, 'saved');
    assert.equal((await store.persist(terminalResult)).status, 'saved');
    assert.equal(fixture.rows.length, 2);
});

test('result store surfaces session and write failures for retry', async () => {
    const sessionFailure = clientFor({ sessionError: { message: 'Session unavailable' } });
    assert.deepEqual(await createBrowserResultStore(configuration, () => sessionFailure.client).persist(terminalResult), {
        status: 'failed', message: 'Session unavailable'
    });
    const writeFailure = clientFor({ insert: async () => ({ error: { message: 'Connection lost' } }) });
    assert.deepEqual(await createBrowserResultStore(configuration, () => writeFailure.client).persist(terminalResult), {
        status: 'failed', message: 'Connection lost'
    });
});
