import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decodeGameState, encodeGameState } from '../../src/game/application/gameStateCodec.ts';
import { GameStateProvider } from '../../src/game/application/gameStateProvider.ts';
import { initialGameState } from '../../src/game/definitions/initialGameState.ts';
import { advanceGameClock, pauseGameClock, resumeGameClock } from '../../src/game/mechanics/clock/gameClock.ts';
import { advanceGameSimulation } from '../../src/game/mechanics/gameSimulation.ts';
import { projectRunStatus } from '../../src/game/application/runStatus.ts';
import { applyLandedTrade, quoteLandedTrade } from '../../src/game/application/serotonMarket.ts';
import { createLandingStatusPort } from '../../src/ui/adapters/landingStatusAdapter.ts';
import { createCargoTransferPort, cargoFullWarning, cargoFullWarningDurationMs } from '../../src/ui/adapters/cargoTransferAdapter.ts';

const clone = value => JSON.parse(JSON.stringify(value));

test('provider returns detached immutable snapshots and publishes valid replacements', () => {
    const provider = new GameStateProvider(initialGameState);
    const first = provider.snapshot();
    assert(Object.isFrozen(first));
    assert(Object.isFrozen(first.ship));
    assert(Object.isFrozen(first.planets));
    assert(Object.isFrozen(first.cargo));
    assert(Object.isFrozen(first.markets));
    assert(Object.isFrozen(first.markets[0].facilities));
    assert(Object.isFrozen(first.shipStatus));
    assert.throws(() => { first.ship.position.x = 99; }, TypeError);
    assert.throws(() => { first.markets[0].facilities[0].level = 2; }, TypeError);

    const notifications = [];
    const unsubscribe = provider.subscribe(state => notifications.push(state.clock.activeElapsedMs));
    const updated = provider.update(state => ({ ...state, clock: advanceGameClock(state.clock, 125) }));
    assert.equal(updated.clock.activeElapsedMs, 125);
    assert.equal(first.clock.activeElapsedMs, 0);
    assert.deepEqual(notifications, [125]);
    unsubscribe();
    provider.reset();
    assert.deepEqual(notifications, [125]);
    assert.equal(provider.snapshot().clock.activeElapsedMs, 0);
});

test('a new run starts with the complete S-01 authoritative state', () => {
    const state = decodeGameState(initialGameState);
    const openingFacilities = [
        { facilityId: 'dairyFarm', level: 1, status: 'working' },
        { facilityId: 'grainFarm', level: 1, status: 'working' },
        { facilityId: 'cheeseFactory', level: 1, status: 'working' },
        { facilityId: 'bakery', level: 0, status: 'notBuilt' },
        { facilityId: 'foodProcessor', level: 0, status: 'notBuilt' }
    ];
    assert.equal(state.schemaVersion, 17);
    assert.equal(state.runId, '00000000-0000-4000-8000-000000000001');
    assert.deepEqual(state.cargoSchedule, []);
    assert.equal(state.moolarisDamageArmed, true);
    assert.equal(state.terminalResult, null);
    assert.equal(state.credits, 100_000);
    assert.deepEqual(state.cargo, []);
    assert.deepEqual(state.markets, [
        {
            planetId: 'seroton',
            commodityStocks: [
                { commodityId: 'milk', stock: 4 },
                { commodityId: 'grain', stock: 100 },
                { commodityId: 'cheese', stock: 60 },
                { commodityId: 'bun', stock: 50 },
                { commodityId: 'spaceRation', stock: 20 }
            ],
            facilities: clone(openingFacilities)
        },
        {
            planetId: 'lactozis-7c',
            commodityStocks: [
                { commodityId: 'milk', stock: 100 },
                { commodityId: 'grain', stock: 120 },
                { commodityId: 'cheese', stock: 50 },
                { commodityId: 'bun', stock: 2 },
                { commodityId: 'spaceRation', stock: 20 }
            ],
            facilities: clone(openingFacilities)
        },
        {
            planetId: 'maslo-prime',
            commodityStocks: [
                { commodityId: 'milk', stock: 120 },
                { commodityId: 'grain', stock: 100 },
                { commodityId: 'cheese', stock: 2 },
                { commodityId: 'bun', stock: 50 },
                { commodityId: 'spaceRation', stock: 20 }
            ],
            facilities: clone(openingFacilities)
        }
    ]);
    assert(Object.isFrozen(state.markets), 'every market collection is immutable');
    assert(Object.isFrozen(state.markets[0].commodityStocks), 'every market stock list is immutable');
    assert(Object.isFrozen(state.markets[0].facilities), 'every planet facility list is immutable');
    assert(Object.isFrozen(state.markets[0].facilities[0]), 'every facility record is immutable');
    assert.deepEqual(state.shipStatus, {
        currentHitPoints: 100,
        cargoLevel: 1,
        engineLevel: 1,
        weaponLevel: 1,
        boosterUnlocked: false
    });
    assert.equal(state.asteroids.length, 384);
    assert(state.asteroids.every(asteroid => asteroid.size === 'big' && asteroid.orbit));
});

test('codec round trips exact JSON-safe state and restore failures are atomic', () => {
    const provider = new GameStateProvider(initialGameState);
    const advanced = provider.update(state => advanceGameSimulation(state, {
        target: { x: 5000, y: 600 }, boostRequested: false, firing: true
    }, 250));
    const encoded = encodeGameState(advanced);
    assert.deepEqual(decodeGameState(encoded), advanced);

    const invalidCases = [
        { ...clone(advanced), schemaVersion: 6 },
        { ...clone(advanced), credits: -1 },
        { ...clone(advanced), credits: 0.5 },
        { ...clone(advanced), cargo: [{ commodityId: 'ore', quantity: 1, totalCost: 0 }, { commodityId: 'ore', quantity: 2, totalCost: 0 }] },
        { ...clone(advanced), cargo: [{ commodityId: '', quantity: 1, totalCost: 0 }] },
        { ...clone(advanced), cargo: [{ commodityId: 'ore', quantity: -1, totalCost: 0 }] },
        { ...clone(advanced), cargo: [{ commodityId: 'ore', quantity: 1, totalCost: -1 }] },
        { ...clone(advanced), schemaVersion: 15 },
        { ...clone(advanced), schemaVersion: 16 },
        { ...clone(advanced), markets: [] },
        { ...clone(advanced), markets: clone(advanced.markets).slice(0, 2) },
        { ...clone(advanced), markets: [...clone(advanced.markets), clone(advanced.markets[0])] },
        { ...clone(advanced), markets: [{ ...clone(advanced.markets[0]), planetId: 'unknown' }, ...clone(advanced.markets.slice(1))] },
        { ...clone(advanced), markets: [...clone(advanced.markets.slice(1)), { ...clone(advanced.markets[0]), commodityStocks: [{ commodityId: 'milk', stock: 1 }, { commodityId: 'milk', stock: 2 }, { commodityId: 'cheese', stock: 3 }, { commodityId: 'bun', stock: 4 }, { commodityId: 'spaceRation', stock: 5 }] }] },
        { ...clone(advanced), markets: [...clone(advanced.markets.slice(1)), { ...clone(advanced.markets[0]), commodityStocks: [{ commodityId: 'milk', stock: 1 }, { commodityId: 'grain', stock: 2 }] }] },
        { ...clone(advanced), markets: [...clone(advanced.markets.slice(1)), { ...clone(advanced.markets[0]), commodityStocks: [{ commodityId: 'milk', stock: -1 }, ...clone(advanced.markets[0].commodityStocks.slice(1))] }] },
        { ...clone(advanced), markets: [...clone(advanced.markets.slice(1)), { ...clone(advanced.markets[0]), commodityStocks: [{ commodityId: 'milk', stock: 1.5 }, ...clone(advanced.markets[0].commodityStocks.slice(1))] }] },
        { ...clone(advanced), markets: [...clone(advanced.markets.slice(1)), { ...clone(advanced.markets[0]), facilities: clone(advanced.markets[0].facilities).slice(0, 4) }] },
        { ...clone(advanced), markets: [...clone(advanced.markets.slice(1)), { ...clone(advanced.markets[0]), facilities: [...clone(advanced.markets[0].facilities), clone(advanced.markets[0].facilities[0])] }] },
        { ...clone(advanced), markets: [...clone(advanced.markets.slice(1)), { ...clone(advanced.markets[0]), facilities: [{ ...clone(advanced.markets[0].facilities[0]), facilityId: 'unknown' }, ...clone(advanced.markets[0].facilities.slice(1))] }] },
        { ...clone(advanced), markets: [...clone(advanced.markets.slice(1)), { ...clone(advanced.markets[0]), facilities: [{ ...clone(advanced.markets[0].facilities[0]), level: 4 }, ...clone(advanced.markets[0].facilities.slice(1))] }] },
        { ...clone(advanced), markets: [...clone(advanced.markets.slice(1)), { ...clone(advanced.markets[0]), facilities: [{ ...clone(advanced.markets[0].facilities[0]), level: 1.5 }, ...clone(advanced.markets[0].facilities.slice(1))] }] },
        { ...clone(advanced), markets: [...clone(advanced.markets.slice(1)), { ...clone(advanced.markets[0]), facilities: [{ ...clone(advanced.markets[0].facilities[0]), status: 'broken' }, ...clone(advanced.markets[0].facilities.slice(1))] }] },
        { ...clone(advanced), markets: [...clone(advanced.markets.slice(1)), { ...clone(advanced.markets[0]), facilities: [{ ...clone(advanced.markets[0].facilities[0]), status: 'notBuilt' }, ...clone(advanced.markets[0].facilities.slice(1))] }] },
        { ...clone(advanced), markets: [...clone(advanced.markets.slice(1)), { ...clone(advanced.markets[0]), facilities: [...clone(advanced.markets[0].facilities.slice(0, 3)), { ...clone(advanced.markets[0].facilities[3]), status: 'working' }, ...clone(advanced.markets[0].facilities.slice(4))] }] },
        { ...clone(advanced), markets: [...clone(advanced.markets.slice(1)), { ...clone(advanced.markets[0]), facilities: {} }] },
        { ...clone(advanced), shipStatus: { ...clone(advanced.shipStatus), currentHitPoints: 101 } },
        { ...clone(advanced), shipStatus: { ...clone(advanced.shipStatus), cargoLevel: 0 } },
        {
            ...clone(advanced),
            ship: { ...clone(advanced.ship), boosting: true },
            shipStatus: { ...clone(advanced.shipStatus), boosterUnlocked: false }
        },
        { ...clone(advanced), clock: { ...clone(advanced.clock), pauseReasons: ['unknown'] } },
        { ...clone(advanced), clock: { ...clone(advanced.clock), pauseReasons: ['landed', 'landed'] } },
        { ...clone(advanced), ship: { ...clone(advanced.ship), position: { ...clone(advanced.ship.position), x: Number.NaN } } },
        { ...clone(advanced), ship: { ...clone(advanced.ship), asteroidImpactAtActiveMs: -1 } },
        { ...clone(advanced), planets: [...clone(advanced.planets), clone(advanced.planets[0])] },
        { ...clone(advanced), planets: [{ ...clone(advanced.planets[0]), id: 'unknown' }, ...clone(advanced.planets.slice(1))] },
        { ...clone(advanced), planets: clone(advanced.planets).slice(0, 2) },
        { ...clone(advanced), projectiles: [...clone(advanced.projectiles), ...clone(advanced.projectiles)] },
        { ...clone(advanced), projectiles: {} }
    ];
    for (const invalid of invalidCases) {
        const before = provider.snapshot();
        assert.throws(() => provider.restore(invalid));
        assert.deepEqual(provider.snapshot(), before);
    }
    assert.throws(() => provider.restore('{broken json'));
    assert.deepEqual(provider.snapshot(), advanced);
});

test('v17 facility state rejects the previous schema and round trips detached records', () => {
    const decoded = decodeGameState(initialGameState);
    assert.equal(decoded.schemaVersion, 17);
    assert.throws(() => decodeGameState({ ...clone(initialGameState), schemaVersion: 16 }));
    assert.deepEqual(decodeGameState(encodeGameState(decoded)).markets, decoded.markets);
    for (const market of decoded.markets) {
        assert.deepEqual(market.facilities.map(facility => facility.facilityId), ['dairyFarm', 'grainFarm', 'cheeseFactory', 'bakery', 'foodProcessor']);
    }
    const source = clone(initialGameState);
    const detached = decodeGameState(source);
    source.markets[0].facilities[0].level = 3;
    source.markets[0].facilities[0].status = 'notBuilt';
    assert.equal(detached.markets[0].facilities[0].level, 1);
    assert.equal(detached.markets[0].facilities[0].status, 'working');
});

test('codec rejects retired schemas and permits active boost only for an unlocked v3 booster', () => {
    const current = decodeGameState(advanceGameSimulation(initialGameState, {
        target: null, boostRequested: false, firing: true
    }, 16));
    const legacy = {
        schemaVersion: 1,
        clock: clone(current.clock),
        ship: {
            x: current.ship.position.x,
            y: current.ship.position.y,
            velocityX: current.ship.velocity.x,
            velocityY: current.ship.velocity.y,
            rotation: current.ship.rotation,
            enginesOn: current.ship.enginesOn,
            boosting: current.ship.boosting,
            boostAcceleration: current.ship.boostAcceleration,
            coastDeceleration: current.ship.coastDeceleration
        },
        planets: current.planets.map(planet => ({
            id: planet.id, name: planet.name, ...planet.position, radius: planet.radius
        })),
        weapon: clone(current.weapon),
        projectiles: current.projectiles.map(projectile => ({
            id: projectile.id,
            ...projectile.position,
            velocityX: projectile.velocity.x,
            velocityY: projectile.velocity.y,
            bornAtActiveMs: projectile.bornAtActiveMs
        }))
    };
    assert.throws(() => decodeGameState(legacy));

    const v2 = clone(current);
    v2.schemaVersion = 2;
    delete v2.credits;
    delete v2.cargo;
    delete v2.shipStatus;
    v2.ship.boosting = true;
    assert.throws(() => decodeGameState(v2));

    const activeBoost = clone(current);
    activeBoost.ship.boosting = true;
    activeBoost.shipStatus.boosterUnlocked = true;
    assert.equal(decodeGameState(activeBoost).ship.boosting, true);
});

test('clock uses unique overlapping pause reasons and advances only active time', () => {
    let clock = initialGameState.clock;
    clock = pauseGameClock(clock, 'landed');
    clock = pauseGameClock(clock, 'background');
    assert.deepEqual(clock.pauseReasons, ['background', 'landed']);
    assert.equal(pauseGameClock(clock, 'landed'), clock, 'pause is idempotent');
    assert.equal(advanceGameClock(clock, 60_000).activeElapsedMs, 0);
    clock = resumeGameClock(clock, 'background');
    assert.equal(advanceGameClock(clock, 60_000).activeElapsedMs, 0, 'one remaining reason keeps time paused');
    clock = resumeGameClock(clock, 'landed');
    assert.deepEqual(clock.pauseReasons, []);
    assert.equal(resumeGameClock(clock, 'landed'), clock, 'resume is idempotent');
    clock = advanceGameClock(clock, 65_432);
    assert.equal(clock.activeElapsedMs, 65_432, 'long active frames retain their full clock delta');
    assert.throws(() => advanceGameClock(clock, -1));
});

test('serialization restores simulation continuity without persisting held input', () => {
    const options = { obstacles: [] };
    const provider = new GameStateProvider(initialGameState);
    const active = provider.update(state => advanceGameSimulation({
        ...state,
        shipStatus: { ...state.shipStatus, boosterUnlocked: true }
    }, {
        target: { x: 8000, y: 600 }, boostRequested: true, firing: true
    }, 100, options));
    assert.equal(active.ship.boosting, true);
    assert.equal(active.projectiles.length, 0, 'boost suppresses firing');

    const restored = new GameStateProvider(initialGameState);
    restored.restore(encodeGameState(active));
    const nextInput = { target: null, boostRequested: false, firing: false };
    const expected = provider.update(state => advanceGameSimulation(state, nextInput, 250, options));
    const actual = restored.update(state => advanceGameSimulation(state, nextInput, 250, options));
    assert.deepEqual(actual, expected);
    assert.equal(actual.ship.boosting, false);
    assert.equal(actual.projectiles.length, 0);
});

test('restoring a paused snapshot never counts time spent outside the game', () => {
    const paused = { ...clone(initialGameState), clock: pauseGameClock(initialGameState.clock, 'background') };
    const provider = new GameStateProvider(initialGameState);
    provider.restore(encodeGameState(paused));
    const unchanged = provider.update(state => advanceGameSimulation(state, {
        target: null, boostRequested: false, firing: false
    }, 600_000));
    assert.equal(unchanged.clock.activeElapsedMs, 0);
    assert.deepEqual(unchanged.planets, paused.planets);
});

test('v17 codec round trips independent ship, orbital, and loose commodity holders and rejects v15', () => {
    const salvage = {
        ...clone(initialGameState),
        cargo: [{ commodityId: 'milk', quantity: 2, totalCost: 10 }],
        orbitalCargo: [{ id: 'cargo-1', position: { x: 20, y: 30 }, orbit: { angleRadians: 0.5, radius: 100, rotationRadians: 0 }, hitPoints: 2, manifest: [{ commodityId: 'grain', quantity: 3, totalCost: 21 }] }],
        looseItems: [{ id: 'item-1', position: { x: 40, y: 50 }, motion: { ejectionVelocity: { x: 4, y: 5 }, sunVelocity: { x: -1, y: -2 }, createdAtActiveMs: 12 }, container: { commodityId: 'cheese', quantity: 1, totalCost: 7 } }]
    };
    const decoded = decodeGameState(salvage);
    assert.deepEqual(decodeGameState(encodeGameState(decoded)), decoded);
    assert(Object.isFrozen(decoded.orbitalCargo[0].manifest));
    assert(Object.isFrozen(decoded.looseItems[0].motion));
    assert.throws(() => decodeGameState({ ...salvage, schemaVersion: 15 }));
    assert.throws(() => decodeGameState({ ...salvage, looseItems: [{ ...salvage.looseItems[0], container: { ...salvage.looseItems[0].container, quantity: 2 } }] }));
});

test('codec validates run randomness and terminal death facts as one immutable snapshot', () => {
    const terminal = {
        ...clone(initialGameState),
        randomState: 4_294_967_295,
        clock: { ...clone(initialGameState.clock), activeElapsedMs: 123 },
        credits: 321,
        shipStatus: { ...clone(initialGameState.shipStatus), currentHitPoints: 0 },
        terminalResult: {
            runId: initialGameState.runId,
            outcome: 'death',
            activeElapsedMs: 123,
            finalCredits: 321
        }
    };
    const decoded = decodeGameState(terminal);
    assert.deepEqual(decodeGameState(encodeGameState(decoded)), decoded);
    assert(Object.isFrozen(decoded.terminalResult));
    for (const invalid of [
        { ...clone(terminal), runId: 'not-a-uuid' },
        { ...clone(terminal), randomState: -1 },
        { ...clone(terminal), randomState: 4_294_967_296 },
        { ...clone(terminal), terminalResult: null },
        { ...clone(terminal), terminalResult: { ...clone(terminal.terminalResult), runId: '00000000-0000-4000-8000-000000000002' } },
        { ...clone(terminal), terminalResult: { ...clone(terminal.terminalResult), outcome: 'timeout' } },
        { ...clone(terminal), terminalResult: { ...clone(terminal.terminalResult), activeElapsedMs: 124 } },
        { ...clone(terminal), terminalResult: { ...clone(terminal.terminalResult), finalCredits: 322 } }
    ]) assert.throws(() => decodeGameState(invalid));
});

test('terminal results preserve an integer millisecond fact when the active clock is fractional', () => {
    const terminal = {
        ...clone(initialGameState),
        clock: { ...clone(initialGameState.clock), activeElapsedMs: 123.75 },
        shipStatus: { ...clone(initialGameState.shipStatus), currentHitPoints: 0 },
        terminalResult: {
            runId: initialGameState.runId,
            outcome: 'death',
            activeElapsedMs: 123,
            finalCredits: initialGameState.credits
        }
    };
    const decoded = decodeGameState(terminal);
    assert.equal(decoded.clock.activeElapsedMs, 123.75);
    assert.equal(decoded.terminalResult.activeElapsedMs, 123);
    assert.deepEqual(decodeGameState(encodeGameState(decoded)), decoded);
    assert.throws(() => decodeGameState({
        ...terminal,
        terminalResult: { ...terminal.terminalResult, activeElapsedMs: 123.75 }
    }));
});

test('codec accepts and round trips drifting asteroids without an orbit', () => {
    const drifting = {
        ...clone(initialGameState),
        asteroids: [{
            ...clone(initialGameState.asteroids[0]),
            id: 'asteroid-fragment-1',
            size: 'small',
            hitPoints: 1,
            position: { x: 3_200, y: -1_600 },
            velocity: { x: 180, y: -90 },
            orbit: null,
            outsideSafeAreaSinceActiveMs: 4_000
        }]
    };
    const provider = new GameStateProvider(initialGameState);
    provider.restore(drifting);
    const restored = provider.snapshot();
    assert.equal(restored.asteroids[0].orbit, null);
    assert.deepEqual(decodeGameState(encodeGameState(restored)), restored);
});

test('provider commits a valid landed trade as one immutable replacement', () => {
    const provider = new GameStateProvider(initialGameState);
    const landed = provider.update(state => ({
        ...state,
        clock: { ...state.clock, pauseReasons: ['landed'] },
        planetLifecycle: { capturedPlanetId: 'seroton', landedPlanetId: 'seroton', relandingLockedPlanetId: null }
    }));
    const traded = provider.update(state => applyLandedTrade(state, 'grain', 2));
    assert.equal(traded.credits, landed.credits - 302);
    assert.deepEqual(traded.cargo, [{ commodityId: 'grain', quantity: 2, totalCost: 302 }]);
    assert.equal(traded.markets.find(market => market.planetId === 'seroton').commodityStocks.find(stock => stock.commodityId === 'grain').stock, 98);
    assert.equal(landed.markets.find(market => market.planetId === 'seroton').commodityStocks.find(stock => stock.commodityId === 'grain').stock, 100);
});

test('a landed trade routes to the landed planet and leaves every other market unchanged', () => {
    const stockOf = (state, planetId, commodityId) => state.markets
        .find(market => market.planetId === planetId).commodityStocks
        .find(stock => stock.commodityId === commodityId).stock;
    for (const planet of initialGameState.planets) {
        const landed = {
            ...initialGameState,
            clock: { ...initialGameState.clock, pauseReasons: ['landed'] },
            planetLifecycle: { capturedPlanetId: planet.id, landedPlanetId: planet.id, relandingLockedPlanetId: null }
        };
        const quote = quoteLandedTrade(landed, 'milk', 1);
        assert.equal(quote.failure, null, planet.name);
        const traded = applyLandedTrade(landed, 'milk', 1);
        assert.equal(traded.credits, landed.credits - quote.total, planet.name);
        assert.equal(stockOf(traded, planet.id, 'milk'), stockOf(landed, planet.id, 'milk') - 1, planet.name);
        for (const other of initialGameState.planets) {
            if (other.id === planet.id) continue;
            assert.equal(stockOf(traded, other.id, 'milk'), stockOf(landed, other.id, 'milk'), `${other.id} must not change when landing on ${planet.name}`);
        }
    }
});

test('landed market port rejects unlanded trade commands and rebuilds its visit-local price ladder after a trade', () => {
    const gameFor = provider => ({ registry: { get: key => key === 'telemetry' ? { emit: () => {} } : provider }, events: { emit: () => {} } });
    const unlandedProvider = new GameStateProvider(initialGameState);
    const unlandedPort = createLandingStatusPort(gameFor(unlandedProvider));
    unlandedPort.selectCommodity('milk');
    unlandedPort.setTradeQuantity(1);
    unlandedPort.confirmTrade();
    assert.equal(unlandedPort.getSnapshot().eligible, false);
    assert.deepEqual(unlandedProvider.snapshot().cargo, []);
    assert.equal(unlandedProvider.snapshot().credits, initialGameState.credits);
    unlandedPort.destroy();

    const landedProvider = new GameStateProvider({
        ...initialGameState,
        clock: { ...initialGameState.clock, pauseReasons: ['landed'] },
        markets: initialGameState.markets.map(market => market.planetId === 'seroton'
            ? {
                ...market,
                commodityStocks: market.commodityStocks.map(stock => stock.commodityId === 'spaceRation' ? { ...stock, stock: 101 } : { ...stock })
            }
            : market),
        planetLifecycle: { capturedPlanetId: 'seroton', landedPlanetId: 'seroton', relandingLockedPlanetId: null }
    });
    const landedPort = createLandingStatusPort(gameFor(landedProvider));
    landedPort.selectCommodity('spaceRation');
    landedPort.setTradeQuantity(2);
    assert.equal(landedPort.getSnapshot().quote.total, 2_500);
    landedPort.confirmTrade();
    landedPort.setTradeQuantity(1);
    assert.equal(landedPort.getSnapshot().quote.total, 1_263, 'the rebuilt ladder uses post-trade stock below the lower threshold');
    landedPort.destroy();
});

test('the landed market port shows, refreshes, trades, and launches from each planet own market', () => {
    const gameFor = provider => ({ registry: { get: key => key === 'telemetry' ? { emit: () => {} } : provider }, events: { emit: () => {} } });
    const stockOf = (state, planetId, commodityId) => state.markets
        .find(market => market.planetId === planetId).commodityStocks
        .find(stock => stock.commodityId === commodityId).stock;
    const provider = new GameStateProvider(initialGameState);
    const port = createLandingStatusPort(gameFor(provider));
    assert.equal(port.getSnapshot().eligible, false);

    for (const planet of initialGameState.planets) {
        const landed = provider.update(state => ({
            ...state,
            clock: pauseGameClock(state.clock, 'landed'),
            planetLifecycle: { capturedPlanetId: planet.id, landedPlanetId: planet.id, relandingLockedPlanetId: null }
        }));
        const initialStock = stockOf(landed, planet.id, 'milk');
        port.selectCommodity('milk');
        port.setTradeQuantity(1);
        const shown = port.getSnapshot();
        assert.equal(shown.planetId, planet.id, planet.name);
        assert.equal(shown.planetName, landed.planets.find(candidate => candidate.id === planet.id).name, planet.name);
        assert.equal(shown.commodities.find(commodity => commodity.commodityId === 'milk').stock, initialStock, planet.name);
        port.confirmTrade();
        assert.equal(port.getSnapshot().commodities.find(commodity => commodity.commodityId === 'milk').stock, initialStock - 1, `${planet.name} projection refreshes after the trade`);
        const afterTrade = provider.snapshot();
        assert.equal(stockOf(afterTrade, planet.id, 'milk'), initialStock - 1, planet.name);
        for (const other of initialGameState.planets) {
            if (other.id === planet.id) continue;
            assert.equal(stockOf(afterTrade, other.id, 'milk'), stockOf(initialGameState, other.id, 'milk'), `${other.id} stays independent after trading at ${planet.name}`);
        }
        port.setTradeQuantity(-1);
        port.confirmTrade();
        assert.equal(stockOf(provider.snapshot(), planet.id, 'milk'), initialStock, `${planet.name} restores its own stock after selling back`);
        port.launch();
        assert.equal(port.getSnapshot().eligible, false, planet.name);
    }
    port.destroy();
});

test('cargo transfer entry pauses, Close resumes, and exit/re-entry clears its visit-local suppression', () => {
    const handlers = new Map();
    const events = {
        on: (name, listener) => handlers.set(name, listener),
        off: (name, listener) => { if (handlers.get(name) === listener) handlers.delete(name); },
        emit: name => handlers.get(name)?.()
    };
    const cargo = {
        id: 'salvage-1', position: { x: 10, y: 0 }, hitPoints: 2,
        orbit: { radius: 10, angleRadians: 0, rotationRadians: 0 },
        manifest: [{ commodityId: 'milk', quantity: 2, totalCost: 0 }]
    };
    const provider = new GameStateProvider({ ...initialGameState, ship: { ...initialGameState.ship, position: { x: 0, y: 0 } }, orbitalCargo: [cargo] });
    const port = createCargoTransferPort({ registry: { get: () => provider }, events });
    assert.equal(port.getSnapshot().visible, true);
    assert(provider.snapshot().clock.pauseReasons.includes('manual'));

    port.close();
    assert.equal(port.getSnapshot().visible, false);
    assert(!provider.snapshot().clock.pauseReasons.includes('manual'));

    provider.update(state => ({ ...state, ship: { ...state.ship, position: { x: 100, y: 0 } } }));
    provider.update(state => ({ ...state, ship: { ...state.ship, position: { x: 0, y: 0 } } }));
    assert.equal(port.getSnapshot().visible, true);
    assert(provider.snapshot().clock.pauseReasons.includes('manual'));
    port.destroy();
});

test('emptying the last orbital cargo stack keeps the transfer modal open instead of auto-closing', () => {
    const handlers = new Map();
    const events = {
        on: (name, listener) => handlers.set(name, listener),
        off: (name, listener) => { if (handlers.get(name) === listener) handlers.delete(name); },
        emit: name => handlers.get(name)?.()
    };
    const cargo = {
        id: 'salvage-1', position: { x: 10, y: 0 }, hitPoints: 2,
        orbit: { radius: 10, angleRadians: 0, rotationRadians: 0 },
        manifest: [{ commodityId: 'milk', quantity: 1, totalCost: 0 }]
    };
    const provider = new GameStateProvider({ ...initialGameState, ship: { ...initialGameState.ship, position: { x: 0, y: 0 } }, orbitalCargo: [cargo] });
    const port = createCargoTransferPort({ registry: { get: () => provider }, events });
    assert.equal(port.getSnapshot().visible, true);
    port.transfer('milk', 'to-ship', 'max');
    const snapshot = port.getSnapshot();
    assert.equal(snapshot.visible, true, 'a transfer must not close the modal');
    assert.equal(snapshot.cargoId, 'salvage-1');
    assert.equal(snapshot.rows.find(row => row.commodityId === 'milk').shipQuantity, 1);
    assert(provider.snapshot().clock.pauseReasons.includes('manual'));
    port.transfer('milk', 'to-orbit', 'one');
    const restored = port.getSnapshot();
    assert.equal(restored.rows.find(row => row.commodityId === 'milk').cargoQuantity, 1);
    assert.equal(restored.rows.find(row => row.commodityId === 'milk').shipQuantity, 0);
    assert.equal(provider.snapshot().orbitalCargo.length, 1);
    port.destroy();
});

test('cargo full warning is shown only for the failure event and expires after exactly two seconds', () => {
    const handlers = new Map();
    const events = {
        on: (name, listener) => handlers.set(name, listener),
        off: (name, listener) => { if (handlers.get(name) === listener) handlers.delete(name); },
        emit: name => handlers.get(name)?.()
    };
    const provider = new GameStateProvider(initialGameState);
    const port = createCargoTransferPort({ registry: { get: () => provider }, events });
    const originalNow = Date.now;
    let now = 1_000;
    Date.now = () => now;
    try {
        events.emit('unrelated-outcome');
        assert.equal(port.getSnapshot().warning, null);
        events.emit('salvage-pickup-cargo-full');
        assert.equal(port.getSnapshot().warning, cargoFullWarning);
        now += cargoFullWarningDurationMs - 1;
        events.emit('step');
        assert.equal(port.getSnapshot().warning, cargoFullWarning);
        now += 1;
        events.emit('step');
        assert.equal(port.getSnapshot().warning, null);
    } finally {
        Date.now = originalNow;
        port.destroy();
    }
});

test('v7 codec preserves lifecycle JSON and rejects v4 and inconsistent lifecycle shapes', () => {
    const planetId = initialGameState.planets[0].id;
    const landed = {
        ...clone(initialGameState),
        clock: { ...clone(initialGameState.clock), pauseReasons: ['landed'] },
        planetLifecycle: { capturedPlanetId: planetId, landedPlanetId: planetId, relandingLockedPlanetId: null }
    };
    const decoded = decodeGameState(landed);
    assert.deepEqual(decodeGameState(encodeGameState(decoded)), decoded);
    assert(Object.isFrozen(decoded.planetLifecycle));

    const legacyV4 = clone(initialGameState);
    legacyV4.schemaVersion = 4;
    delete legacyV4.markets;
    assert.throws(() => decodeGameState(legacyV4));
    assert.throws(() => decodeGameState({
        ...clone(initialGameState),
        planetLifecycle: { capturedPlanetId: planetId, landedPlanetId: planetId, relandingLockedPlanetId: null }
    }));
    assert.throws(() => decodeGameState({
        ...clone(landed),
        planetLifecycle: { capturedPlanetId: null, landedPlanetId: planetId, relandingLockedPlanetId: null }
    }));
    assert.throws(() => decodeGameState({
        ...clone(initialGameState),
        planetLifecycle: { capturedPlanetId: 'unknown', landedPlanetId: null, relandingLockedPlanetId: null }
    }));
    assert.deepEqual(decodeGameState({
        ...clone(initialGameState),
        planetLifecycle: { capturedPlanetId: planetId, landedPlanetId: null, relandingLockedPlanetId: planetId }
    }).planetLifecycle, { capturedPlanetId: planetId, landedPlanetId: null, relandingLockedPlanetId: planetId });
});

test('clock composes background, menu and orientation pauses without advancing active time', () => {
    let clock = pauseGameClock(initialGameState.clock, 'background');
    clock = pauseGameClock(clock, 'menu');
    clock = pauseGameClock(clock, 'orientation');
    assert.deepEqual(clock.pauseReasons, ['background', 'menu', 'orientation']);
    clock = resumeGameClock(clock, 'menu');
    assert.equal(advanceGameClock(clock, 1000).activeElapsedMs, 0);
    clock = resumeGameClock(clock, 'orientation');
    assert.equal(advanceGameClock(clock, 1000).activeElapsedMs, 0);
    clock = resumeGameClock(clock, 'background');
    assert.equal(advanceGameClock(clock, 1000).activeElapsedMs, 1000);
    assert.deepEqual(decodeGameState({ ...clone(initialGameState), clock: { ...clone(initialGameState.clock), pauseReasons: ['menu', 'orientation'] } }).clock.pauseReasons, ['menu', 'orientation']);
});

test('planet projections retain continuity through restore and active-time pauses', () => {
    const input = { target: null, boostRequested: false, firing: false };
    const active = advanceGameSimulation(initialGameState, input, 12_345);
    const restored = decodeGameState(encodeGameState(active));
    const paused = {
        ...restored,
        clock: pauseGameClock(restored.clock, 'background')
    };
    const frozen = advanceGameSimulation(paused, input, 60_000);
    assert.deepEqual(frozen.planets, paused.planets);
    const resumed = {
        ...frozen,
        clock: resumeGameClock(frozen.clock, 'background')
    };
    assert.deepEqual(advanceGameSimulation(restored, input, 321).planets, advanceGameSimulation(resumed, input, 321).planets);
    assert.equal(decodeGameState(encodeGameState(resumed)).schemaVersion, 17);
});

test('v14 codec validates asteroid identity, durability, finite vectors, lifecycle time, and exact orbit shape', () => {
    const decoded = decodeGameState(initialGameState);
    const asteroid = clone(decoded.asteroids[0]);
    assert(Object.isFrozen(decoded.asteroids));
    assert(Object.isFrozen(decoded.asteroids[0]));
    assert.deepEqual(decodeGameState(encodeGameState(decoded)).asteroids, decoded.asteroids);

    const invalidCases = [
        { ...clone(decoded), schemaVersion: 6 },
        { ...clone(decoded), asteroids: [{ ...asteroid, id: '' }] },
        { ...clone(decoded), asteroids: [{ ...asteroid, hitPoints: 0 }] },
        { ...clone(decoded), asteroids: [{ ...asteroid, hitPoints: 4 }] },
        { ...clone(decoded), asteroids: [asteroid, asteroid] },
        { ...clone(decoded), asteroids: [{ ...asteroid, position: { ...asteroid.position, x: Number.POSITIVE_INFINITY } }] },
        { ...clone(decoded), asteroids: [{ ...asteroid, velocity: { ...asteroid.velocity, y: Number.NaN } }] },
        { ...clone(decoded), asteroids: [{ ...asteroid, outsideSafeAreaSinceActiveMs: -1 }] },
        { ...clone(decoded), asteroids: [{ ...asteroid, orbit: { ...asteroid.orbit, radius: 0 } }] },
        { ...clone(decoded), asteroids: [{ ...asteroid, orbit: { ...asteroid.orbit, unexpected: true } }] }
    ];
    for (const invalid of invalidCases) assert.throws(() => decodeGameState(invalid));
});

test('codec preserves only a valid unconsumed cargo schedule and rejects retired schemas', () => {
    const decoded = decodeGameState(initialGameState);
    assert.deepEqual(decodeGameState(encodeGameState(decoded)).cargoSchedule, decoded.cargoSchedule);
    assert.throws(() => decodeGameState({ ...clone(decoded), schemaVersion: 13 }));
    assert.throws(() => decodeGameState({ ...clone(decoded), cargoSchedule: [0, 1, 0, 0, 0, 0] }));
    assert.throws(() => decodeGameState({ ...clone(decoded), cargoSchedule: [0, 1, 1] }));
    assert.throws(() => decodeGameState({ ...clone(decoded), cargoSchedule: [0, 0, 0, 0, 0] }));
    assert.throws(() => decodeGameState({ ...clone(decoded), cargoSchedule: [0, 2] }));
});

test('codec validates the capacity-limited multi-commodity orbital manifest and rejects v14', () => {
    const cargo = manifest => ({ id: 'cargo-1', position: { x: 20, y: 30 }, orbit: { angleRadians: 0.5, radius: 100, rotationRadians: 0 }, hitPoints: 2, manifest });
    const valid = {
        ...clone(initialGameState),
        orbitalCargo: [cargo([
            { commodityId: 'milk', quantity: 3, totalCost: 15 },
            { commodityId: 'grain', quantity: 5, totalCost: 10 }
        ])]
    };
    const decoded = decodeGameState(valid);
    assert.deepEqual(decodeGameState(encodeGameState(decoded)), decoded);
    assert(Object.isFrozen(decoded.orbitalCargo[0].manifest[0]));

    const invalidCases = [
        { ...clone(valid), schemaVersion: 14 },
        { ...clone(valid), orbitalCargo: [cargo([{ commodityId: 'milk', quantity: 1, totalCost: 0 }, { commodityId: 'milk', quantity: 2, totalCost: 0 }])] },
        { ...clone(valid), orbitalCargo: [cargo([{ commodityId: 'unknown', quantity: 1, totalCost: 0 }])] },
        { ...clone(valid), orbitalCargo: [cargo([{ commodityId: 'milk', quantity: 0, totalCost: 0 }])] },
        { ...clone(valid), orbitalCargo: [cargo([])] },
        { ...clone(valid), orbitalCargo: [cargo([{ commodityId: 'milk', quantity: 11, totalCost: 0 }, { commodityId: 'grain', quantity: 10, totalCost: 0 }])] },
        { ...clone(valid), orbitalCargo: [cargo({ commodityId: 'milk', quantity: 1, totalCost: 0 })] },
        { ...clone(valid), orbitalCargo: [cargo([{ commodityId: 'milk', quantity: -1, totalCost: 0 }])] }
    ];
    for (const invalid of invalidCases) assert.throws(() => decodeGameState(invalid));
});

test('run status projection derives clock, capacity and readable run values', () => {
    const state = clone(initialGameState);
    state.clock.activeElapsedMs = 0;
    state.credits = 123_456;
    state.cargo = [{ commodityId: 'ore', quantity: 2, totalCost: 0 }];
    const initial = projectRunStatus(state, true);
    assert.equal(initial.remainingSeconds, 1800);
    assert.equal(initial.runState, 'RUNNING');
    assert.equal(initial.cargoUsed, 2);
    assert.equal(initial.cargoCapacity, 20);
    assert.equal(initial.maximumHitPoints, 100);
    assert.deepEqual(initial.cargo, [{ commodityId: 'ore', quantity: 2, totalCost: 0 }]);

    state.clock.activeElapsedMs = 1;
    assert.equal(projectRunStatus(state, true).remainingSeconds, 1800, 'ceil retains the current displayed second');
    state.clock.activeElapsedMs = 1_000;
    assert.equal(projectRunStatus(state, true).remainingSeconds, 1799);
    state.clock.activeElapsedMs = 1_800_001;
    state.clock.pauseReasons = ['background', 'landed'];
    const finished = projectRunStatus(state, false);
    assert.equal(finished.remainingSeconds, 0);
    assert.equal(finished.runState, 'PAUSED');
    assert.equal(finished.visible, false);
});
