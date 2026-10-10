import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyFacilityBuild, applyFacilityDowngrade, applyFacilityUpgrade, quoteFacilityDowngrade, quoteFacilityInvestment } from '../../src/game/application/planetFacilities.ts';
import { landedCommodityFlow, projectLandedFacilities } from '../../src/game/application/landedFacilities.ts';
import { GameStateProvider } from '../../src/game/application/gameStateProvider.ts';
import { planetFacilityCatalogue, planetFacilityDefinitions, planetFacilityModifierOf, planetFacilityOutputCommodityIds } from '../../src/game/definitions/planetFacilityDefinitions.ts';
import { initialGameState } from '../../src/game/definitions/initialGameState.ts';

const clone = value => JSON.parse(JSON.stringify(value));

const landedOn = planetId => ({
    ...clone(initialGameState),
    clock: { ...clone(initialGameState.clock), pauseReasons: ['landed'] },
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
    assert.equal(quoteFacilityInvestment(seroton, planetFacilityCatalogue, 'dairyFarm', 'build').failure, 'unavailable');
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
        ['seroton', 'cheeseFactory', 0, 'build', 28_000],
        ['seroton', 'cheeseFactory', 1, 'upgrade', 28_000],
        ['seroton', 'cheeseFactory', 2, 'upgrade', 80_000],
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
    assert.deepEqual(facilityOf(bakery, 'seroton', 'bakery'), { facilityId: 'bakery', level: 1, status: 'working' });

    const processed = provider.update(state => applyFacilityBuild(state, planetFacilityCatalogue, 'foodProcessor'));
    assert.equal(processed.credits, before.credits - 35_000 - 50_000);
    assert.deepEqual(facilityOf(processed, 'seroton', 'foodProcessor'), { facilityId: 'foodProcessor', level: 1, status: 'working' });
    assert.deepEqual(facilityOf(processed, 'lactozis-7c', 'bakery'), { facilityId: 'bakery', level: 0, status: 'notBuilt' });
});

test('upgrade steps use each step price and stop at the maximum level', () => {
    const provider = new GameStateProvider(landedOn('seroton'));
    const second = provider.update(state => applyFacilityUpgrade(state, planetFacilityCatalogue, 'dairyFarm'));
    assert.equal(second.credits, initialGameState.credits - 25_000);
    assert.equal(facilityOf(second, 'seroton', 'dairyFarm').level, 2);

    const third = provider.update(state => applyFacilityUpgrade(state, planetFacilityCatalogue, 'dairyFarm'));
    assert.equal(third.credits, initialGameState.credits - 25_000 - 75_000);
    assert.equal(facilityOf(third, 'seroton', 'dairyFarm').level, 3);
    assert.equal(quoteFacilityInvestment(third, planetFacilityCatalogue, 'dairyFarm', 'upgrade').failure, 'unavailable');

    const blocked = provider.update(state => applyFacilityUpgrade(state, planetFacilityCatalogue, 'dairyFarm'));
    assert.deepEqual(blocked, third);
});

test('downgrades refund 75 percent of the most recent planet-adjusted upgrade and respect the starting level', () => {
    const initial = landedOn('maslo-prime');
    const cannotDowngrade = quoteFacilityDowngrade(initial, planetFacilityCatalogue, 'dairyFarm');
    assert.equal(cannotDowngrade.failure, 'minimum-level');
    assert.equal(applyFacilityDowngrade(initial, planetFacilityCatalogue, 'dairyFarm'), initial);

    const upgraded = withFacilityLevel(initial, 'maslo-prime', 'dairyFarm', 2);
    const quote = quoteFacilityDowngrade(upgraded, planetFacilityCatalogue, 'dairyFarm');
    assert.equal(quote.failure, null);
    assert.equal(quote.targetLevel, 1);
    assert.equal(quote.refund, 15_000, '75% of the 20,000 discounted upgrade price is refunded');
    const downgraded = applyFacilityDowngrade(upgraded, planetFacilityCatalogue, 'dairyFarm');
    assert.equal(downgraded.credits, upgraded.credits + 15_000);
    assert.equal(facilityOf(downgraded, 'maslo-prime', 'dairyFarm').level, 1);
    assert.equal(quoteFacilityDowngrade(withFacilityLevel(initial, 'maslo-prime', 'dairyFarm', 3), planetFacilityCatalogue, 'dairyFarm').refund, 45_000);
});

test('rejected investment commands return the unchanged aggregate', () => {
    const unlanded = clone(initialGameState);
    assert.equal(applyFacilityBuild(unlanded, planetFacilityCatalogue, 'bakery'), unlanded);
    assert.equal(applyFacilityUpgrade(unlanded, planetFacilityCatalogue, 'dairyFarm'), unlanded);

    const seroton = landedOn('seroton');
    assert.equal(applyFacilityBuild(seroton, planetFacilityCatalogue, 'dairyFarm'), seroton);
    assert.equal(applyFacilityUpgrade(seroton, planetFacilityCatalogue, 'bakery'), seroton);
    assert.equal(applyFacilityBuild(seroton, planetFacilityCatalogue, 'unknownFacility'), seroton);
    const broke = { ...seroton, credits: 0 };
    assert.equal(applyFacilityBuild(broke, planetFacilityCatalogue, 'bakery'), broke);
    const maxed = withFacilityLevel(seroton, 'seroton', 'bakery', 3);
    assert.equal(applyFacilityUpgrade(maxed, planetFacilityCatalogue, 'bakery'), maxed);
});
test('landed commodity flow aggregates per-second production, consumption and net across the planet facilities', () => {
    const seroton = landedOn('seroton');
    const projectionCatalogue = {
        definitions: planetFacilityDefinitions.map(definition => ({ ...definition, outputCommodityId: planetFacilityOutputCommodityIds[definition.id] })),
        modifierOf: planetFacilityModifierOf
    };
    const facilities = projectLandedFacilities(seroton, projectionCatalogue);

    // Seroton opens dairyFarm L1 (10 milk/s) and cheeseFactory L1 (2 * round(5 * 1.2) = 12 milk/s input, 6 cheese/s output).
    assert.deepEqual(landedCommodityFlow(facilities, 'milk'), { productionPerSecond: 10, consumptionPerSecond: 12, netPerSecond: -2 });
    assert.deepEqual(landedCommodityFlow(facilities, 'cheese'), { productionPerSecond: 6, consumptionPerSecond: 0, netPerSecond: 6 });
    assert.deepEqual(landedCommodityFlow(facilities, 'spaceRation'), { productionPerSecond: 0, consumptionPerSecond: 0, netPerSecond: 0 });

    const withBakery = withFacilityLevel(seroton, 'seroton', 'bakery', 1);
    assert.deepEqual(landedCommodityFlow(projectLandedFacilities(withBakery, projectionCatalogue), 'grain'), { productionPerSecond: 10, consumptionPerSecond: 10, netPerSecond: 0 });
});
