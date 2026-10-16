import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyFacilityBuild, applyFacilityDowngrade, applyFacilityUpgrade, quoteFacilityDowngrade, quoteFacilityInvestment } from '../../src/game/application/planetFacilities.ts';
import { landedCommodityFlow, projectLandedFacilities } from '../../src/game/application/landedFacilities.ts';
import { GameStateProvider } from '../../src/game/application/gameStateProvider.ts';
import { planetFacilityCatalogue, planetFacilityDefinitions, planetFacilityModifierOf, planetFacilityOutputCommodityIds } from '../../src/game/definitions/planetFacilityDefinitions.ts';
import { initialGameState } from '../../src/game/definitions/initialGameState.ts';
import { advancePlanetFacilities } from '../../src/game/mechanics/planetFacilitySimulation.ts';

const clone = value => JSON.parse(JSON.stringify(value));

const landedOn = planetId => ({
    ...clone(initialGameState),
    clock: { ...clone(initialGameState.clock), playerPaused: true, pauseReasons: [] },
    planetLifecycle: { capturedPlanetId: planetId, landedPlanetId: planetId, relandingLockedPlanetId: null }
});

const facilityOf = (state, planetId, facilityId) => state.markets
    .find(market => market.planetId === planetId).facilities
    .find(facility => facility.facilityId === facilityId);

const withFacilityLevel = (state, planetId, facilityId, level) => ({
    ...state,
    markets: state.markets.map(market => market.planetId === planetId ? {
        ...market,
        facilities: market.facilities.map(facility => facility.facilityId === facilityId
            ? { ...facility, level, status: level === 0 ? 'notBuilt' : 'working' }
            : facility)
    } : market)
});

test('facility investment quotes reject the not-landed, unknown, unavailable and unaffordable cases', () => {
    assert.equal(quoteFacilityInvestment(clone(initialGameState), planetFacilityCatalogue, 'dairyFarm', 'build').failure, 'not-landed');

    const seroton = landedOn('seroton');
    assert.equal(quoteFacilityInvestment(seroton, planetFacilityCatalogue, 'unknownFacility', 'build').failure, 'unknown-facility');
    assert.equal(quoteFacilityInvestment(seroton, planetFacilityCatalogue, 'cheeseFactory', 'build').failure, 'unavailable');
    assert.equal(quoteFacilityInvestment(seroton, planetFacilityCatalogue, 'dairyFarm', 'build').failure, null);
    assert.equal(quoteFacilityInvestment(seroton, planetFacilityCatalogue, 'bakery', 'upgrade').failure, 'unavailable');
    const maxed = withFacilityLevel(seroton, 'seroton', 'bakery', 3);
    assert.equal(quoteFacilityInvestment(maxed, planetFacilityCatalogue, 'bakery', 'upgrade').failure, 'unavailable');

    const unaffordable = quoteFacilityInvestment({ ...seroton, credits: 34_999 }, planetFacilityCatalogue, 'bakery', 'build');
    assert.equal(unaffordable.failure, 'insufficient-credits');
    assert.equal(unaffordable.price, 35_000);
    const affordable = quoteFacilityInvestment(seroton, planetFacilityCatalogue, 'bakery', 'build');
    assert.equal(affordable.failure, null);
    assert.equal(affordable.level, 0);
    assert.equal(affordable.targetLevel, 1);
    assert.equal(affordable.price, 35_000);
});

test('discounted prices follow the specialized facility and planet pairing on both steps', () => {
    const cases = [
        ['seroton', 'cheeseFactory', 1, 'upgrade', 28_000],
        ['seroton', 'cheeseFactory', 2, 'upgrade', 80_000],
        ['lactozis-7c', 'cheeseFactory', 0, 'build', 35_000],
        ['maslo-prime', 'dairyFarm', 1, 'upgrade', 20_000],
        ['maslo-prime', 'dairyFarm', 2, 'upgrade', 60_000],
        ['lactozis-7c', 'grainFarm', 1, 'upgrade', 20_000],
        ['lactozis-7c', 'grainFarm', 2, 'upgrade', 60_000],
        ['seroton', 'dairyFarm', 1, 'upgrade', 25_000],
        ['seroton', 'dairyFarm', 2, 'upgrade', 75_000],
        ['lactozis-7c', 'cheeseFactory', 1, 'upgrade', 35_000]
    ];
    for (const [planetId, facilityId, level, action, price] of cases) {
        const state = withFacilityLevel(landedOn(planetId), planetId, facilityId, level);
        const quote = quoteFacilityInvestment(state, planetFacilityCatalogue, facilityId, action);
        assert.equal(quote.failure, null, `${facilityId}@${planetId}`);
        assert.equal(quote.price, price, `${facilityId}@${planetId} level ${level}`);
    }
});

test('building and upgrading deduct only credits and touch only the landed facility', () => {
    const provider = new GameStateProvider(landedOn('maslo-prime'));
    const before = provider.snapshot();
    assert.equal(quoteFacilityInvestment(before, planetFacilityCatalogue, 'dairyFarm', 'upgrade').price, 20_000);

    const after = provider.update(state => applyFacilityUpgrade(state, planetFacilityCatalogue, 'dairyFarm'));
    assert.equal(after.credits, before.credits - 20_000);
    assert.equal(after.facilityUpgradeSpend, before.facilityUpgradeSpend + 20_000);
    assert.deepEqual(facilityOf(after, 'maslo-prime', 'dairyFarm'), { facilityId: 'dairyFarm', level: 2, status: 'working' });
    assert.deepEqual(after.cargo, before.cargo);
    assert.deepEqual(after.orbitalCargo, before.orbitalCargo);
    assert.deepEqual(after.looseItems, before.looseItems);
    assert.deepEqual(after.markets.map(market => market.commodityStocks), before.markets.map(market => market.commodityStocks));
    for (const facilityId of ['grainFarm', 'cheeseFactory', 'bakery', 'foodProcessor']) {
        assert.deepEqual(facilityOf(after, 'maslo-prime', facilityId), facilityOf(before, 'maslo-prime', facilityId), facilityId);
    }
    for (const planetId of ['seroton', 'lactozis-7c']) {
        assert.deepEqual(after.markets.find(market => market.planetId === planetId), before.markets.find(market => market.planetId === planetId), planetId);
    }
});

test('building a level-zero facility pays the first price and marks it working', () => {
    const provider = new GameStateProvider(landedOn('seroton'));
    const before = provider.snapshot();
    const bakery = provider.update(state => applyFacilityBuild(state, planetFacilityCatalogue, 'bakery'));
    assert.equal(bakery.credits, before.credits - 35_000);
    assert.equal(bakery.facilityUpgradeSpend, before.facilityUpgradeSpend + 35_000);
    assert.deepEqual(facilityOf(bakery, 'seroton', 'bakery'), { facilityId: 'bakery', level: 1, status: 'working' });

    const processed = provider.update(state => applyFacilityBuild(state, planetFacilityCatalogue, 'foodProcessor'));
    assert.equal(processed.credits, before.credits - 35_000 - 50_000);
    assert.equal(processed.facilityUpgradeSpend, before.facilityUpgradeSpend + 35_000 + 50_000);
    assert.deepEqual(facilityOf(processed, 'seroton', 'foodProcessor'), { facilityId: 'foodProcessor', level: 1, status: 'working' });
    assert.deepEqual(facilityOf(processed, 'lactozis-7c', 'bakery'), { facilityId: 'bakery', level: 0, status: 'notBuilt' });
});

test('upgrade steps use each step price and stop at the maximum level', () => {
    const provider = new GameStateProvider(landedOn('maslo-prime'));
    const second = provider.update(state => applyFacilityUpgrade(state, planetFacilityCatalogue, 'dairyFarm'));
    assert.equal(second.credits, initialGameState.credits - 20_000);
    assert.equal(facilityOf(second, 'maslo-prime', 'dairyFarm').level, 2);

    const third = provider.update(state => applyFacilityUpgrade(state, planetFacilityCatalogue, 'dairyFarm'));
    assert.equal(third.credits, initialGameState.credits - 20_000 - 60_000);
    assert.equal(facilityOf(third, 'maslo-prime', 'dairyFarm').level, 3);
    assert.equal(quoteFacilityInvestment(third, planetFacilityCatalogue, 'dairyFarm', 'upgrade').failure, 'unavailable');

    const blocked = provider.update(state => applyFacilityUpgrade(state, planetFacilityCatalogue, 'dairyFarm'));
    assert.deepEqual(blocked, third);
});

test('downgrades refund 75 percent of the most recent planet-adjusted upgrade and respect the starting level', () => {
    const initial = landedOn('maslo-prime');
    const cannotDowngrade = quoteFacilityDowngrade(initial, planetFacilityCatalogue, 'dairyFarm');
    assert.equal(cannotDowngrade.failure, 'minimum-level');
    assert.equal(applyFacilityDowngrade(initial, planetFacilityCatalogue, 'dairyFarm'), initial);

    const upgraded = applyFacilityUpgrade(initial, planetFacilityCatalogue, 'dairyFarm');
    const quote = quoteFacilityDowngrade(upgraded, planetFacilityCatalogue, 'dairyFarm');
    assert.equal(quote.failure, null);
    assert.equal(quote.targetLevel, 1);
    assert.equal(quote.refund, 15_000, '75% of the 20,000 discounted upgrade price is refunded');
    const downgraded = applyFacilityDowngrade(upgraded, planetFacilityCatalogue, 'dairyFarm');
    assert.equal(downgraded.credits, upgraded.credits + 15_000);
    assert.equal(downgraded.facilityUpgradeSpend, upgraded.facilityUpgradeSpend, 'the historical amount paid remains in the score after refund');
    assert.equal(downgraded.facilityUpgradeSpend, upgraded.facilityUpgradeSpend, 'refunds do not alter cumulative paid spending');
    assert.equal(facilityOf(downgraded, 'maslo-prime', 'dairyFarm').level, 1);
    assert.equal(quoteFacilityDowngrade(withFacilityLevel(initial, 'maslo-prime', 'dairyFarm', 3), planetFacilityCatalogue, 'dairyFarm').refund, 45_000);
});

test('rejected investment commands return the unchanged aggregate', () => {
    const unlanded = clone(initialGameState);
    assert.equal(applyFacilityBuild(unlanded, planetFacilityCatalogue, 'bakery'), unlanded);
    assert.equal(applyFacilityUpgrade(unlanded, planetFacilityCatalogue, 'dairyFarm'), unlanded);

    const seroton = landedOn('seroton');
    assert.equal(applyFacilityBuild(seroton, planetFacilityCatalogue, 'cheeseFactory'), seroton);
    assert.equal(applyFacilityUpgrade(seroton, planetFacilityCatalogue, 'bakery'), seroton);
    assert.equal(applyFacilityBuild(seroton, planetFacilityCatalogue, 'unknownFacility'), seroton);
    const broke = { ...seroton, credits: 0 };
    assert.equal(applyFacilityBuild(broke, planetFacilityCatalogue, 'bakery'), broke);
    assert.equal(applyFacilityBuild(broke, planetFacilityCatalogue, 'bakery').facilityUpgradeSpend, broke.facilityUpgradeSpend);
    const maxed = withFacilityLevel(seroton, 'seroton', 'bakery', 3);
    assert.equal(applyFacilityUpgrade(maxed, planetFacilityCatalogue, 'bakery'), maxed);
});
test('landed commodity flow aggregates per-second production, consumption and net across the planet facilities', () => {
    const state = landedOn('seroton');
    const seroton = {
        ...state,
        markets: state.markets.map(market => market.planetId === 'seroton' ? {
            ...market,
            commodityStocks: market.commodityStocks.map(stock => stock.commodityId === 'milk' ? { ...stock, stock: 0 } : stock)
        } : market)
    };
    const projectionCatalogue = {
        definitions: planetFacilityDefinitions.map(definition => ({ ...definition, outputCommodityId: planetFacilityOutputCommodityIds[definition.id] })),
        modifierOf: planetFacilityModifierOf
    };
    const facilities = projectLandedFacilities(seroton, projectionCatalogue);
    assert.deepEqual(facilities.facilities.find(facility => facility.facilityId === 'cheeseFactory').inputsPerCycle, [
        { commodityId: 'milk', quantity: 2, missing: true }
    ], 'an insufficient recipe identifies the missing milk input');

    // Seroton opens Cheese Factory L1: 2 milk become 6 cheese, with the planet bonus rounding output to 7.
    assert.deepEqual(landedCommodityFlow(facilities, 'milk'), { productionPerSecond: 0, consumptionPerSecond: 2, netPerSecond: -2 });
    assert.deepEqual(landedCommodityFlow(facilities, 'cheese'), { productionPerSecond: 7, consumptionPerSecond: 0, netPerSecond: 7 });
    assert.deepEqual(landedCommodityFlow(facilities, 'spaceRation'), { productionPerSecond: 0, consumptionPerSecond: 1, netPerSecond: -1 });

    const withBakery = withFacilityLevel(withFacilityLevel(seroton, 'seroton', 'grainFarm', 1), 'seroton', 'bakery', 1);
    assert.deepEqual(landedCommodityFlow(projectLandedFacilities(withBakery, projectionCatalogue), 'grain'), { productionPerSecond: 10, consumptionPerSecond: 2, netPerSecond: 8 });
    assert.deepEqual(landedCommodityFlow(projectLandedFacilities(withBakery, projectionCatalogue), 'spaceRation'), { productionPerSecond: 0, consumptionPerSecond: 3, netPerSecond: -3 });
});

test('facility simulation consumes and produces each configured level recipe once per cycle', () => {
    const recipes = [
        ['cheeseFactory', 'milk', [2, 4, 8], 'cheese', [6, 12, 20]],
        ['bakery', 'grain', [2, 4, 8], 'bun', [6, 12, 20]],
        ['foodProcessor', null, [
            { cheese: 2, bun: 1, milk: 1 },
            { cheese: 4, bun: 2, milk: 2 },
            { cheese: 8, bun: 4, milk: 4 }
        ], 'spaceRation', [6, 12, 24]]
    ];
    for (const [facilityId, singleInput, inputsByLevel, outputId, outputs] of recipes) {
        for (let level = 1; level <= 3; level++) {
            const market = clone(initialGameState.markets.find(candidate => candidate.planetId === 'lactozis-7c'));
            market.facilities = market.facilities.map(facility => ({ ...facility, level: facility.facilityId === facilityId ? level : 0, status: facility.facilityId === facilityId ? 'working' : 'notBuilt' }));
            const inputs = singleInput ? { [singleInput]: inputsByLevel[level - 1] } : inputsByLevel[level - 1];
            market.commodityStocks = market.commodityStocks.map(stock => ({
                ...stock,
                stock: stock.commodityId === outputId ? (outputId === 'spaceRation' ? level : 0) : stock.commodityId === 'spaceRation' ? 100 : inputs[stock.commodityId] ?? 0
            }));

            const advanced = advancePlanetFacilities(market, 1);
            assert.equal(advanced.commodityStocks.find(stock => stock.commodityId === outputId).stock, outputs[level - 1], `${facilityId} level ${level} output`);
            for (const [commodityId, quantity] of Object.entries(inputs)) {
                assert.equal(advanced.commodityStocks.find(stock => stock.commodityId === commodityId).stock, 0, `${facilityId} level ${level} consumes ${commodityId}`);
            }
            assert.equal(advanced.facilities.find(facility => facility.facilityId === facilityId).status, 'working', `${facilityId} level ${level} status`);
        }
    }
});

test('each planet consumes Space Rations equal to all facility levels per cycle and never below zero', () => {
    for (const market of initialGameState.markets) {
        const result = advancePlanetFacilities(market, 1);
        assert.equal(result.commodityStocks.find(stock => stock.commodityId === 'spaceRation').stock, 19, market.planetId);
    }

    const seroton = landedOn('seroton');
    const processorBuilt = withFacilityLevel(seroton, 'seroton', 'foodProcessor', 3);
    const economy = processorBuilt.markets[0];
    const resourceStarvedEconomy = {
        ...economy,
        commodityStocks: economy.commodityStocks.map(stock => ['milk', 'cheese', 'bun'].includes(stock.commodityId)
            ? { ...stock, stock: 0 }
            : stock.commodityId === 'spaceRation' ? { ...stock, stock: 2 } : stock)
    };
    const result = advancePlanetFacilities(resourceStarvedEconomy, 1);
    assert.equal(result.facilities.find(facility => facility.facilityId === 'foodProcessor').status, 'insufficientResources');
    assert.equal(result.commodityStocks.find(stock => stock.commodityId === 'spaceRation').stock, 0);
    assert(result.commodityStocks.every(stock => stock.stock >= 0));
});
