import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initialGameState } from '../../src/game/definitions/initialGameState.ts';
import { encodeGameState } from '../../src/game/application/gameStateCodec.ts';
import { createBrowserActiveRunStore } from '../../src/ui/adapters/browserActiveRunStore.ts';

const configuration = { url: 'http://localhost:54321', publishableKey: 'public-test-key-that-is-long-enough' };
const ownerId = '00000000-0000-4000-8000-000000000002';
function clientFor ({ session = { user: { id: ownerId } }, response = null, error = null, afterRpcSession = null } = {})
{
    const calls = [];
    let sessions = 0;
    return { calls, client: {
        auth: { getSession: async () => ({ data: { session: sessions++ > 0 && afterRpcSession ? afterRpcSession : session }, error: null }) },
        rpc: async (name, args) => { calls.push({ name, args }); return { data: response, error }; }
    } };
}

test('active save load decodes compatible snapshots and retains incompatible data for explicit discard', async () => {
    const active = clientFor({ response: { revision: 4, status: 'active', snapshot: initialGameState } });
    const result = await createBrowserActiveRunStore(configuration, () => active.client).load();
    assert.equal(result.status, 'active');
    assert.equal(result.revision, 4);
    const incompatible = clientFor({ response: { revision: 5, status: 'active', snapshot: { schemaVersion: 19 } } });
    const invalid = await createBrowserActiveRunStore(configuration, () => incompatible.client).load();
    assert.equal(invalid.status, 'incompatible');
    assert.equal(invalid.revision, 5);
});

test('active save mutation encodes validated snapshots and returns acknowledged revisions', async () => {
    const fixture = clientFor({ response: { revision: 1, run_id: initialGameState.runId, status: 'active' } });
    const store = createBrowserActiveRunStore(configuration, () => fixture.client);
    const result = await store.create(initialGameState, 0, '00000000-0000-4000-8000-000000000099');
    assert.deepEqual(result, { success: true, acknowledgement: { revision: 1 } });
    assert.equal(fixture.calls[0].name, 'create_active_run');
    assert.equal(fixture.calls[0].args.next_schema_version, 20);
    assert.deepEqual(fixture.calls[0].args.next_snapshot, JSON.parse(encodeGameState(initialGameState)));
});

test('active save mutations classify conflicts and reject stale owner completions', async () => {
    const conflict = clientFor({ error: { code: '40001', message: 'revision conflict' } });
    assert.deepEqual(await createBrowserActiveRunStore(configuration, () => conflict.client).create(initialGameState, 0, '00000000-0000-4000-8000-000000000099'), {
        success: false, kind: 'conflict', message: 'revision conflict'
    });
    const changedOwner = clientFor({ response: { revision: 1 }, afterRpcSession: { user: { id: '00000000-0000-4000-8000-000000000003' } } });
    const stale = await createBrowserActiveRunStore(configuration, () => changedOwner.client).create(initialGameState, 0, '00000000-0000-4000-8000-000000000099');
    assert.equal(stale.success, false);
    if (!stale.success) assert.equal(stale.kind, 'conflict');
});

test('discard requires explicit confirmation and anonymous sessions are ineligible', async () => {
    const fixture = clientFor();
    const store = createBrowserActiveRunStore(configuration, () => fixture.client);
    assert.equal((await store.discard(initialGameState.runId, 1, '00000000-0000-4000-8000-000000000099', false)).success, false);
    assert.equal(fixture.calls.length, 0);
    const anonymous = clientFor({ session: null });
    assert.equal((await createBrowserActiveRunStore(configuration, () => anonymous.client).load()).status, 'ineligible');
});
