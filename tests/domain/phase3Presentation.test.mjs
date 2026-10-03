import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initialGameState } from '../../src/game/definitions/initialGameState.ts';
import { projectRunStatus } from '../../src/game/application/runStatus.ts';
import { createResultDelivery } from '../../src/game/application/results/resultDelivery.ts';
import { runStatusIsVisible } from '../../src/ui/adapters/runStatusAdapter.ts';
import { createBrowserGameOverReturnPort } from '../../src/ui/adapters/browserGameOverReturn.ts';

test('health presentation has inclusive 70/69/30/29 semantic boundaries', () => {
    const band = currentHitPoints => projectRunStatus({
        ...initialGameState,
        shipStatus: { ...initialGameState.shipStatus, currentHitPoints }
    }, true).healthBand;
    assert.equal(band(70), 'healthy');
    assert.equal(band(69), 'warning');
    assert.equal(band(30), 'warning');
    assert.equal(band(29), 'critical');
});

test('terminal state hides the run-status projection during the death sequence', () => {
    const terminal = {
        ...initialGameState,
        shipStatus: { ...initialGameState.shipStatus, currentHitPoints: 0 },
        terminalResult: { runId: initialGameState.runId, outcome: 'death', activeElapsedMs: 0, finalCredits: initialGameState.credits }
    };
    assert.equal(runStatusIsVisible(true, terminal.terminalResult !== null), false);
    assert.equal(runStatusIsVisible(false, false), false);
    assert.equal(runStatusIsVisible(true, false), true);
});

test('an OAuth return restores an end-game result exactly once', () => {
    const values = new Map();
    const storage = {
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => { values.set(key, value); },
        removeItem: key => { values.delete(key); }
    };
    const returnPort = createBrowserGameOverReturnPort(storage);
    const terminalResult = { runId: initialGameState.runId, outcome: 'death', activeElapsedMs: 5_300, finalCredits: 456 };
    returnPort.save(terminalResult);
    assert.deepEqual(returnPort.take(), terminalResult);
    assert.equal(returnPort.take(), null, 'the restored result must not reopen Game Over on a later reload');
});

test('result delivery persists once, then retries the same immutable terminal result only after failure', async () => {
    const terminalResult = Object.freeze({ runId: initialGameState.runId, outcome: 'death', activeElapsedMs: 123, finalCredits: 456 });
    const calls = [];
    const statuses = [];
    const store = { persist: async result => {
        calls.push(result);
        return calls.length === 1 ? { status: 'failed', message: 'offline' } : { status: 'saved', message: null };
    } };
    const delivery = createResultDelivery(store, terminalResult, status => statuses.push(status));
    delivery.start();
    delivery.start();
    await Promise.resolve();
    assert.equal(calls.length, 1);
    assert.deepEqual(statuses, [{ status: 'pending', message: null }, { status: 'failed', message: 'offline' }]);
    delivery.retry();
    await Promise.resolve();
    assert.equal(calls.length, 2);
    assert.strictEqual(calls[0], terminalResult);
    assert.strictEqual(calls[1], terminalResult);
    assert.deepEqual(statuses.at(-1), { status: 'saved', message: null });
    delivery.retry();
    await Promise.resolve();
    assert.equal(calls.length, 2, 'a saved result never exposes another retry');
});

test('a rejected result-store promise becomes a retryable failed delivery', async () => {
    const statuses = [];
    const delivery = createResultDelivery({ persist: async () => { throw new Error('network unavailable'); } }, Object.freeze({
        runId: initialGameState.runId, outcome: 'death', activeElapsedMs: 123, finalCredits: 456
    }), status => statuses.push(status));
    delivery.start();
    await Promise.resolve();
    await Promise.resolve();
    assert.deepEqual(statuses, [
        { status: 'pending', message: null },
        { status: 'failed', message: 'network unavailable' }
    ]);
    delivery.retry();
    await Promise.resolve();
    assert.equal(statuses.filter(status => status.status === 'pending').length, 2);
});
