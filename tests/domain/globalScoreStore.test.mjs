import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBrowserGlobalScoreStore } from '../../src/ui/adapters/browserGlobalScoreStore.ts';

const configuration = { url: 'http://localhost:54321', publishableKey: 'public-test-key-that-is-long-enough' };
function clientFor ({ data = null, error = null, session = { user: { id: 'user-1' } } } = {})
{
    const calls = [];
    return { calls, client: { auth: { getSession: async () => ({ data: { session }, error: null }) }, rpc: async (name, args) => { calls.push([name, args]); return { data, error }; } } };
}

test('global score adapter validates submissions and calls authenticated atomic upsert', async () => {
    const fixture = clientFor();
    const store = createBrowserGlobalScoreStore(configuration, () => fixture.client);
    assert.deepEqual(await store.submit(900), { error: null });
    assert.deepEqual(fixture.calls, [['submit_global_score', { submitted_score: 900 }]]);
    assert.deepEqual(await store.submit(-1), { error: 'Invalid global score.' });
    assert.equal(fixture.calls.length, 1);
});

test('global public projection maps only safe ranked fields and validates returned data', async () => {
    const fixture = clientFor({ data: [{ rank: 1, nickname: 'Pilot_1', achieved_at: '2026-10-14T12:00:00Z', score: 900 }] });
    const store = createBrowserGlobalScoreStore(configuration, () => fixture.client);
    assert.deepEqual(await store.getTop(), { data: [{ rank: 1, nickname: 'Pilot_1', achievedAt: '2026-10-14T12:00:00Z', score: 900 }], error: null });
    assert.deepEqual(fixture.calls, [['global_high_scores', undefined]]);
    const malformed = createBrowserGlobalScoreStore(configuration, () => clientFor({ data: [{ user_id: 'secret', score: 900 }] }).client);
    assert.deepEqual(await malformed.getTop(), { data: null, error: 'Invalid global score response.' });
});

test('personal-best rank requires authentication and sends the exact PB score', async () => {
    const fixture = clientFor({ data: 7 });
    assert.deepEqual(await createBrowserGlobalScoreStore(configuration, () => fixture.client).getPersonalBestRank(650), { data: 7, error: null });
    assert.deepEqual(fixture.calls, [['global_score_rank', { personal_score: 650 }]]);
    const anonymous = createBrowserGlobalScoreStore(configuration, () => clientFor({ session: null }).client);
    assert.deepEqual(await anonymous.getPersonalBestRank(650), { data: null, error: 'Authentication required.' });
});
