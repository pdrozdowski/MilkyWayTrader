import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initialGameState } from '../../src/game/definitions/initialGameState.ts';
import { encodeGameState } from '../../src/game/application/gameStateCodec.ts';
import { createBrowserActiveRunStore } from '../../src/ui/adapters/browserActiveRunStore.ts';

const configuration = { url: 'http://localhost:54321', publishableKey: 'public-test-key-that-is-long-enough' };
const ownerId = '00000000-0000-4000-8000-000000000002';
function clientFor ({ session = { user: { id: ownerId } }, response = null, error = null, afterRpcSession = null, archiveRpc = async () => ({ data: null, error: null }) } = {})
{
    const calls = [];
    let sessions = 0;
    return { calls, client: {
        auth: { getSession: async () => ({ data: { session: sessions++ > 0 && afterRpcSession ? afterRpcSession : session }, error: null }) },
        rpc: async (name, args) => {
            calls.push({ name, args });
            return name === 'save_broken_run' ? archiveRpc(args) : { data: response, error };
        }
    } };
}

test('active save load decodes compatible snapshots and retains incompatible data for explicit discard', async () => {
    const active = clientFor({ response: { owner_id: ownerId, run_id: initialGameState.runId, revision: 4, status: 'active', snapshot: initialGameState, schema_version: 20, updated_at: '2026-10-25T12:00:00Z', replay_metadata: [] } });
    const result = await createBrowserActiveRunStore(configuration, () => active.client).load();
    assert.equal(result.status, 'active');
    assert.equal(result.revision, 4);
    const incompatible = clientFor({ response: { owner_id: ownerId, run_id: initialGameState.runId, revision: 5, status: 'active', snapshot: { schemaVersion: 19 }, schema_version: 19, updated_at: '2026-10-25T12:00:00Z', replay_metadata: [] } });
    const invalid = await createBrowserActiveRunStore(configuration, () => incompatible.client).load();
    assert.equal(invalid.status, 'incompatible');
    assert.equal(invalid.revision, 5);
    assert.equal(incompatible.calls.filter(call => call.name === 'save_broken_run').length, 1);
    assert.deepEqual(incompatible.calls.find(call => call.name === 'save_broken_run').args, {
        owner_id: ownerId, run_id: initialGameState.runId, revision: 5, status: 'active', snapshot: { schemaVersion: 19 },
        schema_version: 19, updated_at: '2026-10-25T12:00:00Z', replay_metadata: []
    });
});

test('broken save archival is detached and silences returned errors and rejected promises', async () => {
    let releaseArchive;
    const delayed = clientFor({
        response: { owner_id: ownerId, run_id: initialGameState.runId, revision: 5, status: 'terminal_pending', snapshot: { schemaVersion: 19 }, schema_version: 19, updated_at: '2026-10-25T12:00:00Z', replay_metadata: [] },
        archiveRpc: () => new Promise(resolve => { releaseArchive = resolve; })
    });
    const result = await createBrowserActiveRunStore(configuration, () => delayed.client).load();
    assert.equal(result.status, 'incompatible');
    assert.equal(typeof releaseArchive, 'function');
    releaseArchive({ data: null, error: { message: 'archive failed' } });

    const rejected = clientFor({
        response: { owner_id: ownerId, run_id: initialGameState.runId, revision: 6, status: 'active', snapshot: { schemaVersion: 19 }, schema_version: 19, updated_at: '2026-10-25T12:00:00Z', replay_metadata: [] },
        archiveRpc: () => Promise.reject(new Error('archive rejected'))
    });
    assert.equal((await createBrowserActiveRunStore(configuration, () => rejected.client).load()).status, 'incompatible');
});

test('active save archival excludes compatible, empty, unavailable, and invalid-owner responses', async () => {
    const compatible = clientFor({ response: { owner_id: ownerId, run_id: initialGameState.runId, revision: 4, status: 'active', snapshot: initialGameState, schema_version: 20, updated_at: '2026-10-25T12:00:00Z', replay_metadata: [] } });
    assert.equal((await createBrowserActiveRunStore(configuration, () => compatible.client).load()).status, 'active');
    const empty = clientFor({ response: { owner_id: ownerId, revision: 0, status: 'empty', snapshot: null } });
    assert.equal((await createBrowserActiveRunStore(configuration, () => empty.client).load()).status, 'empty');
    const unavailable = clientFor({ error: { message: 'offline' } });
    assert.equal((await createBrowserActiveRunStore(configuration, () => unavailable.client).load()).status, 'unavailable');
    const invalidOwner = clientFor({ response: { owner_id: '00000000-0000-4000-8000-000000000003', run_id: initialGameState.runId, revision: 2, status: 'active', snapshot: { schemaVersion: 19 }, schema_version: 19, updated_at: '2026-10-25T12:00:00Z', replay_metadata: [] } });
    assert.equal((await createBrowserActiveRunStore(configuration, () => invalidOwner.client).load()).status, 'unavailable');
    const invalidEnvelope = clientFor({ response: { owner_id: ownerId, revision: 3, status: 'active', snapshot: { schemaVersion: 19 } } });
    assert.equal((await createBrowserActiveRunStore(configuration, () => invalidEnvelope.client).load()).status, 'unavailable');
    for (const fixture of [compatible, empty, unavailable, invalidOwner, invalidEnvelope]) assert.equal(fixture.calls.filter(call => call.name === 'save_broken_run').length, 0);
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
