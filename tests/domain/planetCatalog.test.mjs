import assert from 'node:assert/strict';
import { test } from 'node:test';
import { planetIds } from '../../src/game/domain/planetCatalog.ts';
import { planetDefinitions } from '../../src/game/definitions/planetDefinitions.ts';
import { planetMarketTunings } from '../../src/game/definitions/serotonMarketDefinitions.ts';
import { planetFacilityDefinitionById, planetFacilityDefinitions, planetFacilityModifiers, planetFacilityOutputCommodityIds } from '../../src/game/definitions/planetFacilityDefinitions.ts';
import { initialGameState } from '../../src/game/definitions/initialGameState.ts';
import { planetFacilityIds, planetFacilityMaximumLevel } from '../../src/game/domain/planetFacilityCatalog.ts';
import { serotonCommodityIds } from '../../src/game/domain/serotonMarketCatalog.ts';

test('the runtime planet catalogue mirrors the configured definitions and market tunings', () => {
    assert.deepEqual([...planetIds], planetDefinitions.map(definition => definition.id));
    assert.deepEqual([...planetIds].sort(), Object.keys(planetMarketTunings).sort());
    assert.equal(new Set(planetIds).size, planetIds.length, 'planet ids are unique');
});

test('the facility catalogue mirrors the planet, commodity and specialization configuration', () => {
    assert.deepEqual(planetFacilityDefinitions.map(definition => definition.id), ['dairyFarm', 'grainFarm', 'cheeseFactory', 'bakery', 'foodProcessor']);
    assert.equal(new Set(planetFacilityDefinitions.map(definition => definition.id)).size, planetFacilityDefinitions.length, 'facility ids are unique');
    const labels = planetFacilityDefinitions.map(definition => definition.label);
    assert(labels.every(label => typeof label === 'string' && label.trim().length > 0));
    assert.equal(new Set(labels).size, labels.length, 'facility labels are unique');
    for (const definition of planetFacilityDefinitions) {
        assert.equal(definition.maxLevel, 3, definition.id);
        assert.equal(definition.outputByLevel.length, definition.maxLevel, definition.id);
        assert.equal(definition.upgradePrices.length, definition.maxLevel - 1, definition.id);
        assert(serotonCommodityIds.includes(planetFacilityOutputCommodityIds[definition.id]), definition.id);
        assert.equal(planetFacilityDefinitionById[definition.id], definition, definition.id);
        for (const input of definition.inputsPerOutput) assert(serotonCommodityIds.includes(input.commodityId), input.commodityId);
    }
    for (const [facilityId, byPlanet] of Object.entries(planetFacilityModifiers)) {
        assert(planetFacilityDefinitions.some(definition => definition.id === facilityId), facilityId);
        for (const [planetId, modifier] of Object.entries(byPlanet)) {
            assert([...planetIds].includes(planetId), `${facilityId}@${planetId}`);
            assert(modifier.upgradePriceMultiplier > 0 && modifier.upgradePriceMultiplier < 1, `${facilityId}@${planetId} discount`);
            assert(modifier.outputMultiplier > 1, `${facilityId}@${planetId} output bonus`);
        }
    }
    const specializedPairs = Object.entries(planetFacilityModifiers)
        .flatMap(([facilityId, byPlanet]) => Object.keys(byPlanet).map(planetId => `${facilityId}@${planetId}`))
        .sort();
    assert.deepEqual(specializedPairs, ['cheeseFactory@seroton', 'dairyFarm@maslo-prime', 'grainFarm@lactozis-7c']);
});

test('the runtime facility id catalogue mirrors the configured facility definitions', () => {
    assert.deepEqual([...planetFacilityIds], planetFacilityDefinitions.map(definition => definition.id));
    for (const definition of planetFacilityDefinitions) {
        assert.equal(definition.maxLevel, planetFacilityMaximumLevel, definition.id);
    }
});

test('the facility definitions declare the configured output and input recipes', () => {
    const expectedRecipes = {
        dairyFarm: { outputByLevel: [10, 20, 40], inputsPerOutput: [] },
        grainFarm: { outputByLevel: [10, 20, 40], inputsPerOutput: [] },
        cheeseFactory: { outputByLevel: [5, 10, 20], inputsPerOutput: [{ commodityId: 'milk', quantity: 2 }] },
        bakery: { outputByLevel: [5, 10, 20], inputsPerOutput: [{ commodityId: 'grain', quantity: 2 }] },
        foodProcessor: {
            outputByLevel: [5, 10, 20],
            inputsPerOutput: [{ commodityId: 'cheese', quantity: 2 }, { commodityId: 'bun', quantity: 1 }, { commodityId: 'milk', quantity: 1 }]
        }
    };
    for (const definition of planetFacilityDefinitions) {
        assert.deepEqual(definition.outputByLevel, expectedRecipes[definition.id].outputByLevel, definition.id);
        assert.deepEqual(definition.inputsPerOutput, expectedRecipes[definition.id].inputsPerOutput, definition.id);
    }
});

test('the initial game state opens every planet with the configured facility levels and statuses', () => {
    const expectedLevels = [1, 1, 1, 0, 0];
    const expectedStatuses = ['working', 'working', 'working', 'notBuilt', 'notBuilt'];
    assert(initialGameState.markets.length > 0);
    for (const market of initialGameState.markets) {
        assert.deepEqual(market.facilities.map(facility => facility.facilityId), [...planetFacilityIds], market.planetId);
        assert.deepEqual(market.facilities.map(facility => facility.level), expectedLevels, market.planetId);
        assert.deepEqual(market.facilities.map(facility => facility.status), expectedStatuses, market.planetId);
    }
});
