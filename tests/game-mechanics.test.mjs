import assert from 'node:assert/strict';
import { test } from 'node:test';
import { boostAccelerationRate, flightVelocity, directionRotation } from '../src/game/mechanics/spaceship/flight.ts';
import { canLandNearPlanet, planetLandingRadius, planetOrbitBoundaryRadius, PLANET_LANDING_SURFACE_GAP } from '../src/game/mechanics/planet/proximity.ts';
import { segmentHitsCircle, shotTrajectory } from '../src/game/mechanics/projectile/trajectory.ts';
import { advanceFireCadence } from '../src/game/mechanics/spaceship/fireCadence.ts';
import { initialGameState } from '../src/game/definitions/initialGameState.ts';
import { advanceGameSimulation } from '../src/game/mechanics/gameSimulation.ts';
import { gameObjectLayout, PLANET_SIZE_MULTIPLIER, SUN_RADIUS } from '../src/game/scenes/gameObjects.ts';
import { planetDefinitions } from '../src/game/definitions/planetDefinitions.ts';
import { projectPlanetPosition } from '../src/game/mechanics/planet/orbit.ts';
import { MOOLARIS_CONTROL_CLEARANCE, MOOLARIS_RECOVERY_SECONDS, moolarisDefinition } from '../src/game/definitions/moolarisDefinition.ts';
import { isRecoveringFromMoolaris, moolarisControlRadius, resolveMoolarisContact } from '../src/game/mechanics/moolaris/contact.ts';
import { asteroidBeltDefinition } from '../src/game/visual/asteroidBeltDefinition.ts';
import { asteroidBeltLayout, projectAsteroidBelt } from '../src/game/visual/asteroidBelt.ts';
import { activeTimeCycle, activeTimeWave } from '../src/game/visual/activeTime.ts';
import { launchFromPlanet, LANDING_CENTRE_RADIUS, tryLandAtCapturedPlanet } from '../src/game/mechanics/planet/landing.ts';

const tuning = { maxSpeed: 240, accelerationSeconds: 1, stoppingSeconds: 0.5 };
const speed = velocity => Math.hypot(velocity.x, velocity.y);

function lifecycleState (distance, lifecycle = {}, activeElapsedMs = 100) {
    const planet = initialGameState.planets[0];
    const planetLifecycle = { capturedPlanetId: null, landedPlanetId: null, relandingLockedPlanetId: null, ...lifecycle };
    const currentPosition = projectPlanetPosition(planet.id, activeElapsedMs);
    const nextPosition = projectPlanetPosition(planet.id, activeElapsedMs + 1);
    const shipPosition = planetLifecycle.capturedPlanetId === planet.id ? currentPosition : nextPosition;
    return {
        ...initialGameState,
        clock: { ...initialGameState.clock, activeElapsedMs },
        planets: initialGameState.planets.map(candidate => ({ ...candidate, position: projectPlanetPosition(candidate.id, activeElapsedMs) })),
        ship: { ...initialGameState.ship, position: { x: shipPosition.x + distance, y: shipPosition.y }, velocity: { x: 0, y: 0 } },
        planetLifecycle
    };
}

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
        assert.equal(planetOrbitBoundaryRadius(radius, 18), threshold);
        assert(threshold > radius, 'the shared orbit boundary contains the physical planet radius');
        assert.equal(PLANET_LANDING_SURFACE_GAP, 52);
        assert.equal(threshold - radius, 70, 'the orbit boundary is 70 px beyond the physical planet');
        assert.equal(canLandNearPlanet(threshold,18,radius), true);
        assert.equal(canLandNearPlanet(threshold + 0.01,18,radius), false);
        assert.equal(canLandNearPlanet(radius + 18,18,radius), true);
    }
});

test('the sun retains its configured scale and each orbital band has at least a 50-pixel surface gap', () => {
    assert.equal(PLANET_SIZE_MULTIPLIER, 3);
    assert.deepEqual(planetDefinitions.map(planet => planet.radius), [144, 158.4, 172.8]);
    assert.equal(SUN_RADIUS, 825);
    assert.deepEqual({ x: gameObjectLayout.sun.x, y: gameObjectLayout.sun.y, radius: gameObjectLayout.sun.size / 2 }, { x: 0, y: 0, radius: SUN_RADIUS });
    const bodies = [
        { id: 'sun', x: gameObjectLayout.sun.x, y: gameObjectLayout.sun.y, radius: SUN_RADIUS },
        ...initialGameState.planets.map(planet => ({ id: planet.id, ...planet.position, radius: planet.radius }))
    ];
    for (let index = 0; index < bodies.length; index++) for (const other of bodies.slice(index + 1)) {
        assert(Math.hypot(bodies[index].x - other.x, bodies[index].y - other.y) > bodies[index].radius + other.radius,
            `${bodies[index].id} must not overlap ${other.id}`);
    }
    const ship = { ...gameObjectLayout.ship, radius: 18 };
    for (const body of bodies) assert(Math.hypot(ship.x - body.x, ship.y - body.y) > ship.radius + body.radius,
        `ship must start outside ${body.id}`);
});

test('planet capture includes the boundary, inherits displacement, and retains manual flight control', () => {
    const planet = initialGameState.planets[0];
    const captureRadius = planetLandingRadius(planet.radius, 18);
    const entering = lifecycleState(captureRadius);
    const captured = advanceGameSimulation(entering, { target: null, boostRequested: false, firing: false }, 1);
    assert.equal(captured.planetLifecycle.capturedPlanetId, planet.id);

    const controlled = lifecycleState(100, { capturedPlanetId: planet.id });
    const beforePlanet = controlled.planets.find(candidate => candidate.id === planet.id);
    const followed = advanceGameSimulation(controlled, { target: { x: 10_000, y: controlled.ship.position.y }, boostRequested: false, firing: false }, 100);
    const afterPlanet = followed.planets.find(candidate => candidate.id === planet.id);
    assert(beforePlanet && afterPlanet);
    assert.equal(followed.planetLifecycle.capturedPlanetId, planet.id);
    assert.equal(followed.ship.velocity.y, 0);
    assert(followed.ship.velocity.x > 0, 'the player target continues to control velocity');
    assert.equal(followed.ship.rotation, Math.PI / 2, 'the direct-flight heading is retained from player input');
    assert(Math.abs((followed.ship.position.y - controlled.ship.position.y) - (afterPlanet.position.y - beforePlanet.position.y)) < 1e-8,
        'capture adds the planet tick displacement without replacing direct flight');
    assert.deepEqual(controlled.ship.velocity, { x: 0, y: 0 }, 'simulation leaves its input snapshot immutable');
});

test('capture detaches outside its shared boundary and landing requires captured centre entry at 35 pixels', () => {
    const planet = initialGameState.planets[0];
    const captureRadius = planetLandingRadius(planet.radius, 18);
    const detached = advanceGameSimulation(lifecycleState(captureRadius + 0.01, { capturedPlanetId: planet.id }), {
        target: null, boostRequested: false, firing: false
    }, 1);
    assert.equal(detached.planetLifecycle.capturedPlanetId, null);

    const centre = lifecycleState(LANDING_CENTRE_RADIUS, { capturedPlanetId: planet.id });
    const landed = advanceGameSimulation(centre, { target: null, boostRequested: false, firing: false, landingRequested: true }, 1);
    assert.equal(landed.planetLifecycle.landedPlanetId, planet.id);
    assert.deepEqual(landed.clock.pauseReasons, ['landed']);
    const uncaptured = lifecycleState(LANDING_CENTRE_RADIUS, { capturedPlanetId: null });
    const blocked = tryLandAtCapturedPlanet(uncaptured, true);
    assert.equal(blocked, uncaptured, 'landing intent outside capture must not mutate state');
    assert.equal(blocked.planetLifecycle.landedPlanetId, null);
});

test('launch composes pauses, locks relanding until physical-radius exit, and landed input is inert', () => {
    const planet = initialGameState.planets[0];
    const landed = lifecycleState(0, { capturedPlanetId: planet.id, landedPlanetId: planet.id }, 100);
    const paused = { ...landed, clock: { ...landed.clock, pauseReasons: ['background', 'landed'] } };
    const inert = advanceGameSimulation(paused, {
        target: { x: 10_000, y: 10_000 }, boostRequested: true, firing: true
    }, 1000);
    assert.deepEqual(inert.ship, paused.ship);
    assert.equal(inert.projectiles.length, 0);
    const launched = launchFromPlanet(paused);
    assert.deepEqual(launched.clock.pauseReasons, ['background']);
    assert.deepEqual(launched.planetLifecycle, { capturedPlanetId: planet.id, landedPlanetId: null, relandingLockedPlanetId: planet.id });

    const blocked = advanceGameSimulation({ ...launched, clock: { ...launched.clock, pauseReasons: [] } }, {
        target: null, boostRequested: false, firing: false
    }, 1);
    assert.equal(blocked.planetLifecycle.capturedPlanetId, planet.id, 'launch retains planet transport while relanding is locked');
    assert.equal(blocked.planetLifecycle.relandingLockedPlanetId, planet.id);
    const outside = lifecycleState(planet.radius + 0.01, { capturedPlanetId: planet.id, relandingLockedPlanetId: planet.id });
    const unlocked = advanceGameSimulation(outside, { target: null, boostRequested: false, firing: false }, 1);
    assert.equal(unlocked.planetLifecycle.relandingLockedPlanetId, null);
    assert.equal(unlocked.planetLifecycle.capturedPlanetId, planet.id, 'leaving the physical planet resumes landing availability while capture continues');
    const orbitExit = lifecycleState(planetOrbitBoundaryRadius(planet.radius, 18) + 0.01, { capturedPlanetId: planet.id });
    const detached = advanceGameSimulation(orbitExit, { target: null, boostRequested: false, firing: false }, 1);
    assert.equal(detached.planetLifecycle.capturedPlanetId, null);
});

test('planet definitions project exact counter-clockwise active-time orbits', () => {
    assert.deepEqual(planetDefinitions.map(planet => planet.orbitalPeriodMs), [180_000, 240_000, 300_000]);
    assert.deepEqual(planetDefinitions.map(planet => planet.radius), [144, 158.4, 172.8]);
    assert.deepEqual(planetDefinitions.map(planet => planet.orbitRadius), [1169, 1521.4, 1902.6]);
    assert.deepEqual(planetDefinitions.map(planet => planet.initialPhaseRadians), [0, Math.PI * 2 / 3, Math.PI * 4 / 3]);
    const normalizedAngle = angle => (angle + Math.PI * 2) % (Math.PI * 2);
    for (const definition of planetDefinitions) {
        const initial = projectPlanetPosition(definition.id, 0);
        assert(Math.abs(Math.hypot(initial.x, initial.y) - definition.orbitRadius) < 1e-8);
        assert(Math.abs(normalizedAngle(Math.atan2(-initial.y, initial.x)) - definition.initialPhaseRadians) < 1e-8);
        assert.deepEqual(projectPlanetPosition(definition.id, definition.orbitalPeriodMs), initial);
        const quarter = projectPlanetPosition(definition.id, definition.orbitalPeriodMs / 4);
        const change = normalizedAngle(Math.atan2(-quarter.y, quarter.x) - Math.atan2(-initial.y, initial.x));
        assert(Math.abs(change - Math.PI / 2) < 1e-8, `${definition.id} advances counter-clockwise in world coordinates`);
    }
    const bands = [{ radius: SUN_RADIUS, orbitRadius: 0 }, ...planetDefinitions];
    assert.equal(bands[1].orbitRadius - bands[1].radius - SUN_RADIUS, 200);
    for (let index = 2; index < bands.length; index++) {
        const inner = bands[index - 1];
        const outer = bands[index];
        assert(Math.abs(outer.orbitRadius - outer.radius - (inner.orbitRadius + inner.radius) - 50) < 1e-8);
    }
    const active = advanceGameSimulation(initialGameState, { target: null, boostRequested: false, firing: false }, 12_345);
    assert.deepEqual(active.planets.map(planet => planet.position),
        planetDefinitions.map(planet => projectPlanetPosition(planet.id, active.clock.activeElapsedMs)));
});

test('decorative asteroid belt has a deterministic active-time projection beyond Maslo-Prime', () => {
    const masloPrime = planetDefinitions.find(planet => planet.id === 'maslo-prime');
    assert(masloPrime);
    assert.equal(asteroidBeltDefinition.asteroidRadius, Math.min(...planetDefinitions.map(planet => planet.radius)) / 2);
    assert.equal(asteroidBeltLayout.length, asteroidBeltDefinition.asteroidCount * 2);
    assert.equal(asteroidBeltLayout.filter(asteroid => asteroid.beltIndex === 0).length, asteroidBeltDefinition.asteroidCount);
    assert.equal(asteroidBeltLayout.filter(asteroid => asteroid.beltIndex === 1).length, asteroidBeltDefinition.asteroidCount);
    assert.deepEqual(new Set(asteroidBeltLayout.map(asteroid => asteroid.type)), new Set(['rock', 'ice', 'metal', 'dirt']));
    assert.deepEqual(projectAsteroidBelt(0), projectAsteroidBelt(0));
    for (const asteroid of asteroidBeltLayout) {
        assert(asteroid.radius - asteroidBeltDefinition.asteroidRadius >= masloPrime.orbitRadius + masloPrime.radius + 50);
    }
    const innerBeltOuterRadius = Math.max(...asteroidBeltLayout.filter(asteroid => asteroid.beltIndex === 0).map(asteroid => asteroid.radius));
    const outerBeltInnerRadius = Math.min(...asteroidBeltLayout.filter(asteroid => asteroid.beltIndex === 1).map(asteroid => asteroid.radius));
    assert(outerBeltInnerRadius - asteroidBeltDefinition.asteroidRadius >= innerBeltOuterRadius
        + asteroidBeltDefinition.asteroidRadius + asteroidBeltDefinition.outerBeltGap - asteroidBeltDefinition.outerBeltInset);
    const initial = projectAsteroidBelt(0);
    const quarter = projectAsteroidBelt(asteroidBeltDefinition.rotationPeriodMs / 4);
    assert(Math.abs(initial[0].x - -quarter[0].y) < 1e-8);
    assert(Math.abs(initial[0].y - quarter[0].x) < 1e-8);
    assert.deepEqual(projectAsteroidBelt(asteroidBeltDefinition.rotationPeriodMs), initial);
});

test('sun and starfield presentation phases freeze and resume from active elapsed time', () => {
    const elapsedBeforePause = 12_345;
    const sunBeforePause = activeTimeCycle(0.32, 0.000041, elapsedBeforePause);
    const starBeforePause = activeTimeWave(1.24, 0.0011, elapsedBeforePause);
    assert.equal(activeTimeCycle(0.32, 0.000041, elapsedBeforePause), sunBeforePause);
    assert.equal(activeTimeWave(1.24, 0.0011, elapsedBeforePause), starBeforePause);
    const resumedElapsed = elapsedBeforePause + 500;
    assert.equal(activeTimeCycle(0.32, 0.000041, resumedElapsed), activeTimeCycle(0.32, 0.000041, 12_845));
    assert.equal(activeTimeWave(1.24, 0.0011, resumedElapsed), activeTimeWave(1.24, 0.0011, 12_845));
});

test('fast projectile paths detect crossed Moolaris, tangent hits and endpoints without false hits', () => {
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

test('Moolaris contact forces a finite full-speed escape and suppresses player controls', () => {
    assert.equal(moolarisControlRadius, moolarisDefinition.radius + 18 + MOOLARIS_CONTROL_CLEARANCE);
    const contact = resolveMoolarisContact({ position: { x: 0, y: 0 } });
    assert.equal(contact.hasControl, false);
    assert.deepEqual(contact.forcedVelocity, { x: 240, y: 0 });
    assert(Number.isFinite(contact.forcedVelocity.x) && Number.isFinite(contact.forcedVelocity.y));
    const inside = advanceGameSimulation({
        ...initialGameState,
        ship: { ...initialGameState.ship, position: { x: moolarisControlRadius, y: 0 }, velocity: { x: 0, y: 0 } },
        shipStatus: { ...initialGameState.shipStatus, boosterUnlocked: true }
    }, { target: { x: -10_000, y: 0 }, boostRequested: true, firing: true }, 100);
    assert.deepEqual(inside.ship.velocity, { x: 240, y: 0 });
    assert.equal(inside.ship.boosting, false);
    assert.equal(inside.projectiles.length, 0);
    assert.equal(resolveMoolarisContact({ position: { x: moolarisControlRadius + 0.01, y: 0 } }).hasControl, true);
});

test('Moolaris recovery coasts outward for one second instead of immediately re-entering contact', () => {
    const ship = {
        ...initialGameState.ship,
        position: { x: moolarisControlRadius + 1, y: 0 },
        velocity: { x: 240, y: 0 },
        enginesOn: true
    };
    const target = { x: -10_000, y: 0 };
    assert.equal(isRecoveringFromMoolaris(ship, target), true);
    const recovered = advanceGameSimulation({ ...initialGameState, ship }, { target, boostRequested: true, firing: true }, 100);
    assert(recovered.ship.position.x > ship.position.x, 'recovery continues outward');
    assert.equal(recovered.ship.velocity.x, 216, 'recovery slows over one second');
    assert.equal(recovered.ship.boosting, false);
    assert.equal(recovered.projectiles.length, 0);
    assert.equal(isRecoveringFromMoolaris({ ...ship, position: { x: moolarisControlRadius + 121, y: 0 } }, target), false);
});

test('ships and projectiles pass through planets while Moolaris removes crossing projectiles', () => {
    const planet = initialGameState.planets[0];
    const ship = advanceGameSimulation({
        ...initialGameState,
        ship: { ...initialGameState.ship, position: { x: planet.position.x, y: planet.position.y }, velocity: { x: 0, y: 0 } }
    }, { target: { x: planet.position.x + 10_000, y: planet.position.y }, boostRequested: false, firing: false }, 100);
    assert(ship.ship.position.x > planet.position.x, 'planet contact does not correct ship state');
    const projectile = {
        id: 'planet-crossing', position: { x: planet.position.x - planet.radius - 20, y: planet.position.y }, velocity: { x: 1_000, y: 0 }, bornAtActiveMs: 0
    };
    const throughPlanet = advanceGameSimulation({ ...initialGameState, projectiles: [projectile] }, { target: null, boostRequested: false, firing: false }, 100, {
        obstacles: [{ ...moolarisDefinition.position, radius: moolarisDefinition.radius }]
    });
    assert.equal(throughPlanet.projectiles.length, 1);
    const moolarisCrossing = advanceGameSimulation({
        ...initialGameState,
        projectiles: [{ ...projectile, id: 'moolaris-crossing', position: { x: -900, y: 0 }, velocity: { x: 2_000, y: 0 } }]
    }, { target: null, boostRequested: false, firing: false }, 100, {
        obstacles: [{ ...moolarisDefinition.position, radius: moolarisDefinition.radius }]
    });
    assert.equal(moolarisCrossing.projectiles.length, 0);
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

test('simulation only activates boost after the authoritative booster unlock', () => {
    const input = { target: { x: 10_000, y: 600 }, boostRequested: true, firing: false };
    const locked = advanceGameSimulation(initialGameState, input, 100);
    assert.equal(locked.ship.boosting, false);
    const unlocked = advanceGameSimulation({
        ...initialGameState,
        shipStatus: { ...initialGameState.shipStatus, boosterUnlocked: true }
    }, input, 100);
    assert.equal(unlocked.ship.boosting, true);
});

