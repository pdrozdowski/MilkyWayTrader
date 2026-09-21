import assert from 'node:assert/strict';
import { test } from 'node:test';
import { boostAccelerationRate, flightVelocity, directionRotation } from '../src/game/mechanics/spaceship/flight.ts';
import { canLandNearPlanet, planetLandingRadius, PLANET_LANDING_SURFACE_GAP } from '../src/game/mechanics/planet/proximity.ts';
import { segmentHitsCircle, shotTrajectory } from '../src/game/mechanics/projectile/trajectory.ts';
import { advanceFireCadence } from '../src/game/mechanics/spaceship/fireCadence.ts';
import { gameObjectLayout, PLANET_SIZE_MULTIPLIER, SUN_RADIUS } from '../src/game/scenes/gameObjects.ts';

const tuning = { maxSpeed: 240, accelerationSeconds: 1, stoppingSeconds: 0.5 };
const speed = velocity => Math.hypot(velocity.x, velocity.y);

test('flight reaches its limit in one second and coasts to rest in half a second', () => {
    let velocity = { x: 0, y: 0 };
    for (let frame = 0; frame < 30; frame++) velocity = flightVelocity(velocity, { x: 10000, y: 10000 }, 1 / 60, tuning);
    assert(Math.abs(speed(velocity) - 120) < 1e-8);
    for (let frame = 0; frame < 30; frame++) velocity = flightVelocity(velocity, { x: 10000, y: 10000 }, 1 / 60, tuning);
    assert(Math.abs(speed(velocity) - 240) < 1e-8);
    velocity = flightVelocity(velocity, null, 1 / 60, tuning);
    assert.equal(velocity.enginesOn, false);
    for (let frame = 1; frame < 30; frame++) velocity = flightVelocity(velocity, null, 1 / 60, tuning);
    assert(speed(velocity) < 1e-8);
});

test('steering changes immediately, resumes from current speed, and cannot overshoot a target', () => {
    const turned = flightVelocity({ x: 120, y: 0 }, { x: 0, y: -1000 }, 1 / 60, tuning);
    assert.equal(turned.x, 0);
    assert.equal(turned.y, -124);
    const close = flightVelocity({ x: 240, y: 0 }, { x: 3, y: 0 }, 1 / 60, tuning);
    assert(close.x / 60 <= 3);
    assert.deepEqual(flightVelocity(close, { x: 0, y: 0 }, 1 / 60, tuning), { x: 0, y: 0, enginesOn: false });
    assert.equal(speed(flightVelocity({ x: 120, y: 0 }, null, 0.25, tuning)), 0);
});

test('ship rotation follows arbitrary velocity and retains its heading when stopped', () => {
    for (const angle of [0, 0.17, Math.PI / 4, Math.PI / 2, Math.PI, -Math.PI / 2, -0.73]) {
        const rotation = directionRotation(Math.sin(angle) * 240, -Math.cos(angle) * 240, 0);
        assert(Math.abs(Math.sin(rotation) - Math.sin(angle)) < 1e-8);
        assert(Math.abs(Math.cos(rotation) - Math.cos(angle)) < 1e-8);
    }
    assert.equal(directionRotation(0, 0, 1.23), 1.23);
    assert.equal(directionRotation(0.01, 0.01, -0.73), -0.73);
});

test('boost reaches five times normal speed in one second from rest, cruise, or coasting', () => {
    for (const initialSpeed of [0, 120, 240, 700]) {
        let velocity = { x: initialSpeed, y: 0 };
        const boosted = { ...tuning, maxSpeed: 1200, accelerationRate: boostAccelerationRate(initialSpeed, 240, 5, 1) };
        for (let frame = 0; frame < 30; frame++) velocity = flightVelocity(velocity, { x: 100000, y: 0 }, 1 / 60, boosted);
        assert(Math.abs(speed(velocity) - (initialSpeed + (1200 - initialSpeed) / 2)) < 1e-8);
        for (let frame = 0; frame < 30; frame++) velocity = flightVelocity(velocity, { x: 100000, y: 0 }, 1 / 60, boosted);
        assert(Math.abs(speed(velocity) - 1200) < 1e-8);
        const turned = flightVelocity(velocity, { x: 0, y: -100000 }, 1 / 60, boosted);
        assert.equal(turned.x, 0); assert(Math.abs(turned.y + 1200) < 1e-8);
        const close = flightVelocity(velocity, { x: 3, y: 0 }, 1 / 60, boosted);
        assert(close.x / 60 <= 3);
    }
    let velocity = { x: 1200, y: 0 };
    for (let frame = 0; frame < 60; frame++) velocity = flightVelocity(velocity, { x: 100000, y: 0 }, 1 / 60, { ...tuning, decelerationRate: 960 });
    assert(Math.abs(speed(velocity) - 240) < 1e-8);
    velocity = { x: 1200, y: 0 };
    for (let frame = 0; frame < 30; frame++) velocity = flightVelocity(velocity, null, 1 / 60, { ...tuning, decelerationRate: 2400 });
    assert(speed(velocity) < 1e-8);
});

test('landing uses the same surface gap for every planet', () => {
    for (const radius of [48,80,110]) {
        const threshold = planetLandingRadius(radius, 18);
        assert.equal(PLANET_LANDING_SURFACE_GAP, 72);
        assert.equal(threshold - radius, 90, 'every planet retains the smallest planet ring spacing');
        assert.equal(canLandNearPlanet(threshold,18,radius), true);
        assert.equal(canLandNearPlanet(threshold + 0.01,18,radius), false);
        assert.equal(canLandNearPlanet(radius + 18,18,radius), true);
    }
});

test('the sun is five times the largest 3x planet and the starting layout has no overlapping bodies', () => {
    assert.equal(PLANET_SIZE_MULTIPLIER, 3);
    assert.deepEqual(gameObjectLayout.planets.map(planet => planet.model.radius), [144, 240, 330]);
    assert.equal(SUN_RADIUS, 1650);
    assert.equal(SUN_RADIUS, Math.max(...gameObjectLayout.planets.map(planet => planet.model.radius)) * 5);
    assert.deepEqual({ x: gameObjectLayout.sun.x, y: gameObjectLayout.sun.y, radius: gameObjectLayout.sun.size / 2 }, { x: 0, y: 0, radius: SUN_RADIUS });
    const bodies = [
        { id: 'sun', x: gameObjectLayout.sun.x, y: gameObjectLayout.sun.y, radius: SUN_RADIUS },
        ...gameObjectLayout.planets.map(planet => ({ id: planet.model.id, ...planet.model.position, radius: planet.model.radius }))
    ];
    for (let index = 0; index < bodies.length; index++) for (const other of bodies.slice(index + 1)) {
        assert(Math.hypot(bodies[index].x - other.x, bodies[index].y - other.y) > bodies[index].radius + other.radius,
            `${bodies[index].id} must not overlap ${other.id}`);
    }
    const ship = { ...gameObjectLayout.ship, radius: 36 };
    for (const body of bodies) assert(Math.hypot(ship.x - body.x, ship.y - body.y) > ship.radius + body.radius,
        `ship must start outside ${body.id}`);
});

test('fast projectile paths detect crossed planets, tangent hits and endpoints without false hits', () => {
    const planet = { x: 100, y: 0, radius: 48 };
    assert(segmentHitsCircle({ x: 0, y: 0 }, { x: 200, y: 0 }, planet, 3), 'both endpoints can miss while the path crosses a planet');
    assert(segmentHitsCircle({ x: 200, y: 0 }, { x: 0, y: 0 }, planet, 3), 'reverse direction also hits');
    assert(segmentHitsCircle({ x: 0, y: 51 }, { x: 200, y: 51 }, planet, 3), 'tangent contact hits');
    assert(!segmentHitsCircle({ x: 0, y: 51.01 }, { x: 200, y: 51.01 }, planet, 3));
    assert(!segmentHitsCircle({ x: 0, y: 0 }, { x: 48.99, y: 0 }, planet, 3));
    assert(segmentHitsCircle({ x: 0, y: 0 }, { x: 49, y: 0 }, planet, 3), 'endpoint contact hits');
    assert(segmentHitsCircle({ x: 100, y: 0 }, { x: 100, y: 0 }, planet, 3), 'spawn inside a planet hits');
    assert(!segmentHitsCircle({ x: 0, y: 0 }, { x: 0, y: 0 }, planet, 3));
    const shot = shotTrajectory({ x: -100, y: 200 }, Math.PI / 2, 38, 12000);
    assert(Math.abs(shot.start.x + 62) < 1e-8 && Math.abs(shot.start.y - 200) < 1e-8);
    assert(Math.abs(shot.velocity.x - 12000) < 1e-8 && Math.abs(shot.velocity.y) < 1e-8);
});

test('held fire keeps a half-second beat despite late frames, without booster backlogs or rapid taps', () => {
    let weapon = { nextShotAtMs: null, lastShotAtMs: null, projectileSequence: 0 };
    const fire = (time, enabled) => {
        const result = advanceFireCadence(weapon, time, enabled, 500);
        weapon = result.weapon;
        return result.fired;
    };
    for (const time of [0, 510, 1005, 1515, 2000, 2510, 3000]) {
        assert(fire(time, true), `shot due at ${time}`);
        assert(!fire(time + 1, true), 'key repeats and consecutive frames cannot add shots');
    }
    assert(!fire(3200, false), 'release or boost suppresses fire');
    assert(!fire(3201, true), 'rapid re-press still respects cooldown');
    assert(fire(3500, true));
    assert(!fire(4000, false));
    assert(!fire(10000, false));
    assert(fire(10000, true), 'boost ends with one immediate shot');
    assert(!fire(10001, true), 'no buffered booster shots');
    assert(fire(10500, true));
    assert(fire(20000, true), 'a stalled frame resumes firing once');
    assert(!fire(20001, true), 'a long stall never causes a catch-up burst');
    assert(fire(20500, true));
    weapon = { nextShotAtMs: null, lastShotAtMs: null, projectileSequence: 0 };
    assert(fire(0, true));
    assert(fire(999, true));
    assert(!fire(1000, true), 'a late shot cannot be followed by a second shot one millisecond later');
    assert(fire(1499, true));
});

