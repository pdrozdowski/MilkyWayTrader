import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initialGameState } from '../../src/game/definitions/initialGameState.ts';
import { projectRunStatus } from '../../src/game/application/runStatus.ts';
import { projectLandedShipyard } from '../../src/game/application/landedShipyard.ts';
import { createResultDelivery } from '../../src/game/application/results/resultDelivery.ts';
import { runStatusIsVisible } from '../../src/ui/adapters/runStatusAdapter.ts';
import { createBrowserGameOverReturnPort } from '../../src/ui/adapters/browserGameOverReturn.ts';
import { terminalOutcomeBackgroundKey } from '../../src/game/application/results/terminalOutcomePresentation.ts';

test('terminal outcomes select the matching end-game background', () => {
    assert.equal(terminalOutcomeBackgroundKey('freedom'), 'game-over:debt-paid');
    assert.equal(terminalOutcomeBackgroundKey('imprisonment'), 'game-over:debt-due');
    assert.equal(terminalOutcomeBackgroundKey('death'), 'game-over:destroyed-ship');
});

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

test('the shipyard repair band reuses the run-status hull-health boundaries', () => {
    for (const currentHitPoints of [100, 70, 69, 30, 29, 0]) {
        const state = { ...initialGameState, shipStatus: { ...initialGameState.shipStatus, currentHitPoints } };
        assert.equal(projectLandedShipyard(state).repair.healthBand, projectRunStatus(state, true).healthBand, `HP ${currentHitPoints}`);
    }
    const landed = {
        ...initialGameState,
        clock: { ...initialGameState.clock, playerPaused: true, pauseReasons: [] },
        shipStatus: { ...initialGameState.shipStatus, currentHitPoints: 75 },
        planetLifecycle: { capturedPlanetId: 'seroton', landedPlanetId: 'seroton', relandingLockedPlanetId: null }
    };
    assert.equal(projectLandedShipyard(landed).repair.healthBand, 'healthy');
    assert.equal(projectLandedShipyard({ ...landed, shipStatus: { ...landed.shipStatus, currentHitPoints: 85 } }).repair.healthBand, 'healthy');
    assert.equal(projectLandedShipyard({ ...landed, shipStatus: { ...landed.shipStatus, currentHitPoints: 25 } }).repair.healthBand, 'critical');
});

test('terminal state hides the run-status projection during the death sequence', () => {
    const terminal = {
        ...initialGameState,
        shipStatus: { ...initialGameState.shipStatus, currentHitPoints: 0 },
        terminalResult: { runId: initialGameState.runId, outcome: 'death', activeElapsedMs: 0, finalCredits: initialGameState.credits, cargoValue: 0, shipUpgradeSpend: 0, facilityUpgradeSpend: 0, finalScore: initialGameState.credits }
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
    const terminalResult = { runId: initialGameState.runId, outcome: 'death', activeElapsedMs: 5_300, finalCredits: 456, cargoValue: 0, shipUpgradeSpend: 0, facilityUpgradeSpend: 0, finalScore: 456 };
    returnPort.save(terminalResult);
    assert.deepEqual(returnPort.take(), terminalResult);
    assert.equal(returnPort.take(), null, 'the restored result must not reopen Game Over on a later reload');
});

test('end-game OAuth return accepts each S-06 outcome exactly once', () => {
    const values = new Map();
    const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
    const port = createBrowserGameOverReturnPort(storage);
    for (const outcome of ['death', 'freedom', 'imprisonment']) {
        const result = { runId: initialGameState.runId, outcome, activeElapsedMs: 5_300, finalCredits: 456, cargoValue: 0, shipUpgradeSpend: 0, facilityUpgradeSpend: 0, finalScore: 456 };
        port.save(result);
        assert.deepEqual(port.take(), result);
    }
    values.set('milky-way-trader.game-over-return', JSON.stringify({ runId: initialGameState.runId, outcome: 'abandoned', activeElapsedMs: 1, finalCredits: 0, cargoValue: 0, shipUpgradeSpend: 0, facilityUpgradeSpend: 0, finalScore: 0 }));
    assert.equal(port.take(), null);
});

test('result delivery persists once, then retries the same immutable terminal result only after failure', async () => {
    const terminalResult = Object.freeze({ runId: initialGameState.runId, outcome: 'death', activeElapsedMs: 123, finalCredits: 456, cargoValue: 0, shipUpgradeSpend: 0, facilityUpgradeSpend: 0, finalScore: 456 });
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
        runId: initialGameState.runId, outcome: 'death', activeElapsedMs: 123, finalCredits: 456, cargoValue: 0, shipUpgradeSpend: 0, facilityUpgradeSpend: 0, finalScore: 456
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
