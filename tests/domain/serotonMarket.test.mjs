import assert from 'node:assert/strict';
import { test } from 'node:test';
import { serotonCommodityDefinitionById } from '../../src/game/definitions/serotonMarketDefinitions.ts';
import { commodityPriceMultiplier, commodityUnitPrice, marginalTradeTotal } from '../../src/game/domain/marketPricing.ts';
import { initialGameState } from '../../src/game/definitions/initialGameState.ts';
import { applySerotonTrade, quoteSerotonTrade } from '../../src/game/application/serotonMarket.ts';
import { addFreeCommodity, removeCommodityQuantity, transferCommodityQuantity } from '../../src/game/application/commodityContainers.ts';

const supplies = serotonCommodityDefinitionById.supplies;
const landed = () => ({
    ...initialGameState,
    clock: { ...initialGameState.clock, pauseReasons: ['landed'] },
    planetLifecycle: { capturedPlanetId: 'seroton', landedPlanetId: 'seroton', relandingLockedPlanetId: null }
});

test('Seroton price curve covers thresholds and rounds each unit price', () => {
    const cases = [
        [0, 2], [49, 1.02], [50, 1], [150, 1], [151, 0.99], [199, 0.51], [200, 0.5], [500, 0.5]
    ];
    for (const [stock, multiplier] of cases) assert.equal(commodityPriceMultiplier(stock, supplies), multiplier);
    assert.equal(commodityUnitPrice(49, supplies), 1020);
    assert.equal(commodityUnitPrice(29, serotonCommodityDefinitionById.alloys), 5167);
    assert.equal(commodityUnitPrice(151, supplies), 990);
    assert.equal(commodityUnitPrice(199, supplies), 510);
});

test('marginal prices use each pre-change stock and preserve input values', () => {
    const stock = 51;
    assert.equal(marginalTradeTotal(stock, 3, supplies), 3020);
    assert.equal(marginalTradeTotal(149, -3, supplies), 2990);
    assert.equal(stock, 51);
});

test('Seroton trades enforce landing, stock, cargo, credits and atomically preserve invalid inputs', () => {
    assert.equal(quoteSerotonTrade(initialGameState, 'supplies', 1).failure, 'not-landed-on-seroton');
    assert.equal(quoteSerotonTrade(landed(), 'supplies', 0).failure, 'invalid-quantity');
    assert.equal(quoteSerotonTrade(landed(), 'supplies', 101).failure, 'insufficient-stock');
    assert.equal(quoteSerotonTrade({ ...landed(), credits: 1 }, 'supplies', 1).failure, 'insufficient-credits');
    assert.equal(quoteSerotonTrade({ ...landed(), cargo: [{ commodityId: 'ore', quantity: 20, totalCost: 0 }] }, 'supplies', 1).failure, 'insufficient-cargo');
    assert.equal(quoteSerotonTrade(landed(), 'supplies', -1).failure, 'insufficient-cargo-commodity');

    const before = landed();
    const bought = applySerotonTrade(before, 'supplies', 2);
    assert.equal(bought.credits, before.credits - 2_000);
    assert.deepEqual(bought.cargo, [{ commodityId: 'supplies', quantity: 2, totalCost: 2_000 }]);
    assert.equal(bought.markets[0].commodityStocks.find(stock => stock.commodityId === 'supplies').stock, 98);
    assert.deepEqual(before.cargo, []);
    assert.equal(before.markets[0].commodityStocks.find(stock => stock.commodityId === 'supplies').stock, 100);

    const sold = applySerotonTrade(bought, 'supplies', -2);
    assert.equal(sold.credits, before.credits);
    assert.deepEqual(sold.cargo, []);
    assert.equal(sold.markets[0].commodityStocks.find(stock => stock.commodityId === 'supplies').stock, 100);
    assert.equal(applySerotonTrade(before, 'supplies', 101), before);
});

test('Seroton purchases weight cargo cost basis and sales retain it until the stack is empty', () => {
    const first = applySerotonTrade(landed(), 'supplies', 2);
    const shifted = { ...first, markets: [{ ...first.markets[0], commodityStocks: first.markets[0].commodityStocks.map(stock => stock.commodityId === 'supplies' ? { ...stock, stock: 49 } : stock) }] };
    const bought = applySerotonTrade(shifted, 'supplies', 1);
    assert.equal(bought.cargo[0].totalCost, 3_020);
    const partial = applySerotonTrade(bought, 'supplies', -1);
    assert.ok(Math.abs(partial.cargo[0].totalCost - (3_020 * 2 / 3)) < 1e-9);
    assert.deepEqual(applySerotonTrade(partial, 'supplies', -2).cargo, []);
    assert.deepEqual(first.cargo, [{ commodityId: 'supplies', quantity: 2, totalCost: 2_000 }]);
});

test('container transfers, free pickup, and loss retain independent proportional cost', () => {
    const source = { commodityId: 'supplies', quantity: 3, totalCost: 10 };
    const partial = transferCommodityQuantity(source, { commodityId: 'supplies', quantity: 2, totalCost: 4 }, 1);
    assert.equal(partial.source.commodityId, 'supplies');
    assert.equal(partial.source.quantity, 2);
    assert.ok(Math.abs(partial.source.totalCost - (20 / 3)) < 1e-9);
    assert.equal(partial.destination.commodityId, 'supplies');
    assert.equal(partial.destination.quantity, 3);
    assert.ok(Math.abs(partial.destination.totalCost - (22 / 3)) < 1e-9);
    const complete = transferCommodityQuantity(partial.source, partial.destination, 2);
    assert.equal(complete.source, null);
    assert.equal(complete.destination.totalCost, 14, 'a complete transfer carries the exact residual');
    assert.deepEqual(addFreeCommodity({ commodityId: 'supplies', quantity: 1, totalCost: 8 }, 'supplies', 2), { commodityId: 'supplies', quantity: 3, totalCost: 8 });
    assert.deepEqual(removeCommodityQuantity({ commodityId: 'alloys', quantity: 2, totalCost: 9 }, 2), { remaining: null, removed: { commodityId: 'alloys', quantity: 2, totalCost: 9 } });
});
