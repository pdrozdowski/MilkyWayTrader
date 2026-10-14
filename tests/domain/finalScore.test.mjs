import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initialGameState } from '../../src/game/definitions/initialGameState.ts';
import { calculateTerminalScore } from '../../src/game/domain/finalScore.ts';
import { createTerminalScoreResult } from '../../src/game/application/results/terminalScoreResult.ts';

const input = overrides => ({
    endingCash: 20_000,
    cargo: [],
    shipUpgradeSpend: 0,
    facilityUpgradeSpend: 0,
    ...overrides
});

test('terminal score handles empty cargo and preserves ending cash', () => {
    assert.deepEqual(calculateTerminalScore(input({})), {
        endingCash: 20_000,
        cargoValue: 0,
        shipUpgradeSpend: 0,
        facilityUpgradeSpend: 0,
        finalScore: 20_000
    });
});

test('terminal score values cargo by acquisition total cost', () => {
    const score = calculateTerminalScore(input({ cargo: [
        { commodityId: 'milk', quantity: 2, totalCost: 125.5 },
        { commodityId: 'grain', quantity: 3, totalCost: 300 }
    ] }));
    assert.equal(score.cargoValue, 425.5);
    assert.equal(score.finalScore, 20_426);
});

test('terminal score includes paid ship and facility spending', () => {
    assert.equal(calculateTerminalScore(input({ shipUpgradeSpend: 75_000 })).finalScore, 95_000);
    assert.equal(calculateTerminalScore(input({ facilityUpgradeSpend: 125_000 })).finalScore, 145_000);
});

test('terminal score rounds only once after adding every component', () => {
    const score = calculateTerminalScore(input({
        endingCash: 100.2,
        cargo: [{ commodityId: 'milk', quantity: 1, totalCost: 0.2 }],
        shipUpgradeSpend: 0.2,
        facilityUpgradeSpend: 0.2
    }));
    assert.equal(score.finalScore, 101);
});

test('terminal score is independent of the terminal outcome', () => {
    const scoreInput = input({ endingCash: 12_345, shipUpgradeSpend: 10_000, facilityUpgradeSpend: 5_000 });
    const deathScore = calculateTerminalScore(scoreInput);
    const futureOutcomeScores = ['freedom', 'imprisonment', 'abandonment'].map(() => calculateTerminalScore(scoreInput));
    assert.deepEqual(futureOutcomeScores, [deathScore, deathScore, deathScore]);
});

test('the shared terminal result combines the authoritative death facts with one score breakdown', () => {
    const state = {
        ...initialGameState,
        runId: '00000000-0000-4000-8000-000000000002',
        credits: 999,
        cargo: [{ commodityId: 'milk', quantity: 2, totalCost: 300.4 }],
        shipUpgradeSpend: 1_000,
        facilityUpgradeSpend: 2_000,
        clock: { ...initialGameState.clock, activeElapsedMs: 123.4 },
        shipStatus: { ...initialGameState.shipStatus, currentHitPoints: 0 },
        terminalResult: { runId: '00000000-0000-4000-8000-000000000002', outcome: 'death', activeElapsedMs: 123, finalCredits: 999 }
    };
    const terminal = createTerminalScoreResult(state);
    assert.deepEqual(terminal, {
        runId: state.runId,
        outcome: 'death',
        activeElapsedMs: 123,
        finalCredits: 999,
        cargoValue: 300.4,
        shipUpgradeSpend: 1_000,
        facilityUpgradeSpend: 2_000,
        finalScore: 4_299
    });
    assert(Object.isFrozen(terminal));
});
