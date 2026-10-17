import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBrowserAuthReturnPort } from '../../src/ui/adapters/browserAuthReturn.ts';
import { createBrowserPlayerProfilePort } from '../../src/ui/adapters/browserPlayerProfile.ts';
import { createBrowserAuthPort } from '../../src/ui/adapters/browserAuth.ts';
import { initialGameState } from '../../src/game/definitions/initialGameState.ts';
import { normalizePlayerNickname } from '../../src/game/application/playerProfile.ts';
import { createTelemetryPort } from '../../src/game/application/telemetry/telemetry.ts';

function sessionStorageFixture ()
{
    const values = new Map();
    return {
        values,
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
        removeItem: key => values.delete(key)
    };
}

test('player nicknames trim whitespace and enforce the public ASCII format', () => {
    assert.equal(normalizePlayerNickname('  spaceTrader48291  '), 'spaceTrader48291');
    for (const invalid of ['ab', 'a'.repeat(21), 'name with spaces', 'naïve', 'name-1', '']) {
        assert.throws(() => normalizePlayerNickname(invalid));
    }
});

test('profile creation rejects a session that no longer matches its expected owner', async () => {
    let reads = 0;
    let inserts = 0;
    const port = createBrowserPlayerProfilePort({
        auth: { getUser: async () => ({ data: { user: { id: 'owner-b' } }, error: null }) },
        from: () => {
            reads++;
            return { select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }), insert: () => { inserts++; throw new Error('unexpected insert'); } };
        }
    });
    await assert.rejects(port.loadOrCreate('Pilot_1', 'owner-a'), /account changed/u);
    assert.equal(reads, 0);
    assert.equal(inserts, 0);
});

test('an auth event supersedes a delayed initial session lookup', async () => {
    let publishAuthEvent;
    let resolveInitialSession;
    const client = {
        auth: {
            onAuthStateChange: listener => { publishAuthEvent = listener; return { data: { subscription: { unsubscribe() {} } } }; },
            getSession: () => new Promise(resolve => { resolveInitialSession = resolve; })
        }
    };
    const auth = createBrowserAuthPort({ url: 'https://example.supabase.co', publishableKey: 'x'.repeat(30) }, () => client);
    publishAuthEvent('SIGNED_IN', { user: { id: 'new-owner' } });
    resolveInitialSession({ data: { session: { user: { id: 'old-owner' } } }, error: null });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(auth.getSnapshot().ownerId, 'new-owner');
    auth.destroy();
});

test('profile load creates a persisted default and concurrent creation returns the winning row', async () => {
    let row = null;
    let inserts = 0;
    const client = {
        auth: { getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }) },
        from: table => {
            assert.equal(table, 'player_profiles');
            return {
                select: () => ({ maybeSingle: async () => ({ data: row, error: null }) }),
                insert: values => ({ select: () => ({ single: async () => {
                    assert.equal('user_id' in values, false, 'identity is supplied by auth.uid() in the database');
                    inserts++;
                    if (row) return { data: null, error: { message: 'duplicate profile' } };
                    row = { nickname: values.nickname };
                    return { data: row, error: null };
                } }) }),
                update: values => ({ eq: (column, userId) => ({ select: () => ({ single: async () => {
                    assert.equal(column, 'user_id');
                    assert.equal(userId, 'user-1');
                    row = { nickname: values.nickname };
                    return { data: row, error: null };
                } }) }) })
            };
        }
    };
    const port = createBrowserPlayerProfilePort(client);
    const [first, raced] = await Promise.all([port.loadOrCreate(), port.loadOrCreate()]);
    assert.match(first.nickname, /^spaceTrader\d{5}$/);
    assert.deepEqual(raced, first);
    assert.equal(inserts, 2);
    assert.deepEqual(await port.updateNickname('  Pilot_7 '), { nickname: 'Pilot_7' });
});

test('OAuth return storage round trips a validated run and consumes it once', () => {
    const storage = sessionStorageFixture();
    const port = createBrowserAuthReturnPort(storage);
    const context = {
        snapshot: initialGameState,
        telemetryContext: { sessionId: 'session-1', sessionStartedAt: 1234 },
        origin: 'game-menu',
        terminalResult: null,
        snapshotOwnerId: 'owner-a'
    };
    assert.equal(port.save(context), true);
    const restored = port.take();
    assert.equal(restored.snapshot.runId, initialGameState.runId);
    assert.equal(restored.snapshotOwnerId, 'owner-a');
    assert.deepEqual(port.take(), null);
});

test('malformed OAuth return data is discarded as a whole', () => {
    const storage = sessionStorageFixture();
    const port = createBrowserAuthReturnPort(storage);
    storage.setItem('milky-way-trader.auth-return', JSON.stringify({ snapshot: '{bad', telemetryContext: { sessionId: 'half', sessionStartedAt: 1 }, origin: 'game-menu', terminalResult: null }));
    assert.equal(port.take(), null);
    assert.equal(storage.getItem('milky-way-trader.auth-return'), null);
});

test('OAuth return context fields must agree with the originating screen', () => {
    const storage = sessionStorageFixture();
    const port = createBrowserAuthReturnPort(storage);
    storage.setItem('milky-way-trader.auth-return', JSON.stringify({ snapshot: null, telemetryContext: null, origin: 'game-menu', terminalResult: null }));
    assert.equal(port.take(), null);
    assert.match(port.getError(), /previous run could not be restored/u);
    storage.setItem('milky-way-trader.auth-return', JSON.stringify({ snapshot: null, telemetryContext: null, origin: 'game-over', terminalResult: { runId: 'not-a-uuid', outcome: 'death', activeElapsedMs: -1, finalCredits: 0 } }));
    assert.equal(port.take(), null);
});

test('OAuth return restores each validated S-06 timeout result once', () => {
    for (const [outcome, credits] of [['imprisonment', 999_999], ['freedom', 1_000_000]]) {
        const storage = sessionStorageFixture();
        const port = createBrowserAuthReturnPort(storage);
        const snapshot = {
            ...initialGameState,
            credits,
            clock: { ...initialGameState.clock, activeElapsedMs: initialGameState.clock.budgetMs },
            terminalResult: {
                runId: initialGameState.runId,
                outcome,
                activeElapsedMs: initialGameState.clock.budgetMs,
                finalCredits: credits
            }
        };
        const terminalResult = {
            ...snapshot.terminalResult,
            cargoValue: 0,
            shipUpgradeSpend: snapshot.shipUpgradeSpend,
            facilityUpgradeSpend: snapshot.facilityUpgradeSpend,
            finalScore: credits
        };
        assert.equal(port.save({ snapshot, telemetryContext: null, origin: 'game-over', terminalResult }), true);
        assert.equal(port.take().terminalResult.outcome, outcome);
        assert.equal(port.take(), null);
    }
});

test('telemetry return restores the original session identity and duration without another start event', async () => {
    const sent = [];
    let now = 1000;
    const create = () => createTelemetryPort({
        endpoint: 'https://example.test/events', publishableKey: null, gameVersion: 'test',
        auth: { getAccessToken: async () => null }, storage: sessionStorageFixture(),
        uuid: () => 'generated-session', now: () => now,
        fetch: async (_url, request) => { sent.push(...JSON.parse(request.body).events); }, platform: 'desktop'
    });
    const first = create();
    first.startSession(100);
    const context = first.getSessionContext();
    await new Promise(resolve => setImmediate(resolve));
    first.destroy();
    const returned = create();
    returned.restoreSessionContext(context);
    now = 9000;
    returned.endSession(80);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(sent.filter(event => event.event_name === 'session_started').length, 1);
    const ended = sent.find(event => event.event_name === 'session_ended');
    assert.equal(ended.session_id, context.sessionId);
    assert.equal(ended.event_data.duration_ms, 8000);
    returned.destroy();
});
