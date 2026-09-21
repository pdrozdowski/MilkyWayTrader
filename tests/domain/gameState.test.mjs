import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decodeGameState, encodeGameState } from '../../src/game/application/gameStateCodec.ts';
import { GameStateProvider } from '../../src/game/application/gameStateProvider.ts';
import { initialGameState } from '../../src/game/definitions/initialGameState.ts';
import { advanceGameClock, pauseGameClock, resumeGameClock } from '../../src/game/mechanics/clock/gameClock.ts';
import { advanceGameSimulation } from '../../src/game/mechanics/gameSimulation.ts';

const clone = value => JSON.parse(JSON.stringify(value));

test('provider returns detached immutable snapshots and publishes valid replacements', () => {
    const provider = new GameStateProvider(initialGameState);
    const first = provider.snapshot();
    assert(Object.isFrozen(first));
    assert(Object.isFrozen(first.ship));
    assert(Object.isFrozen(first.planets));
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

test('codec round trips exact JSON-safe state and restore failures are atomic', () => {
    const provider = new GameStateProvider(initialGameState);
    const advanced = provider.update(state => advanceGameSimulation(state, {
        target: { x: 5000, y: 600 }, boostRequested: false, firing: true
    }, 250));
    const encoded = encodeGameState(advanced);
    assert.deepEqual(decodeGameState(encoded), advanced);

    const invalidCases = [
        { ...clone(advanced), schemaVersion: 3 },
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

test('codec migrates schema v1 scalar coordinates into schema v2 vectors', () => {
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
    assert.deepEqual(decodeGameState(legacy), current);
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
    const active = provider.update(state => advanceGameSimulation(state, {
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
});
