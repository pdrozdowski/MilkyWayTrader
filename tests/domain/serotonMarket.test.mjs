import assert from 'node:assert/strict';
import { test } from 'node:test';
import { serotonCommodityDefinitionById } from '../../src/game/definitions/serotonMarketDefinitions.ts';
import { commodityPriceMultiplier, commodityUnitPrice, marginalTradeTotal } from '../../src/game/domain/marketPricing.ts';
import { initialGameState } from '../../src/game/definitions/initialGameState.ts';
import { applyLandedTrade, quoteLandedTrade } from '../../src/game/application/serotonMarket.ts';
import { addFreeCommodity, removeCommodityQuantity, transferCommodityQuantity } from '../../src/game/application/commodityContainers.ts';

const milk = serotonCommodityDefinitionById.milk;
const grain = serotonCommodityDefinitionById.grain;
const cheese = serotonCommodityDefinitionById.cheese;
const spaceRation = serotonCommodityDefinitionById.spaceRation;
const landed = () => ({
    ...initialGameState,
    clock: { ...initialGameState.clock, pauseReasons: ['landed'] },
    planetLifecycle: { capturedPlanetId: 'seroton', landedPlanetId: 'seroton', relandingLockedPlanetId: null }
});

test('Milk price curve covers thresholds and rounds each unit price', () => {
    const cases = [
        [0, 2], [50, 1.5], [100, 1], [300, 1], [350, 0.75], [400, 0.5], [5_000, 0.5]
    ];
    for (const [stock, multiplier] of cases) assert.equal(commodityPriceMultiplier(stock, milk), multiplier);
    assert.equal(commodityUnitPrice(0, milk), 200);
    assert.equal(commodityUnitPrice(50, milk), 150);
    assert.equal(commodityUnitPrice(100, milk), 100);
    assert.equal(commodityUnitPrice(350, milk), 75);
    assert.equal(commodityUnitPrice(50, cheese), 450);
    assert.equal(commodityUnitPrice(320, cheese), 270);
    assert.equal(commodityUnitPrice(400, cheese), 150);
    assert.equal(commodityUnitPrice(50, spaceRation), 1_875);
    assert.equal(commodityUnitPrice(200, grain), 150);
});

test('marginal prices use each pre-change stock and preserve input values', () => {
    const stock = 100;
    assert.equal(marginalTradeTotal(stock, 3, spaceRation), 3788);
    assert.equal(marginalTradeTotal(stock, -3, spaceRation), 3750);
    assert.equal(stock, 100);
});

test('landed trades enforce landing, stock, cargo, credits and atomically preserve invalid inputs', () => {
    assert.equal(quoteLandedTrade(initialGameState, 'grain', 1).failure, 'not-landed');
    assert.equal(quoteLandedTrade(landed(), 'grain', 0).failure, 'invalid-quantity');
    assert.equal(quoteLandedTrade(landed(), 'grain', 101).failure, 'insufficient-stock');
    assert.equal(quoteLandedTrade({ ...landed(), credits: 1 }, 'grain', 1).failure, 'insufficient-credits');
    assert.equal(quoteLandedTrade({ ...landed(), cargo: [{ commodityId: 'ore', quantity: 20, totalCost: 0 }] }, 'grain', 1).failure, 'insufficient-cargo');
    assert.equal(quoteLandedTrade(landed(), 'grain', -1).failure, 'insufficient-cargo-commodity');

    const before = landed();
    const bought = applyLandedTrade(before, 'grain', 2);
    assert.equal(bought.credits, before.credits - 302);
    assert.deepEqual(bought.cargo, [{ commodityId: 'grain', quantity: 2, totalCost: 302 }]);
    assert.equal(bought.markets.find(market => market.planetId === 'seroton').commodityStocks.find(stock => stock.commodityId === 'grain').stock, 98);
    assert.deepEqual(before.cargo, []);
    assert.equal(before.markets.find(market => market.planetId === 'seroton').commodityStocks.find(stock => stock.commodityId === 'grain').stock, 100);

    const sold = applyLandedTrade(bought, 'grain', -2);
    assert.equal(sold.credits, bought.credits + 305);
    assert.deepEqual(sold.cargo, []);
    assert.equal(sold.markets.find(market => market.planetId === 'seroton').commodityStocks.find(stock => stock.commodityId === 'grain').stock, 100);
    assert.equal(applyLandedTrade(before, 'grain', 101), before);
});

test('landed purchases weight cargo cost basis and sales retain it until the stack is empty', () => {
    const first = applyLandedTrade(landed(), 'grain', 2);
    const firstSeroton = first.markets.find(market => market.planetId === 'seroton');
    const shifted = {
        ...first,
        markets: first.markets.map(market => market.planetId === 'seroton'
            ? { ...market, commodityStocks: market.commodityStocks.map(stock => stock.commodityId === 'grain' ? { ...stock, stock: 500 } : stock) }
            : market)
    };
    assert.equal(firstSeroton.commodityStocks.find(stock => stock.commodityId === 'grain').stock, 98);
    const bought = applyLandedTrade(shifted, 'grain', 1);
    assert.equal(bought.cargo[0].totalCost, 377);
    const partial = applyLandedTrade(bought, 'grain', -1);
    assert.ok(Math.abs(partial.cargo[0].totalCost - (377 * 2 / 3)) < 1e-9);
    assert.deepEqual(applyLandedTrade(partial, 'grain', -2).cargo, []);
    assert.deepEqual(first.cargo, [{ commodityId: 'grain', quantity: 2, totalCost: 302 }]);
});

test('quotes and trades route to the landed planet and leave every other market untouched', () => {
    for (const planet of initialGameState.planets) {
        const landedOn = {
            ...initialGameState,
            planetLifecycle: { capturedPlanetId: planet.id, landedPlanetId: planet.id, relandingLockedPlanetId: null }
        };
        const quote = quoteLandedTrade(landedOn, 'cheese', 2);
        assert.equal(quote.failure, null, planet.name);
        const traded = applyLandedTrade(landedOn, 'cheese', 2);
        for (const market of traded.markets) {
            const baseline = initialGameState.markets.find(candidate => candidate.planetId === market.planetId)
                .commodityStocks.find(candidate => candidate.commodityId === 'cheese').stock;
            const stock = market.commodityStocks.find(candidate => candidate.commodityId === 'cheese').stock;
            assert.equal(stock, market.planetId === planet.id ? baseline - 2 : baseline, `${market.planetId} after trading at ${planet.name}`);
        }
    }
    const orphan = { ...landed(), markets: initialGameState.markets.filter(market => market.planetId !== 'seroton') };
    assert.throws(() => quoteLandedTrade(orphan, 'milk', 1), /Missing market for landed planet/);
});

test('container transfers, free pickup, and loss retain independent proportional cost', () => {
    const source = { commodityId: 'milk', quantity: 3, totalCost: 10 };
    const partial = transferCommodityQuantity(source, { commodityId: 'milk', quantity: 2, totalCost: 4 }, 1);
    assert.equal(partial.source.commodityId, 'milk');
    assert.equal(partial.source.quantity, 2);
    assert.ok(Math.abs(partial.source.totalCost - (20 / 3)) < 1e-9);
    assert.equal(partial.destination.commodityId, 'milk');
    assert.equal(partial.destination.quantity, 3);
    assert.ok(Math.abs(partial.destination.totalCost - (22 / 3)) < 1e-9);
    const complete = transferCommodityQuantity(partial.source, partial.destination, 2);
    assert.equal(complete.source, null);
    assert.equal(complete.destination.totalCost, 14, 'a complete transfer carries the exact residual');
    assert.deepEqual(addFreeCommodity({ commodityId: 'milk', quantity: 1, totalCost: 8 }, 'milk', 2), { commodityId: 'milk', quantity: 3, totalCost: 8 });
    assert.deepEqual(removeCommodityQuantity({ commodityId: 'grain', quantity: 2, totalCost: 9 }, 2), { remaining: null, removed: { commodityId: 'grain', quantity: 2, totalCost: 9 } });
});
