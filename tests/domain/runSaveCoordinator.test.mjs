import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initialGameState } from '../../src/game/definitions/initialGameState.ts';
import { GameStateProvider } from '../../src/game/application/gameStateProvider.ts';
import { createRunSaveCoordinator, crossedMinuteBoundary, isMeaningfulDepartureChange } from '../../src/game/application/saves/runSaveCoordinator.ts';

function scheduler () {
    let time = 0;
    let nextId = 0;
    const timers = new Map();
    return {
        now: () => time,
        setTimeout: (callback, delay) => { const id = ++nextId; timers.set(id, { at: time + delay, callback }); return id; },
        clearTimeout: id => timers.delete(id),
        advance: async duration => {
            const target = time + duration;
            while (true) {
                const due = [...timers.entries()].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
                if (!due) break;
                time = due[1].at;
                timers.delete(due[0]);
                due[1].callback();
                await Promise.resolve();
                await Promise.resolve();
            }
            time = target;
        }
    };
}

function eligibility (ownerId = 'owner-a') {
    const snapshot = { status: 'ready', ownerId, anonymous: false, profile: { userId: ownerId }, message: null };
    return { getSnapshot: () => snapshot, subscribe: () => () => undefined };
}

function mutableEligibility (initialOwner = 'owner-a') {
    let snapshot = { status: 'ready', ownerId: initialOwner, anonymous: false, profile: { userId: initialOwner }, message: null };
    const listeners = new Set();
    return {
        getSnapshot: () => snapshot,
        subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
        set: value => { snapshot = value; for (const listener of listeners) listener(snapshot); }
    };
}

const tick = async () => new Promise(resolve => setImmediate(resolve));
function deferred () {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
}
function completedSnapshot () {
    return {
        ...initialGameState,
        clock: { ...initialGameState.clock, activeElapsedMs: 1_000 },
        shipStatus: { ...initialGameState.shipStatus, currentHitPoints: 0 },
        terminalResult: { runId: initialGameState.runId, outcome: 'death', activeElapsedMs: 1_000, finalCredits: initialGameState.credits }
    };
}

test('minute trigger fires only after a committed clock crosses a complete active minute', () => {
    assert.equal(crossedMinuteBoundary(59_999, 60_000), true);
    assert.equal(crossedMinuteBoundary(60_000, 60_000), false);
    assert.equal(crossedMinuteBoundary(60_001, 60_000), false);
    assert.equal(crossedMinuteBoundary(0, 180_000), true, 'a long frame creates one latest-state request');
    assert.equal(crossedMinuteBoundary(60_000, 60_000), false, 'paused frames do not advance the active clock');
    assert.equal(crossedMinuteBoundary(0, 600_000), true, 'debug time jumps coalesce into one trigger');
});

test('paused clock commits do not save and a debug jump coalesces into one latest save', async () => {
    const provider = new GameStateProvider(initialGameState);
    const clock = scheduler();
    const writes = [];
    const store = {
        load: async () => ({ status: 'empty', revision: 0 }),
        create: async (snapshot, revision) => { writes.push(snapshot.clock.activeElapsedMs); return { success: true, acknowledgement: { revision: revision + 1 } }; },
        save: async (snapshot, revision) => { writes.push(snapshot.clock.activeElapsedMs); return { success: true, acknowledgement: { revision: revision + 1 } }; },
        markTerminal: async () => ({ success: true, acknowledgement: { revision: 1 } }),
        discard: async () => ({ success: true, acknowledgement: { revision: 1 } })
    };
    const coordinator = createRunSaveCoordinator({ provider, store, eligibility: eligibility(), scheduler: clock, createMutationId: () => `clock-${writes.length}` });
    coordinator.startRun();
    await tick();
    provider.restore({ ...provider.snapshot(), clock: { ...provider.snapshot().clock, playerPaused: true } });
    await tick();
    assert.deepEqual(writes, [0], 'pause without active clock progress does not trigger persistence');
    provider.restore({ ...provider.snapshot(), clock: { ...provider.snapshot().clock, playerPaused: false, activeElapsedMs: 600_000 } });
    await tick();
    assert.deepEqual(writes, [0, 600_000], 'one latest-state save represents the full debug jump');
    coordinator.destroy();
});

test('departure dirtiness includes commerce and service changes but ignores clock-only changes', () => {
    const baseline = { ...initialGameState, clock: { ...initialGameState.clock, activeElapsedMs: 60_000 } };
    assert.equal(isMeaningfulDepartureChange(baseline, { ...baseline, clock: { ...baseline.clock, activeElapsedMs: 120_000 } }), false);
    assert.equal(isMeaningfulDepartureChange(baseline, { ...baseline, shipStatus: { ...baseline.shipStatus, currentHitPoints: baseline.shipStatus.currentHitPoints - 1 } }), true);
    assert.equal(isMeaningfulDepartureChange(baseline, { ...baseline, credits: baseline.credits + 1 }), true);
    assert.equal(isMeaningfulDepartureChange(baseline, { ...baseline, shipStatus: { ...baseline.shipStatus, engineLevel: baseline.shipStatus.engineLevel + 1 } }), true);
});

test('initial attachment and a crossed minute coalesce behind one in-flight save without clearing newer state', async () => {
    const provider = new GameStateProvider(initialGameState);
    const clock = scheduler();
    let resolveCreate;
    const saved = [];
    const store = {
        load: async () => ({ status: 'empty', revision: 0 }),
        create: (snapshot, revision) => { saved.push({ snapshot, revision }); return new Promise(resolve => { resolveCreate = resolve; }); },
        save: async (snapshot, revision) => { saved.push({ snapshot, revision }); return { success: true, acknowledgement: { revision: revision + 1 } }; },
        markTerminal: async () => ({ success: true, acknowledgement: { revision: 1 } }),
        discard: async () => ({ success: true, acknowledgement: { revision: 1 } })
    };
    const coordinator = createRunSaveCoordinator({ provider, store, eligibility: eligibility(), scheduler: clock, createMutationId: () => 'mutation' });
    coordinator.startRun();
    await tick();
    assert.equal(saved.length, 1);
    const changed = { ...provider.snapshot(), clock: { ...provider.snapshot().clock, activeElapsedMs: 60_000 } };
    provider.restore(changed);
    assert.equal(saved.length, 1, 'the first request remains the only in-flight mutation');
    resolveCreate({ success: true, acknowledgement: { revision: 1 } });
    await tick();
    assert.equal(saved.length, 2);
    assert.equal(saved[1].snapshot.clock.activeElapsedMs, 60_000);
    assert.equal(saved[1].revision, 1);
    coordinator.destroy();
});

test('five immediate failures use one-second retries, then back off to thirty seconds', async () => {
    const provider = new GameStateProvider(initialGameState);
    const clock = scheduler();
    let attempts = 0;
    const store = {
        load: async () => ({ status: 'empty', revision: 0 }),
        create: async () => { attempts++; return { success: false, kind: 'unavailable', message: 'offline' }; },
        save: async () => { attempts++; return { success: false, kind: 'unavailable', message: 'offline' }; },
        markTerminal: async () => ({ success: false, kind: 'unavailable', message: 'offline' }),
        discard: async () => ({ success: false, kind: 'unavailable', message: 'offline' })
    };
    const statuses = [];
    const coordinator = createRunSaveCoordinator({ provider, store, eligibility: eligibility(), scheduler: clock, createMutationId: () => `retry-${attempts}`, publish: value => statuses.push(value.status) });
    coordinator.startRun();
    await tick();
    assert.equal(attempts, 1);
    await clock.advance(1000);
    assert.equal(attempts, 2);
    await clock.advance(3000);
    assert.equal(attempts, 5);
    assert.equal(statuses.includes('temporary-problem'), true);
    await clock.advance(29_999);
    assert.equal(attempts, 5);
    await clock.advance(1);
    assert.equal(attempts, 6);
    coordinator.destroy();
});

test('a delayed response from a previous owner cannot complete after a switch', async () => {
    const provider = new GameStateProvider(initialGameState);
    const clock = scheduler();
    const auth = mutableEligibility();
    const oldCreate = deferred();
    const saves = [];
    const notices = [];
    const store = {
        load: async () => ({ status: 'empty', revision: 0 }),
        create: (snapshot, revision) => {
            saves.push({ snapshot, revision });
            return saves.length === 1 ? oldCreate.promise : Promise.resolve({ success: true, acknowledgement: { revision: revision + 1 } });
        },
        save: async (_snapshot, revision) => ({ success: true, acknowledgement: { revision: revision + 1 } }),
        markTerminal: async () => ({ success: true, acknowledgement: { revision: 1 } }),
        discard: async () => ({ success: true, acknowledgement: { revision: 1 } })
    };
    const coordinator = createRunSaveCoordinator({ provider, store, eligibility: auth, scheduler: clock, createMutationId: () => 'owner-switch', publish: value => notices.push(value) });
    await tick();
    coordinator.startRun();
    await tick();
    assert.equal(saves.length, 1);
    auth.set({ status: 'loading', ownerId: null, anonymous: false, profile: null, message: null });
    auth.set({ status: 'ready', ownerId: 'owner-b', anonymous: false, profile: { userId: 'owner-b' }, message: null });
    await tick();
    oldCreate.resolve({ success: true, acknowledgement: { revision: 1 } });
    await tick();
    assert.equal(saves.length, 2, 'the latest state is sent under the newly loaded owner slot');
    assert.equal(saves[1].revision, 0);
    assert.equal(notices.some(value => value.ownerId === 'owner-a' && value.status === 'saved'), false);
    coordinator.destroy();
});

test('conflict blocks writes until explicit authoritative reload, then uses its revision', async () => {
    const provider = new GameStateProvider(initialGameState);
    const clock = scheduler();
    let loads = 0;
    const writes = [];
    const store = {
        load: async () => ++loads === 1
            ? { status: 'empty', revision: 0 }
            : { status: 'active', revision: 9, snapshot: initialGameState },
        create: async () => { writes.push('create'); return { success: false, kind: 'conflict', message: 'stale' }; },
        save: async (_snapshot, revision) => { writes.push(revision); return { success: true, acknowledgement: { revision: revision + 1 } }; },
        markTerminal: async () => ({ success: true, acknowledgement: { revision: 1 } }),
        discard: async () => ({ success: true, acknowledgement: { revision: 1 } })
    };
    const coordinator = createRunSaveCoordinator({ provider, store, eligibility: eligibility(), scheduler: clock, createMutationId: () => 'conflict-reload' });
    await tick();
    coordinator.startRun();
    await tick();
    coordinator.requestSave();
    assert.deepEqual(writes, ['create']);
    coordinator.requestSave();
    assert.deepEqual(writes, ['create'], 'conflict suppresses automatic and explicit save requests');
    coordinator.reloadAuthoritative();
    await tick();
    coordinator.requestSave();
    await tick();
    assert.deepEqual(writes, ['create', 9]);
    coordinator.destroy();
});

test('destroy cancels scheduled retries', async () => {
    const provider = new GameStateProvider(initialGameState);
    const clock = scheduler();
    let attempts = 0;
    const store = {
        load: async () => ({ status: 'empty', revision: 0 }),
        create: async () => { attempts++; return { success: false, kind: 'unavailable', message: 'offline' }; },
        save: async () => ({ success: false, kind: 'unavailable', message: 'offline' }),
        markTerminal: async () => ({ success: false, kind: 'unavailable', message: 'offline' }),
        discard: async () => ({ success: false, kind: 'unavailable', message: 'offline' })
    };
    const coordinator = createRunSaveCoordinator({ provider, store, eligibility: eligibility(), scheduler: clock, createMutationId: () => 'destroy' });
    await tick();
    coordinator.startRun();
    await tick();
    assert.equal(attempts, 1);
    coordinator.destroy();
    await clock.advance(10_000);
    assert.equal(attempts, 1);
});

test('start during initial load defers writes until the authoritative empty or active revision arrives', async () => {
    for (const loaded of [
        { status: 'empty', revision: 7 },
        { status: 'active', revision: 12, snapshot: initialGameState }
    ]) {
        const provider = new GameStateProvider(initialGameState);
        const clock = scheduler();
        const pendingLoad = deferred();
        const writes = [];
        const store = {
            load: () => pendingLoad.promise,
            create: async (snapshot, revision) => { writes.push({ operation: 'create', snapshot, revision }); return { success: true, acknowledgement: { revision: revision + 1 } }; },
            save: async (snapshot, revision) => { writes.push({ operation: 'save', snapshot, revision }); return { success: true, acknowledgement: { revision: revision + 1 } }; },
            markTerminal: async () => ({ success: true, acknowledgement: { revision: 1 } }),
            discard: async () => ({ success: true, acknowledgement: { revision: 1 } })
        };
        const coordinator = createRunSaveCoordinator({ provider, store, eligibility: eligibility(), scheduler: clock, createMutationId: () => 'deferred-load' });
        coordinator.startRun();
        await tick();
        assert.equal(writes.length, 0, 'no mutation uses a default revision while load is unresolved');
        pendingLoad.resolve(loaded);
        await tick();
        assert.equal(writes.length, 1);
        assert.equal(writes[0].revision, loaded.revision);
        assert.equal(writes[0].operation, loaded.status === 'empty' ? 'create' : 'save');
        coordinator.destroy();
    }
});

test('terminal transition waits for an in-flight save acknowledgement before marking and finalizing', async () => {
    const provider = new GameStateProvider(initialGameState);
    const clock = scheduler();
    const pendingCreate = deferred();
    const markedRevisions = [];
    const persistedRevisions = [];
    const pendingIntentRevisions = [];
    const store = {
        load: async () => ({ status: 'empty', revision: 0 }),
        create: async () => pendingCreate.promise,
        save: async () => ({ success: true, acknowledgement: { revision: 1 } }),
        markTerminal: async (_snapshot, revision) => { markedRevisions.push(revision); return { success: true, acknowledgement: { revision: revision + 1 } }; },
        discard: async () => ({ success: true, acknowledgement: { revision: 1 } })
    };
    const terminalResultStore = { persist: async (_result, revision) => { persistedRevisions.push(revision); return { status: 'saved', message: null }; } };
    const pendingResult = {
        load: () => null,
        save: (_owner, intent) => pendingIntentRevisions.push(intent.expectedRevision),
        clear: () => undefined
    };
    const coordinator = createRunSaveCoordinator({
        provider, store, resultStore: terminalResultStore, pendingResult, eligibility: eligibility(), scheduler: clock, createMutationId: () => 'terminal-race'
    });
    coordinator.startRun();
    await tick();
    assert.equal(pendingIntentRevisions.length, 0);
    const terminalSnapshot = completedSnapshot();
    provider.restore(terminalSnapshot);
    assert.deepEqual(pendingIntentRevisions, [0], 'terminal intent is retained before server delivery');
    pendingCreate.resolve({ success: true, acknowledgement: { revision: 1 } });
    await tick();
    assert.deepEqual(markedRevisions, [1], 'mark-terminal uses the acknowledged save revision');
    assert.deepEqual(persistedRevisions, [2], 'finalization uses the mark-terminal acknowledgement');
    assert.deepEqual(pendingIntentRevisions, [0, 1, 2], 'durable intent advances with each acknowledged CAS revision');
    coordinator.destroy();
});

test('terminal completion takes precedence over a simultaneous minute save trigger', async () => {
    const provider = new GameStateProvider(initialGameState);
    const clock = scheduler();
    const writes = [];
    const marked = [];
    const persisted = [];
    const store = {
        load: async () => ({ status: 'empty', revision: 0 }),
        create: async (_snapshot, revision) => { writes.push('create'); return { success: true, acknowledgement: { revision: revision + 1 } }; },
        save: async (_snapshot, revision) => { writes.push('save'); return { success: true, acknowledgement: { revision: revision + 1 } }; },
        markTerminal: async (_snapshot, revision) => { marked.push(revision); return { success: true, acknowledgement: { revision: revision + 1 } }; },
        discard: async () => ({ success: true, acknowledgement: { revision: 1 } })
    };
    const coordinator = createRunSaveCoordinator({
        provider, store, resultStore: { persist: async (_result, revision) => { persisted.push(revision); return { status: 'saved', message: null }; } },
        pendingResult: { load: () => null, save: () => undefined, clear: () => undefined },
        eligibility: eligibility(), scheduler: clock, createMutationId: () => `terminal-${writes.length}`
    });
    coordinator.startRun();
    await tick();
    const terminal = completedSnapshot();
    terminal.clock.activeElapsedMs = 60_000;
    terminal.terminalResult.activeElapsedMs = 60_000;
    provider.restore(terminal);
    await tick();
    assert.deepEqual(writes, ['create'], 'terminal state does not cause a separate minute save');
    assert.deepEqual(marked, [1]);
    assert.deepEqual(persisted, [2]);
    coordinator.destroy();
});

test('destroy invalidates an in-flight save completion', async () => {
    const provider = new GameStateProvider(initialGameState);
    const clock = scheduler();
    const pendingCreate = deferred();
    const statuses = [];
    let saves = 0;
    const store = {
        load: async () => ({ status: 'empty', revision: 0 }),
        create: async () => { saves++; return pendingCreate.promise; },
        save: async () => { saves++; return { success: true, acknowledgement: { revision: 2 } }; },
        markTerminal: async () => ({ success: true, acknowledgement: { revision: 1 } }),
        discard: async () => ({ success: true, acknowledgement: { revision: 1 } })
    };
    const coordinator = createRunSaveCoordinator({ provider, store, eligibility: eligibility(), scheduler: clock, createMutationId: () => 'destroy-in-flight', publish: value => statuses.push(value.status) });
    coordinator.startRun();
    await tick();
    coordinator.destroy();
    pendingCreate.resolve({ success: true, acknowledgement: { revision: 1 } });
    await tick();
    assert.equal(saves, 1);
    assert.equal(statuses.includes('saved'), false);
});

test('terminal delivery finishes after the results view unsubscribes', async () => {
    const provider = new GameStateProvider(initialGameState);
    const clock = scheduler();
    const pendingPersistence = deferred();
    const persistedRevisions = [];
    const clearedOwners = [];
    const store = {
        load: async () => ({ status: 'empty', revision: 0 }),
        create: async (_snapshot, revision) => ({ success: true, acknowledgement: { revision: revision + 1 } }),
        save: async (_snapshot, revision) => ({ success: true, acknowledgement: { revision: revision + 1 } }),
        markTerminal: async (_snapshot, revision) => ({ success: true, acknowledgement: { revision: revision + 1 } }),
        discard: async () => ({ success: true, acknowledgement: { revision: 1 } })
    };
    const coordinator = createRunSaveCoordinator({
        provider, store,
        resultStore: { persist: async (_result, revision) => { persistedRevisions.push(revision); return pendingPersistence.promise; } },
        pendingResult: { load: () => null, save: () => undefined, clear: owner => clearedOwners.push(owner) },
        eligibility: eligibility(), scheduler: clock, createMutationId: () => 'view-exit'
    });
    coordinator.startRun();
    await tick();
    let viewUpdates = 0;
    const unsubscribeView = provider.subscribe(() => { viewUpdates++; });
    provider.restore(completedSnapshot());
    await tick();
    assert.deepEqual(persistedRevisions, [2], 'game-lifetime delivery starts after terminal marking');
    unsubscribeView();
    pendingPersistence.resolve({ status: 'saved', message: null });
    await tick();
    assert.deepEqual(clearedOwners, ['owner-a']);
    assert.equal(viewUpdates, 1, 'the view left after receiving the terminal snapshot');
    coordinator.destroy();
});

test('boot resumes a persisted terminal intent and retries finalization with the authoritative revision', async () => {
    const terminalSnapshot = completedSnapshot();
    const provider = new GameStateProvider(initialGameState);
    const clock = scheduler();
    const persistedRevisions = [];
    const cleared = [];
    const intent = { terminalResult: { ...terminalSnapshot.terminalResult, cargoValue: 0, shipUpgradeSpend: 0, facilityUpgradeSpend: 0, finalScore: terminalSnapshot.credits }, snapshot: terminalSnapshot, expectedRevision: 4 };
    const store = {
        load: async () => ({ status: 'terminal-pending', revision: 5, snapshot: terminalSnapshot }),
        create: async () => { throw new Error('terminal recovery must not create an active run'); },
        save: async () => { throw new Error('terminal recovery must not save active gameplay'); },
        markTerminal: async () => { throw new Error('terminal-pending was already acknowledged'); },
        discard: async () => ({ success: true, acknowledgement: { revision: 1 } })
    };
    const resultStore = { persist: async (_result, revision) => { persistedRevisions.push(revision); return { status: 'saved', message: null }; } };
    const pendingResult = {
        load: () => intent,
        save: () => undefined,
        clear: owner => cleared.push(owner)
    };
    const coordinator = createRunSaveCoordinator({ provider, store, resultStore, pendingResult, eligibility: eligibility(), scheduler: clock, createMutationId: () => 'terminal-replay' });
    await tick();
    assert.deepEqual(persistedRevisions, [5]);
    assert.deepEqual(cleared, ['owner-a']);
    coordinator.destroy();
});

test('initial unavailable load retries with backoff and never writes before authoritative load succeeds', async () => {
    const provider = new GameStateProvider(initialGameState);
    const clock = scheduler();
    let loads = 0;
    const writes = [];
    const store = {
        load: async () => {
            loads++;
            if (loads === 1) throw new Error('offline during boot');
            return { status: 'empty', revision: 8 };
        },
        create: async (_snapshot, revision) => { writes.push(revision); return { success: true, acknowledgement: { revision: revision + 1 } }; },
        save: async (_snapshot, revision) => { writes.push(revision); return { success: true, acknowledgement: { revision: revision + 1 } }; },
        markTerminal: async () => ({ success: true, acknowledgement: { revision: 1 } }),
        discard: async () => ({ success: true, acknowledgement: { revision: 1 } })
    };
    const coordinator = createRunSaveCoordinator({ provider, store, eligibility: eligibility(), scheduler: clock, createMutationId: () => 'boot-retry' });
    coordinator.startRun();
    await tick();
    assert.equal(loads, 1);
    assert.deepEqual(writes, [], 'failed initial load cannot create using a default revision');
    await clock.advance(999);
    assert.equal(loads, 1);
    await clock.advance(1);
    await tick();
    assert.equal(loads, 2);
    assert.deepEqual(writes, [8], 'queued start is created only against the recovered authoritative revision');
    coordinator.destroy();
});

test('boot replays a local terminal intent with its original revision after server finalization', async () => {
    const terminalSnapshot = completedSnapshot();
    const provider = new GameStateProvider(initialGameState);
    const clock = scheduler();
    const expectedRevisions = [];
    const cleared = [];
    const intent = {
        terminalResult: { ...terminalSnapshot.terminalResult, cargoValue: 0, shipUpgradeSpend: 0, facilityUpgradeSpend: 0, finalScore: terminalSnapshot.credits },
        snapshot: terminalSnapshot,
        expectedRevision: 4
    };
    const store = {
        load: async () => ({ status: 'empty', revision: 5 }),
        create: async () => { throw new Error('terminal recovery must not create an active run'); },
        save: async () => { throw new Error('terminal recovery must not save active gameplay'); },
        markTerminal: async () => { throw new Error('server already finalized the terminal run'); },
        discard: async () => ({ success: true, acknowledgement: { revision: 1 } })
    };
    const resultStore = {
        persist: async (_result, expectedRevision) => {
            expectedRevisions.push(expectedRevision);
            return { status: 'saved', message: null };
        }
    };
    const pendingResult = { load: () => intent, save: () => undefined, clear: owner => cleared.push(owner) };
    const coordinator = createRunSaveCoordinator({
        provider, store, resultStore, pendingResult, eligibility: eligibility(), scheduler: clock, createMutationId: () => 'finalized-replay'
    });
    await tick();
    assert.deepEqual(expectedRevisions, [4], 'idempotent replay uses the durable intent revision, not the newer empty-slot revision');
    assert.deepEqual(cleared, ['owner-a']);
    coordinator.destroy();
});

test('failed terminal delivery keeps the intent, blocks new saves, and recovers on explicit retry', async () => {
    const provider = new GameStateProvider(initialGameState);
    const clock = scheduler();
    const revisions = [];
    const pendingWrites = [];
    const cleared = [];
    const savedRuns = [];
    const statuses = [];
    let attempts = 0;
    const store = {
        load: async () => ({ status: 'empty', revision: 0 }),
        create: async (_snapshot, revision) => { savedRuns.push('create'); return { success: true, acknowledgement: { revision: revision + 1 } }; },
        save: async (_snapshot, revision) => { savedRuns.push('save'); return { success: true, acknowledgement: { revision: revision + 1 } }; },
        markTerminal: async (_snapshot, revision) => ({ success: true, acknowledgement: { revision: revision + 1 } }),
        discard: async () => ({ success: true, acknowledgement: { revision: 1 } })
    };
    const coordinator = createRunSaveCoordinator({
        provider, store,
        resultStore: { persist: async (_result, revision) => { revisions.push(revision); attempts++; return attempts === 1 ? { status: 'failed', message: 'offline' } : { status: 'saved', message: null }; } },
        pendingResult: { load: () => null, save: (_owner, intent) => pendingWrites.push(intent.expectedRevision), clear: owner => cleared.push(owner) },
        eligibility: eligibility(), scheduler: clock, createMutationId: () => `terminal-retry-${attempts}`, publish: value => statuses.push(value.status)
    });
    coordinator.startRun();
    await tick();
    provider.restore(completedSnapshot());
    await tick();
    assert.deepEqual(revisions, [2]);
    assert.deepEqual(pendingWrites, [1, 1, 2]);
    assert.equal(statuses.includes('failed'), true);
    coordinator.requestSave();
    assert.deepEqual(savedRuns, ['create'], 'terminal-pending progress cannot be reattached as an active save');
    assert.deepEqual(cleared, []);
    coordinator.retryTerminal();
    await tick();
    assert.deepEqual(revisions, [2, 2], 'retry reuses the acknowledged finalization revision');
    assert.deepEqual(cleared, ['owner-a']);
    coordinator.destroy();
});

