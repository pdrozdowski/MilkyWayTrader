import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decodeGameState, encodeGameState } from '../../src/game/application/gameStateCodec.ts';
import { GameStateProvider } from '../../src/game/application/gameStateProvider.ts';
import { initialGameState } from '../../src/game/definitions/initialGameState.ts';
import { advanceGameClock, pauseGameClock, resumeGameClock } from '../../src/game/mechanics/clock/gameClock.ts';
import { advanceGameSimulation } from '../../src/game/mechanics/gameSimulation.ts';
import { projectRunStatus } from '../../src/game/application/runStatus.ts';
import { applySerotonTrade } from '../../src/game/application/serotonMarket.ts';
import { createLandingStatusPort } from '../../src/ui/adapters/landingStatusAdapter.ts';

const clone = value => JSON.parse(JSON.stringify(value));

test('provider returns detached immutable snapshots and publishes valid replacements', () => {
    const provider = new GameStateProvider(initialGameState);
    const first = provider.snapshot();
    assert(Object.isFrozen(first));
    assert(Object.isFrozen(first.ship));
    assert(Object.isFrozen(first.planets));
    assert(Object.isFrozen(first.cargo));
    assert(Object.isFrozen(first.shipStatus));
    assert.throws(() => { first.ship.position.x = 99; }, TypeError);

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
    assert.equal(state.schemaVersion, 9);
    assert.equal(state.credits, 100_000);
    assert.deepEqual(state.cargo, []);
    assert.deepEqual(state.markets, [{
        planetId: 'seroton',
        commodityStocks: [
            { commodityId: 'supplies', stock: 100 },
            { commodityId: 'alloys', stock: 60 },
            { commodityId: 'medicines', stock: 20 }
        ]
    }]);
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
        { ...clone(advanced), cargo: [{ commodityId: 'ore', quantity: 1, averageBuyPrice: 0 }, { commodityId: 'ore', quantity: 2, averageBuyPrice: 0 }] },
        { ...clone(advanced), cargo: [{ commodityId: '', quantity: 1, averageBuyPrice: 0 }] },
        { ...clone(advanced), cargo: [{ commodityId: 'ore', quantity: -1, averageBuyPrice: 0 }] },
        { ...clone(advanced), cargo: [{ commodityId: 'ore', quantity: 1, averageBuyPrice: -1 }] },
        { ...clone(advanced), markets: [] },
        { ...clone(advanced), markets: [{ planetId: 'lactozis-7c', commodityStocks: clone(advanced.markets[0].commodityStocks) }] },
        { ...clone(advanced), markets: [{ planetId: 'seroton', commodityStocks: [{ commodityId: 'supplies', stock: 1 }, { commodityId: 'supplies', stock: 2 }, { commodityId: 'medicines', stock: 3 }] }] },
        { ...clone(advanced), markets: [{ planetId: 'seroton', commodityStocks: [{ commodityId: 'supplies', stock: 1 }, { commodityId: 'alloys', stock: 2 }] }] },
        { ...clone(advanced), markets: [{ planetId: 'seroton', commodityStocks: [{ commodityId: 'supplies', stock: -1 }, ...clone(advanced.markets[0].commodityStocks.slice(1))] }] },
        { ...clone(advanced), markets: [{ planetId: 'seroton', commodityStocks: [{ commodityId: 'supplies', stock: 1.5 }, ...clone(advanced.markets[0].commodityStocks.slice(1))] }] },
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
        { ...clone(advanced), planets: [...clone(advanced.planets), clone(advanced.planets[0])] },
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

test('provider commits a valid Seroton trade as one immutable replacement', () => {
    const provider = new GameStateProvider(initialGameState);
    const landed = provider.update(state => ({
        ...state,
        clock: { ...state.clock, pauseReasons: ['landed'] },
        planetLifecycle: { capturedPlanetId: 'seroton', landedPlanetId: 'seroton', relandingLockedPlanetId: null }
    }));
    const traded = provider.update(state => applySerotonTrade(state, 'alloys', 2));
    assert.equal(traded.credits, landed.credits - 10_000);
    assert.deepEqual(traded.cargo, [{ commodityId: 'alloys', quantity: 2, averageBuyPrice: 5_000 }]);
    assert.equal(traded.markets[0].commodityStocks.find(stock => stock.commodityId === 'alloys').stock, 58);
    assert.equal(landed.markets[0].commodityStocks.find(stock => stock.commodityId === 'alloys').stock, 60);
});

test('every currently landable planet uses the one shared Seroton market while landed', () => {
    for (const planet of initialGameState.planets) {
        const landed = {
            ...initialGameState,
            clock: { ...initialGameState.clock, pauseReasons: ['landed'] },
            planetLifecycle: { capturedPlanetId: planet.id, landedPlanetId: planet.id, relandingLockedPlanetId: null }
        };
        const quote = applySerotonTrade(landed, 'supplies', 1);
        assert.equal(quote.credits, landed.credits - 1_000, planet.name);
        assert.equal(quote.markets[0].commodityStocks.find(stock => stock.commodityId === 'supplies').stock, 99, planet.name);
        assert.equal(quote.planetLifecycle.landedPlanetId, planet.id, planet.name);
    }
});

test('landed market port rejects unlanded trade commands and rebuilds its visit-local price ladder after a trade', () => {
    const gameFor = provider => ({ registry: { get: key => key === 'telemetry' ? { emit: () => {} } : provider }, events: { emit: () => {} } });
    const unlandedProvider = new GameStateProvider(initialGameState);
    const unlandedPort = createLandingStatusPort(gameFor(unlandedProvider));
    unlandedPort.selectCommodity('supplies');
    unlandedPort.setTradeQuantity(1);
    unlandedPort.confirmTrade();
    assert.equal(unlandedPort.getSnapshot().eligible, false);
    assert.deepEqual(unlandedProvider.snapshot().cargo, []);
    assert.equal(unlandedProvider.snapshot().credits, initialGameState.credits);
    unlandedPort.destroy();

    const landedProvider = new GameStateProvider({
        ...initialGameState,
        clock: { ...initialGameState.clock, pauseReasons: ['landed'] },
        markets: [{
            planetId: 'seroton',
            commodityStocks: initialGameState.markets[0].commodityStocks.map(stock => stock.commodityId === 'supplies'
                ? { ...stock, stock: 51 }
                : { ...stock })
        }],
        planetLifecycle: { capturedPlanetId: 'seroton', landedPlanetId: 'seroton', relandingLockedPlanetId: null }
    });
    const landedPort = createLandingStatusPort(gameFor(landedProvider));
    landedPort.setTradeQuantity(2);
    assert.equal(landedPort.getSnapshot().quote.total, 2_000);
    landedPort.confirmTrade();
    landedPort.setTradeQuantity(1);
    assert.equal(landedPort.getSnapshot().quote.total, 1_020, 'the rebuilt ladder uses post-trade stock below the lower threshold');
    landedPort.destroy();
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
    assert.equal(decodeGameState(encodeGameState(resumed)).schemaVersion, 9);
});

test('v9 codec validates asteroid identity, durability, finite vectors, lifecycle time, and exact orbit shape', () => {
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

test('run status projection derives clock, capacity and readable run values', () => {
    const state = clone(initialGameState);
    state.clock.activeElapsedMs = 0;
    state.credits = 123_456;
    state.cargo = [{ commodityId: 'ore', quantity: 2, averageBuyPrice: 0 }];
    const initial = projectRunStatus(state, true);
    assert.equal(initial.remainingSeconds, 1800);
    assert.equal(initial.runState, 'RUNNING');
    assert.equal(initial.cargoUsed, 2);
    assert.equal(initial.cargoCapacity, 20);
    assert.equal(initial.maximumHitPoints, 100);
    assert.deepEqual(initial.cargo, [{ commodityId: 'ore', quantity: 2, averageBuyPrice: 0 }]);

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
