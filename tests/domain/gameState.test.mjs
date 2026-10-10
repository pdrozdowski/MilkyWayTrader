import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decodeGameState, encodeGameState } from '../../src/game/application/gameStateCodec.ts';
import { GameStateProvider } from '../../src/game/application/gameStateProvider.ts';
import { initialGameState } from '../../src/game/definitions/initialGameState.ts';
import { advanceGameClock, pauseGameClock, resumeGameClock, setGameClockPlayerPaused } from '../../src/game/mechanics/clock/gameClock.ts';
import { advanceGameSimulation } from '../../src/game/mechanics/gameSimulation.ts';
import { projectRunStatus } from '../../src/game/application/runStatus.ts';
import { applyLandedTrade, quoteLandedTrade } from '../../src/game/application/serotonMarket.ts';
import { createLandingStatusPort } from '../../src/ui/adapters/landingStatusAdapter.ts';
import { createCargoTransferPort, cargoFullWarning, cargoFullWarningDurationMs } from '../../src/ui/adapters/cargoTransferAdapter.ts';

const clone = value => JSON.parse(JSON.stringify(value));

test('provider reads hand out the frozen authoritative state and publishes valid replacements', () => {
    const provider = new GameStateProvider(initialGameState);
    const first = provider.snapshot();
    assert.equal(provider.snapshot(), first, 'a read must not copy or serialize the aggregate');
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
    assert.notEqual(updated, first, 'a commit must replace the aggregate with a new frozen object');
    assert.equal(updated.clock.activeElapsedMs, 125);
    assert.equal(first.clock.activeElapsedMs, 0, 'an older read keeps the values it was handed');
    assert.deepEqual(notifications, [125]);
    unsubscribe();
    provider.reset();
    assert.deepEqual(notifications, [125]);
    assert.equal(provider.snapshot().clock.activeElapsedMs, 0);
});

test('the write boundary rejects a malformed reducer result and keeps the previous state', () => {
    const provider = new GameStateProvider(initialGameState);
    const before = provider.snapshot();
    const notifications = [];
    const unsubscribe = provider.subscribe(state => notifications.push(state));
    assert.throws(() => provider.update(state => ({ ...state, credits: -1 })), /state\.credits must not be negative/);
    assert.throws(() => provider.update(() => ({ ...clone(initialGameState), schemaVersion: 16 })), /Unsupported game-state schema version/);
    assert.throws(() => provider.update(state => ({ ...state, ship: { ...state.ship, position: { x: Number.NaN, y: 0 } } })), /state\.ship\.position\.x must be a finite number/);
    unsubscribe();
    // Identity is the strongest form of "untouched": a rejected commit must not swap the aggregate either.
    assert.equal(provider.snapshot(), before, 'a rejected commit leaves the authoritative state in place');
    assert.deepEqual(notifications, [], 'a rejected commit notifies no subscriber');
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
    assert.equal(state.schemaVersion, 18);
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
        { ...clone(advanced), shipStatus: { ...clone(advanced.shipStatus), cargoLevel: 6 } },
        { ...clone(advanced), shipStatus: { ...clone(advanced.shipStatus), cargoLevel: 1.5 } },
        { ...clone(advanced), shipStatus: { ...clone(advanced.shipStatus), engineLevel: 6 } },
        { ...clone(advanced), shipStatus: { ...clone(advanced.shipStatus), weaponLevel: 11 } },
        { ...clone(advanced), shipStatus: { ...clone(advanced.shipStatus), weaponLevel: 2.5 } },
        {
            ...clone(advanced),
            ship: { ...clone(advanced.ship), boosting: true },
            shipStatus: { ...clone(advanced.shipStatus), boosterUnlocked: false }
        },
        { ...clone(advanced), clock: { ...clone(advanced.clock), pauseReasons: ['unknown'] } },
        { ...clone(advanced), clock: { ...clone(advanced.clock), pauseReasons: ['manual', 'manual'] } },
        { ...clone(advanced), clock: { ...clone(advanced.clock), playerPaused: 'false' } },
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

test('v18 facility state rejects the previous schema and round trips detached records', () => {
    const decoded = decodeGameState(initialGameState);
    assert.equal(decoded.schemaVersion, 18);
    assert.throws(() => decodeGameState({ ...clone(initialGameState), schemaVersion: 17 }));
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

test('the codec binds every ship-service level to its balance catalogue', () => {
    const maxed = {
        ...clone(initialGameState),
        shipStatus: { currentHitPoints: 100, cargoLevel: 5, engineLevel: 5, weaponLevel: 10, boosterUnlocked: true }
    };
    assert.deepEqual(decodeGameState(maxed).shipStatus, maxed.shipStatus);
    assert.deepEqual(decodeGameState(encodeGameState(maxed)).shipStatus, maxed.shipStatus);

    for (const level of [1, 2, 3, 4, 5]) {
        const candidate = { ...clone(initialGameState), shipStatus: { ...clone(initialGameState.shipStatus), cargoLevel: level, engineLevel: level } };
        assert.equal(decodeGameState(candidate).shipStatus.cargoLevel, level);
        assert.equal(decodeGameState(candidate).shipStatus.engineLevel, level);
    }
    for (const level of [1, 2, 5, 9, 10]) {
        const candidate = { ...clone(initialGameState), shipStatus: { ...clone(initialGameState.shipStatus), weaponLevel: level } };
        assert.equal(decodeGameState(candidate).shipStatus.weaponLevel, level);
    }

    const unsupported = [
        { cargoLevel: 6 },
        { cargoLevel: 1.5 },
        { engineLevel: 6 },
        { engineLevel: -1 },
        { weaponLevel: 0 },
        { weaponLevel: 11 },
        { weaponLevel: 2.5 }
    ];
    for (const override of unsupported) {
        const candidate = { ...clone(initialGameState), shipStatus: { ...clone(initialGameState.shipStatus), ...override } };
        assert.throws(() => decodeGameState(candidate), Error, JSON.stringify(override));
    }
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

test('clock composes player pause intent with unique environmental pause reasons', () => {
    let clock = initialGameState.clock;
    clock = setGameClockPlayerPaused(clock, true);
    clock = pauseGameClock(clock, 'background');
    assert.deepEqual(clock.pauseReasons, ['background']);
    assert.equal(advanceGameClock(clock, 60_000).activeElapsedMs, 0);
    clock = resumeGameClock(clock, 'background');
    assert.equal(advanceGameClock(clock, 60_000).activeElapsedMs, 0, 'the player pause remains after the blocker clears');
    clock = setGameClockPlayerPaused(clock, false);
    assert.equal(setGameClockPlayerPaused(clock, false), clock, 'setting the current player choice is idempotent');
    clock = advanceGameClock(clock, 65_432);
    assert.equal(clock.activeElapsedMs, 65_432, 'long active frames retain their full clock delta');
    let environmentallyBlocked = pauseGameClock(setGameClockPlayerPaused(initialGameState.clock, false), 'background');
    assert.equal(advanceGameClock(environmentallyBlocked, 1_000).activeElapsedMs, 0);
    environmentallyBlocked = resumeGameClock(environmentallyBlocked, 'background');
    assert.equal(advanceGameClock(environmentallyBlocked, 1_000).activeElapsedMs, 1_000, 'clearing the environmental blocker restores the running player choice');
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
        clock: { ...state.clock, playerPaused: true, pauseReasons: [] },
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
            clock: { ...initialGameState.clock, playerPaused: true, pauseReasons: [] },
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
        clock: { ...initialGameState.clock, playerPaused: true, pauseReasons: [] },
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

test('the landing port projects and refreshes landed ship services on every planet', () => {
    const gameFor = provider => ({ registry: { get: key => key === 'telemetry' ? { emit: () => {} } : provider }, events: { emit: () => {} } });
    const provider = new GameStateProvider(initialGameState);
    const port = createLandingStatusPort(gameFor(provider));
    assert.equal(port.getShipyardSnapshot().visible, false);
    assert.equal(port.getShipyardSnapshot().repair.failure, 'not-landed');
    const unlanded = provider.snapshot();
    port.repairShip();
    port.upgradeShipService('cargo');
    port.purchaseBooster();
    assert.deepEqual(provider.snapshot(), unlanded, 'unlanded shipyard commands are inert');

    const land = planetId => provider.update(state => ({
        ...state,
        shipStatus: { ...state.shipStatus, currentHitPoints: 75 },
        clock: { ...state.clock, playerPaused: true },
        planetLifecycle: { capturedPlanetId: planetId, landedPlanetId: planetId, relandingLockedPlanetId: null }
    }));
    const cases = [['seroton', 'cargo', 15_000], ['lactozis-7c', 'engine', 20_000], ['maslo-prime', 'weaponary', 20_000]];
    for (const [planetId, serviceId, price] of cases) {
        const before = land(planetId);
        const shown = port.getShipyardSnapshot();
        assert.equal(shown.visible, true, planetId);
        assert.equal(shown.planetId, planetId);
        assert.equal(shown.repair.currentHitPoints, 75);
        assert.equal(shown.repair.price, 1_000);
        assert.equal(shown.repair.failure, null);
        const available = shown.services.filter(row => row.available);
        assert.deepEqual(available.map(row => row.serviceId), [serviceId], planetId);
        assert.equal(available[0].price, price);
        assert.equal(available[0].affordable, true);
        assert.equal(shown.booster.available, planetId === 'lactozis-7c');

        for (const row of shown.services.filter(candidate => candidate.serviceId !== serviceId)) {
            const untouched = provider.snapshot();
            port.upgradeShipService(row.serviceId);
            assert.deepEqual(provider.snapshot(), untouched, `${row.serviceId} is not sold on ${planetId}`);
            assert.equal(port.getShipyardSnapshot().services.find(candidate => candidate.serviceId === row.serviceId).available, false);
        }

        port.upgradeShipService(serviceId);
        const purchased = port.getShipyardSnapshot();
        assert.equal(purchased.services.find(row => row.serviceId === serviceId).level, 2, planetId);
        assert.equal(purchased.credits, before.credits - price);
        assert.equal(provider.snapshot().credits, before.credits - price);

        port.repairShip();
        assert.equal(port.getShipyardSnapshot().repair.currentHitPoints, 85, planetId);
        assert.equal(port.getShipyardSnapshot().credits, before.credits - price - 1_000);
    }

    provider.update(state => ({ ...state, credits: 100_000 }));
    land('lactozis-7c');
    assert.equal(port.getShipyardSnapshot().booster.available, true);
    const beforeBooster = provider.snapshot();
    port.purchaseBooster();
    assert.equal(port.getShipyardSnapshot().booster.owned, true);
    assert.equal(port.getShipyardSnapshot().booster.available, false);
    assert.equal(port.getShipyardSnapshot().booster.failure, 'already-owned');
    assert.equal(provider.snapshot().credits, beforeBooster.credits - 75_000);
    const afterBooster = provider.snapshot();
    port.purchaseBooster();
    assert.deepEqual(provider.snapshot(), afterBooster, 'the booster is a one-time purchase');

    port.launch();
    assert.equal(port.getShipyardSnapshot().visible, false);
    const launcher = provider.snapshot();
    port.purchaseBooster();
    assert.deepEqual(provider.snapshot(), launcher, 'launching ends shipyard service access');
    port.destroy();
});

test('the landing port skips its projections while flying and still projects the landing itself', () => {
    const gameFor = provider => ({ registry: { get: key => key === 'telemetry' ? { emit: () => {} } : provider }, events: { emit: () => {} } });
    const provider = new GameStateProvider(initialGameState);
    const port = createLandingStatusPort(gameFor(provider));
    const facilitiesBefore = port.getFacilitiesSnapshot();
    const shipyardBefore = port.getShipyardSnapshot();
    const snapshotBefore = port.getSnapshot();
    assert.equal(snapshotBefore.eligible, false);

    for (let frame = 0; frame < 5; frame++) provider.update(state => ({ ...state, clock: advanceGameClock(state.clock, 16) }));
    port.selectCommodity('spaceRation');
    port.setTradeQuantity(1);
    assert.equal(port.getFacilitiesSnapshot(), facilitiesBefore, 'an in-flight refresh must not re-project the facilities');
    assert.equal(port.getShipyardSnapshot(), shipyardBefore, 'an in-flight refresh must not re-project the shipyard');
    assert.equal(port.getSnapshot(), snapshotBefore, 'an in-flight refresh must not re-project the market');

    provider.update(state => ({
        ...state,
        clock: { ...state.clock, playerPaused: true },
        planetLifecycle: { capturedPlanetId: 'seroton', landedPlanetId: 'seroton', relandingLockedPlanetId: null }
    }));
    assert.notEqual(port.getShipyardSnapshot(), shipyardBefore, 'landing must project immediately');
    assert.equal(port.getSnapshot().eligible, true);
    assert.equal(port.getSnapshot().planetId, 'seroton');
    assert.equal(port.getSnapshot().selectedCommodityId, 'milk', 'the landing transition still resets the visit-local selection');
    assert.equal(port.getShipyardSnapshot().visible, true);

    port.launch();
    assert.equal(port.getSnapshot().eligible, false, 'launching must project once so the panel hides');
    assert.equal(port.getShipyardSnapshot().visible, false);
    port.destroy();
});

test('purchased ship services change flight, cargo and volley behaviour through the authoritative boundary', () => {
    const gameFor = provider => ({ registry: { get: key => key === 'telemetry' ? { emit: () => {} } : provider }, events: { emit: () => {} } });
    const provider = new GameStateProvider({
        ...initialGameState,
        credits: 1_000_000,
        asteroids: [],
        ship: { ...initialGameState.ship, position: { x: 20_000, y: 20_000 }, velocity: { x: 0, y: 0 } },
        clock: { ...initialGameState.clock, playerPaused: true, pauseReasons: [] },
        planetLifecycle: { capturedPlanetId: 'lactozis-7c', landedPlanetId: 'lactozis-7c', relandingLockedPlanetId: null }
    });
    const port = createLandingStatusPort(gameFor(provider));
    const land = planetId => provider.update(state => ({
        ...state,
        clock: { ...state.clock, playerPaused: true },
        planetLifecycle: { capturedPlanetId: planetId, landedPlanetId: planetId, relandingLockedPlanetId: null }
    }));

    port.upgradeShipService('engine');
    port.purchaseBooster();
    assert.equal(provider.snapshot().shipStatus.engineLevel, 2);
    assert.equal(provider.snapshot().shipStatus.boosterUnlocked, true);
    assert.equal(provider.snapshot().credits, 1_000_000 - 20_000 - 75_000);

    port.launch();
    const target = { x: 420_000, y: 20_000 };
    let cruising = provider.snapshot();
    for (let tick = 0; tick < 10; tick++) cruising = advanceGameSimulation(cruising, { target, boostRequested: false, firing: false }, 100);
    assert(Math.abs(Math.hypot(cruising.ship.velocity.x, cruising.ship.velocity.y) - 264) < 1e-9, 'a level-two engine cruises at 110% of the level-one speed');
    let boosted = cruising;
    for (let tick = 0; tick < 20; tick++) boosted = advanceGameSimulation(boosted, { target, boostRequested: true, firing: false }, 100);
    assert(Math.abs(Math.hypot(boosted.ship.velocity.x, boosted.ship.velocity.y) - 1200) < 1e-9, 'the purchased booster keeps the fixed level-one 5x speed');

    land('seroton');
    port.upgradeShipService('cargo');
    assert.equal(provider.snapshot().shipStatus.cargoLevel, 2);
    assert.equal(quoteLandedTrade(provider.snapshot(), 'grain', 50).failure, null, 'a level-two cargo hold fits 50 units');
    assert.equal(quoteLandedTrade(provider.snapshot(), 'grain', 51).failure, 'insufficient-cargo');

    provider.update(state => ({ ...state, shipStatus: { ...state.shipStatus, currentHitPoints: 75 } }));
    port.repairShip();
    assert.equal(provider.snapshot().shipStatus.currentHitPoints, 85, 'a repair restores 10% of maximum HP');

    land('maslo-prime');
    port.upgradeShipService('weaponary');
    assert.equal(provider.snapshot().shipStatus.weaponLevel, 2);
    port.launch();
    const firing = provider.update(state => advanceGameSimulation({ ...state, ship: { ...state.ship, rotation: 0 } }, {
        target: null, boostRequested: false, firing: true
    }, 1));
    assert.deepEqual(firing.projectiles.map(projectile => projectile.id), ['projectile-1-1', 'projectile-1-2']);
    const offsets = firing.projectiles.map(projectile => Math.atan2(projectile.velocity.x, -projectile.velocity.y) * 180 / Math.PI);
    assert(Math.abs(offsets[0] + 2.5) < 1e-9 && Math.abs(offsets[1] - 2.5) < 1e-9,
        'a level-two weapon straddles the heading half a volley step to each side');

    const restored = new GameStateProvider(initialGameState);
    restored.restore(encodeGameState(firing));
    assert.deepEqual(restored.snapshot().shipStatus, firing.shipStatus, 'every purchase survives serialization');
    const undisturbed = { target: null, boostRequested: false, firing: false };
    assert.deepEqual(advanceGameSimulation(restored.snapshot(), undisturbed, 400), advanceGameSimulation(firing, undisturbed, 400),
        'a restored upgraded run continues identically');
    port.destroy();
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
            clock: { ...state.clock, playerPaused: true },
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

test('v18 codec preserves lifecycle JSON and rejects v17 and inconsistent lifecycle shapes', () => {
    const planetId = initialGameState.planets[0].id;
    const landed = {
        ...clone(initialGameState),
        clock: { ...clone(initialGameState.clock), playerPaused: true, pauseReasons: [] },
        planetLifecycle: { capturedPlanetId: planetId, landedPlanetId: planetId, relandingLockedPlanetId: null }
    };
    const decoded = decodeGameState(landed);
    assert.deepEqual(decodeGameState(encodeGameState(decoded)), decoded);
    assert(Object.isFrozen(decoded.planetLifecycle));

    const legacyV17 = clone(initialGameState);
    legacyV17.schemaVersion = 17;
    assert.throws(() => decodeGameState(legacyV17));
    const landedWhileRunning = decodeGameState({
        ...clone(initialGameState),
        planetLifecycle: { capturedPlanetId: planetId, landedPlanetId: planetId, relandingLockedPlanetId: null }
    });
    assert.equal(landedWhileRunning.clock.playerPaused, false);
    assert.equal(landedWhileRunning.planetLifecycle.landedPlanetId, planetId);
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
    assert.equal(decodeGameState(encodeGameState(resumed)).schemaVersion, 18);
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
    assert.equal(initial.cargoCapacity, 40);
    assert.equal(initial.maximumHitPoints, 100);
    assert.deepEqual(initial.cargo, [{ commodityId: 'ore', quantity: 2, totalCost: 0 }]);

    state.clock.activeElapsedMs = 1;
    assert.equal(projectRunStatus(state, true).remainingSeconds, 1800, 'ceil retains the current displayed second');
    state.clock.activeElapsedMs = 1_000;
    assert.equal(projectRunStatus(state, true).remainingSeconds, 1799);
    state.clock.activeElapsedMs = 1_800_001;
    state.clock.playerPaused = true;
    state.clock.pauseReasons = ['background'];
    const finished = projectRunStatus(state, false);
    assert.equal(finished.remainingSeconds, 0);
    assert.equal(finished.runState, 'PAUSED');
    assert.equal(finished.visible, false);
});
