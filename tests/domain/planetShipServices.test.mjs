import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    advanceShipServiceLevel,
    applyShipBooster,
    applyShipRepair,
    applyShipUpgrade,
    quoteShipBooster,
    quoteShipRepair,
    quoteShipUpgrade,
    shipBoosterServicePlanetId,
    shipServiceDefinitions
} from '../../src/game/application/planetShipServices.ts';
import { GameStateProvider } from '../../src/game/application/gameStateProvider.ts';
import { projectLandedShipyard } from '../../src/game/application/landedShipyard.ts';
import {
    cargoCapacityByLevel,
    engineNormalSpeedPercentByLevel,
    maximumShipHitPoints,
    shipBoosterCost,
    shipRepairCost,
    weaponProjectileCountByLevel
} from '../../src/game/domain/runBalance.ts';
import { initialGameState } from '../../src/game/definitions/initialGameState.ts';

const clone = value => JSON.parse(JSON.stringify(value));

const landedOn = (planetId, credits = initialGameState.credits) => ({
    ...clone(initialGameState),
    credits,
    clock: { ...clone(initialGameState.clock), playerPaused: true, pauseReasons: [] },
    planetLifecycle: { capturedPlanetId: planetId, landedPlanetId: planetId, relandingLockedPlanetId: null }
});

const withHitPoints = (state, currentHitPoints) => ({
    ...state,
    shipStatus: { ...state.shipStatus, currentHitPoints }
});

const levelOf = (state, serviceId) => serviceId === 'cargo'
    ? state.shipStatus.cargoLevel
    : serviceId === 'engine' ? state.shipStatus.engineLevel : state.shipStatus.weaponLevel;

const ladder = [
    ['cargo', 'seroton', [15_000, 30_000, 60_000, 120_000]],
    ['engine', 'lactozis-7c', [20_000, 40_000, 80_000, 160_000]],
    ['weaponary', 'maslo-prime', [20_000, 30_000, 40_000, 50_000, 60_000, 70_000, 80_000, 90_000, 100_000]]
];

const capabilityTables = {
    cargo: cargoCapacityByLevel,
    engine: engineNormalSpeedPercentByLevel,
    weaponary: weaponProjectileCountByLevel
};

test('each ship-service path is sold on exactly one planet with its configured maximum level', () => {
    assert.deepEqual(shipServiceDefinitions.map(definition => definition.id), ['cargo', 'engine', 'weaponary']);
    assert.deepEqual(shipServiceDefinitions.map(definition => definition.servicePlanetId), ['seroton', 'lactozis-7c', 'maslo-prime']);
    assert.equal(new Set(shipServiceDefinitions.map(definition => definition.servicePlanetId)).size, shipServiceDefinitions.length);
    assert.equal(shipBoosterServicePlanetId, 'lactozis-7c');

    for (const [serviceId, planetId, prices] of ladder) {
        const definition = shipServiceDefinitions.find(candidate => candidate.id === serviceId);
        assert.equal(definition.servicePlanetId, planetId, serviceId);
        assert.deepEqual(definition.upgradePrices, prices, serviceId);
        assert.equal(definition.maximumLevel, prices.length + 1, serviceId);
    }
});

test('the catalogue publishes every configured level of every progression path', () => {
    assert.deepEqual(cargoCapacityByLevel, { 1: 40, 2: 50, 3: 65, 4: 85, 5: 110 });
    assert.deepEqual(engineNormalSpeedPercentByLevel, { 1: 100, 2: 110, 3: 120, 4: 135, 5: 150 });
    assert.deepEqual(
        Object.values(weaponProjectileCountByLevel),
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    );

    const levelCounts = { cargo: Object.keys(cargoCapacityByLevel).length, engine: Object.keys(engineNormalSpeedPercentByLevel).length, weaponary: Object.keys(weaponProjectileCountByLevel).length };
    for (const [serviceId, , prices] of ladder) {
        assert.equal(levelCounts[serviceId], prices.length + 1, serviceId);
    }
});

test('repair quotes reject a destroyed or full hull and price one 10% increment otherwise', () => {
    assert.equal(quoteShipRepair(clone(initialGameState)).failure, 'not-landed', 'an unlanded ship has no shipyard');
    assert.equal(quoteShipRepair(landedOn('seroton')).failure, 'full-health');
    assert.equal(quoteShipRepair(landedOn('maslo-prime')).failure, 'full-health', 'repair is offered on every planet');

    const damaged = landedOn('seroton');
    const quote = quoteShipRepair(withHitPoints(damaged, 75));
    assert.equal(quote.failure, null);
    assert.equal(quote.action, 'repair');
    assert.equal(quote.serviceId, null);
    assert.equal(quote.level, 75);
    assert.equal(quote.targetLevel, 85);
    assert.equal(quote.price, 1_000);
    assert.equal(quote.price, shipRepairCost);
    assert.equal(maximumShipHitPoints, 100);

    assert.equal(quoteShipRepair(withHitPoints(damaged, 95)).targetLevel, 100, 'repair caps at maximum HP');
    assert.equal(quoteShipRepair(withHitPoints(damaged, 1)).targetLevel, 11);

    const broke = withHitPoints(landedOn('seroton', shipRepairCost - 1), 50);
    assert.equal(quoteShipRepair(broke).failure, 'insufficient-credits');
    assert.equal(quoteShipRepair(withHitPoints(landedOn('seroton', shipRepairCost), 50)).failure, null);

    const destroyed = withHitPoints(landedOn('seroton'), 0);
    assert.equal(quoteShipRepair(destroyed).failure, 'ship-destroyed');
});

test('repair restores 10% of maximum HP and deducts the fixed price atomically', () => {
    const provider = new GameStateProvider(withHitPoints(landedOn('seroton', 10_000), 75));
    const before = provider.snapshot();
    const repaired = provider.update(state => applyShipRepair(state));
    assert.equal(repaired.shipStatus.currentHitPoints, 85);
    assert.equal(repaired.credits, before.credits - shipRepairCost);
    assert.equal(repaired.shipStatus.cargoLevel, before.shipStatus.cargoLevel);
    assert.equal(repaired.shipStatus.engineLevel, before.shipStatus.engineLevel);
    assert.equal(repaired.shipStatus.weaponLevel, before.shipStatus.weaponLevel);
    assert.deepEqual(repaired.cargo, before.cargo);
    assert.deepEqual(repaired.markets, before.markets);

    const full = withHitPoints(landedOn('seroton', 10_000), maximumShipHitPoints);
    assert.equal(applyShipRepair(full), full, 'a full hull is rejected unchanged');
    const broke = withHitPoints(landedOn('seroton', 0), 75);
    assert.equal(applyShipRepair(broke), broke, 'an unaffordable repair changes nothing');
    const unlanded = withHitPoints(clone(initialGameState), 75);
    assert.equal(applyShipRepair(unlanded), unlanded, 'an unlanded repair changes nothing');
});

test('each upgrade path walks its own price ladder one level at a time', () => {
    for (const [serviceId, planetId, prices] of ladder) {
        let state = landedOn(planetId, 1_000_000);
        let spent = 0;
        for (const [index, price] of prices.entries()) {
            const quote = quoteShipUpgrade(state, serviceId);
            assert.equal(quote.failure, null, `${serviceId} level ${index + 2}`);
            assert.equal(quote.level, index + 1, serviceId);
            assert.equal(quote.targetLevel, index + 2, serviceId);
            assert.equal(quote.price, price, `${serviceId} level ${index + 2}`);

            const next = applyShipUpgrade(state, serviceId);
            spent += price;
            assert.equal(levelOf(next, serviceId), index + 2, serviceId);
            assert.equal(next.credits, 1_000_000 - spent, `${serviceId} after level ${index + 2}`);
            assert.equal(next.shipStatus.currentHitPoints, state.shipStatus.currentHitPoints, serviceId);
            state = next;
        }
        const maximum = prices.length + 1;
        const maxed = quoteShipUpgrade(state, serviceId);
        assert.equal(maxed.failure, 'maximum-level', serviceId);
        assert.equal(maxed.price, 0, serviceId);
        assert.equal(applyShipUpgrade(state, serviceId), state, `${serviceId} cannot pass its maximum level`);
        assert.equal(levelOf(state, serviceId), maximum, serviceId);
    }
});

test('upgrade quotes reject unknown, unlanded, foreign-planet and unaffordable requests', () => {
    assert.equal(quoteShipUpgrade(landedOn('seroton'), 'unknownService').failure, 'unknown-service');
    const unknown = landedOn('seroton');
    assert.equal(applyShipUpgrade(unknown, 'unknownService'), unknown);

    for (const [serviceId, planetId, prices] of ladder) {
        assert.equal(quoteShipUpgrade(clone(initialGameState), serviceId).failure, 'not-landed', serviceId);

        for (const foreignPlanetId of ['seroton', 'lactozis-7c', 'maslo-prime']) {
            if (foreignPlanetId === planetId) continue;
            const quote = quoteShipUpgrade(landedOn(foreignPlanetId), serviceId);
            assert.equal(quote.failure, 'wrong-planet', `${serviceId}@${foreignPlanetId}`);
            assert.equal(quote.price, prices[0], `${serviceId} still quotes its next price off-world`);
            const foreign = landedOn(foreignPlanetId);
            assert.equal(applyShipUpgrade(foreign, serviceId), foreign, `${serviceId}@${foreignPlanetId}`);
        }

        const affordable = quoteShipUpgrade(landedOn(planetId, prices[0]), serviceId);
        assert.equal(affordable.failure, null, `${serviceId} exactly affordable`);
        const unaffordable = quoteShipUpgrade(landedOn(planetId, prices[0] - 1), serviceId);
        assert.equal(unaffordable.failure, 'insufficient-credits', serviceId);
        assert.equal(unaffordable.price, prices[0], serviceId);
        const broke = landedOn(planetId, prices[0] - 1);
        assert.equal(applyShipUpgrade(broke, serviceId), broke, serviceId);
    }
});

test('an upgrade touches only its own path, the credits and the landed planet records', () => {
    const provider = new GameStateProvider(landedOn('maslo-prime'));
    const before = provider.snapshot();
    const after = provider.update(state => applyShipUpgrade(state, 'weaponary'));
    assert.equal(after.shipStatus.weaponLevel, 2);
    assert.equal(after.credits, before.credits - 20_000);
    assert.equal(after.shipStatus.cargoLevel, before.shipStatus.cargoLevel);
    assert.equal(after.shipStatus.engineLevel, before.shipStatus.engineLevel);
    assert.equal(after.shipStatus.currentHitPoints, before.shipStatus.currentHitPoints);
    assert.equal(after.shipStatus.boosterUnlocked, before.shipStatus.boosterUnlocked);
    assert.deepEqual(after.cargo, before.cargo);
    assert.deepEqual(after.projectiles, before.projectiles);
    assert.deepEqual(after.markets, before.markets);
    assert.deepEqual(after.planets, before.planets);
});

test('the booster is a one-time Lactozis-7C purchase independent of the engine level', () => {
    assert.equal(quoteShipBooster(clone(initialGameState)).failure, 'not-landed');
    assert.equal(quoteShipBooster(landedOn('seroton')).failure, 'wrong-planet');
    assert.equal(quoteShipBooster(landedOn('maslo-prime')).failure, 'wrong-planet');

    const unaffordable = quoteShipBooster(landedOn('lactozis-7c', shipBoosterCost - 1));
    assert.equal(unaffordable.failure, 'insufficient-credits');
    assert.equal(unaffordable.price, shipBoosterCost);
    const blocked = landedOn('lactozis-7c', shipBoosterCost - 1);
    assert.equal(applyShipBooster(blocked), blocked);

    const provider = new GameStateProvider(landedOn('lactozis-7c', shipBoosterCost));
    const before = provider.snapshot();
    const quoted = quoteShipBooster(before);
    assert.equal(quoted.failure, null);
    assert.equal(quoted.level, 0);
    assert.equal(quoted.targetLevel, 1);
    assert.equal(quoted.price, 75_000);
    const unlocked = provider.update(state => applyShipBooster(state));
    assert.equal(unlocked.shipStatus.boosterUnlocked, true);
    assert.equal(unlocked.shipStatus.engineLevel, 1, 'the booster does not require an engine upgrade');
    assert.equal(unlocked.credits, before.credits - shipBoosterCost);

    const again = quoteShipBooster(unlocked);
    assert.equal(again.failure, 'already-owned');
    assert.equal(applyShipBooster(unlocked), unlocked);
});

test('rejected ship-service commands return the identical aggregate through the provider', () => {
    const provider = new GameStateProvider(landedOn('seroton'));
    const before = provider.snapshot();
    const attempted = provider.update(state => applyShipUpgrade(state, 'engine'));
    assert.deepEqual(attempted, before, 'a foreign-planet upgrade publishes the untouched aggregate');
    assert.equal(attempted.shipStatus.engineLevel, 1);
    assert.equal(attempted.credits, before.credits);
});

test('the debug level command raises one path per call without charging or requiring a landing', () => {
    const unlanded = clone(initialGameState);
    const cargo = advanceShipServiceLevel(unlanded, 'cargo');
    assert.equal(cargo.shipStatus.cargoLevel, 2, 'the debug command ignores the landing and planet gates');
    assert.equal(cargo.credits, unlanded.credits, 'the debug command never charges credits');
    assert.equal(cargo.shipStatus.engineLevel, 1);
    assert.equal(cargo.shipStatus.weaponLevel, 1);
    assert.deepEqual(unlanded.shipStatus, clone(initialGameState).shipStatus, 'the reducer never mutates its input');
    assert.deepEqual(cargo.cargo, unlanded.cargo);

    for (const [serviceId, maximumLevel] of [['cargo', 5], ['engine', 5], ['weaponary', 10]]) {
        let state = clone(initialGameState);
        for (let level = 1; level < maximumLevel; level++) state = advanceShipServiceLevel(state, serviceId);
        assert.equal(levelOf(state, serviceId), maximumLevel, serviceId);
        assert.equal(advanceShipServiceLevel(state, serviceId), state, `${serviceId} cannot pass its catalogue maximum`);
    }

    const finished = { ...clone(initialGameState), terminalResult: { runId: initialGameState.runId, outcome: 'death', activeElapsedMs: 0, finalCredits: 0 } };
    assert.equal(advanceShipServiceLevel(finished, 'engine'), finished, 'a finished run cannot be upgraded');
    const unsupported = clone(initialGameState);
    assert.equal(advanceShipServiceLevel(unsupported, 'unknownService'), unsupported, 'an unknown path is ignored unchanged');

    const provider = new GameStateProvider(clone(initialGameState));
    const published = provider.update(state => advanceShipServiceLevel(state, 'weaponary'));
    assert.equal(published.shipStatus.weaponLevel, 2, 'the debug level survives the provider codec boundary');
    const damaged = { ...landedOn('seroton'), shipStatus: { ...clone(initialGameState).shipStatus, currentHitPoints: 75 } };
    assert.equal(projectLandedShipyard(advanceShipServiceLevel(damaged, 'cargo')).services.find(row => row.serviceId === 'cargo').level, 2,
        'a debug upgrade shows up in the landed shipyard view immediately');
});

test('the shipyard projection reports landed context, repair status and one local path per planet', () => {
    const unlanded = projectLandedShipyard(clone(initialGameState));
    assert.equal(unlanded.visible, false);
    assert.equal(unlanded.eligible, false);
    assert.equal(unlanded.planetId, null);
    assert.equal(unlanded.repair.failure, 'not-landed');
    assert.deepEqual(unlanded.services.map(row => row.available), [false, false, false]);
    assert.equal(unlanded.booster.available, false);
    assert.equal(unlanded.booster.failure, 'not-landed');

    for (const [serviceId, planetId, prices] of ladder) {
        const price = prices[0];
        const snapshot = projectLandedShipyard(withHitPoints(landedOn(planetId), 75));
        assert(Object.isFrozen(snapshot));
        assert(Object.isFrozen(snapshot.services));
        assert.equal(snapshot.visible, true);
        assert.equal(snapshot.planetId, planetId);
        assert.equal(snapshot.planetName, initialGameState.planets.find(candidate => candidate.id === planetId).name);
        assert.equal(snapshot.credits, initialGameState.credits);
        assert.equal(snapshot.cargoUsed, 0);
        assert.equal(snapshot.cargoCapacity, 40);
        assert.deepEqual(snapshot.clock, { remainingSeconds: 1800, runState: 'PAUSED' });

        assert.equal(snapshot.repair.currentHitPoints, 75);
        assert.equal(snapshot.repair.maximumHitPoints, maximumShipHitPoints);
        assert.equal(snapshot.repair.incrementHitPoints, 10);
        assert.equal(snapshot.repair.price, shipRepairCost);
        assert.equal(snapshot.repair.failure, null, 'repair is available on every planet');

        assert.deepEqual(snapshot.services.map(row => row.serviceId), ['cargo', 'engine', 'weaponary']);
        assert.deepEqual(snapshot.services.map(row => row.label), ['Cargo Capacity', 'Engine System', 'Weapon System']);
        assert.deepEqual(snapshot.services.map(row => row.available), shipServiceDefinitions.map(definition => definition.servicePlanetId === planetId));
        for (const row of snapshot.services) {
            const definition = shipServiceDefinitions.find(candidate => candidate.id === row.serviceId);
            assert.equal(row.level, 1);
            assert.equal(row.maximumLevel, definition.maximumLevel);
            assert.equal(row.maximum, false);
            assert.equal(row.currentCapability, capabilityTables[row.serviceId][1], row.serviceId);
            assert.equal(row.maximumCapability, capabilityTables[row.serviceId][definition.maximumLevel], row.serviceId);
            assert.equal(row.servicePlanetId, definition.servicePlanetId);
            assert.equal(row.servicePlanetName, initialGameState.planets.find(candidate => candidate.id === definition.servicePlanetId).name);
            assert.equal(row.price, definition.upgradePrices[0]);
            assert.equal(row.failure, row.available ? null : 'wrong-planet');
            assert.equal(row.affordable, row.available);
        }

        assert.equal(snapshot.booster.owned, false);
        assert.equal(snapshot.booster.price, shipBoosterCost);
        assert.equal(snapshot.booster.servicePlanetId, 'lactozis-7c');
        assert.equal(snapshot.booster.servicePlanetName, 'Lactozis-7C');
        assert.equal(snapshot.booster.available, planetId === 'lactozis-7c');
        assert.equal(snapshot.booster.affordable, planetId === 'lactozis-7c');
        assert.equal(snapshot.services.find(row => row.serviceId === serviceId).price, price);
    }

    const broke = projectLandedShipyard(withHitPoints(landedOn('seroton', 900), 75));
    assert.equal(broke.repair.failure, 'insufficient-credits');
    assert.equal(broke.services.find(row => row.serviceId === 'cargo').failure, 'insufficient-credits');
    assert.equal(broke.services.find(row => row.serviceId === 'cargo').affordable, false);
    assert.equal(broke.services.find(row => row.serviceId === 'cargo').available, true);
    assert.equal(broke.booster.affordable, false);

    const fullyUpgraded = {
        ...landedOn('maslo-prime'),
        shipStatus: { currentHitPoints: 100, cargoLevel: 5, engineLevel: 5, weaponLevel: 10, boosterUnlocked: true }
    };
    const maxed = projectLandedShipyard(fullyUpgraded);
    assert.deepEqual(maxed.services.map(row => row.maximum), [true, true, true]);
    assert.deepEqual(maxed.services.map(row => row.available), [false, false, false]);
    assert.deepEqual(maxed.services.map(row => row.price), [0, 0, 0]);
    assert.deepEqual(maxed.services.map(row => row.failure), ['maximum-level', 'maximum-level', 'maximum-level']);
    assert.equal(maxed.repair.failure, 'full-health');
    assert.equal(maxed.booster.owned, true);
    assert.equal(maxed.booster.available, false);
    assert.equal(maxed.booster.failure, 'already-owned');
});

test('the shipyard projection quotes each system capability for every level', () => {
    for (const [serviceId, planetId] of [['cargo', 'seroton'], ['engine', 'lactozis-7c'], ['weaponary', 'maslo-prime']]) {
        let state = { ...landedOn(planetId), credits: 1_000_000 };
        const maximumLevel = shipServiceDefinitions.find(definition => definition.id === serviceId).maximumLevel;
        for (let level = 1; level <= maximumLevel; level++) {
            const row = projectLandedShipyard(state).services.find(candidate => candidate.serviceId === serviceId);
            assert.equal(row.level, level, serviceId);
            assert.equal(row.currentCapability, capabilityTables[serviceId][level], `${serviceId} level ${level}`);
            assert.equal(row.maximumCapability, capabilityTables[serviceId][maximumLevel], serviceId);
            state = advanceShipServiceLevel(state, serviceId);
        }
    }
    const cargo = projectLandedShipyard({ ...landedOn('seroton'), shipStatus: { ...clone(initialGameState).shipStatus, cargoLevel: 3 } }).services.find(row => row.serviceId === 'cargo');
    assert.equal(cargo.currentCapability, 65, 'a mid-level cargo hold reports its own capacity');
    assert.equal(cargo.maximumCapability, 110);
});
