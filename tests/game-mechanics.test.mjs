import assert from 'node:assert/strict';
import { test } from 'node:test';
import { boostAccelerationRate, flightVelocity, directionRotation } from '../src/game/mechanics/spaceship/flight.ts';
import { canLandNearPlanet, planetLandingRadius, planetOrbitBoundaryRadius, PLANET_LANDING_SURFACE_GAP } from '../src/game/mechanics/planet/proximity.ts';
import { segmentHitsCircle, shotTrajectory, volleyAngleOffsetsDegrees, volleyAngleStepDegrees } from '../src/game/mechanics/projectile/trajectory.ts';
import { engineNormalSpeedPercentByLevel, weaponProjectileCountByLevel } from '../src/game/domain/runBalance.ts';
import { advanceFireCadence } from '../src/game/mechanics/spaceship/fireCadence.ts';
import { initialGameState } from '../src/game/definitions/initialGameState.ts';
import { advanceGameSimulation } from '../src/game/mechanics/gameSimulation.ts';
import { advancePlanetFacilities } from '../src/game/mechanics/planetFacilitySimulation.ts';
import { gameObjectLayout, PLANET_SIZE_MULTIPLIER, SUN_RADIUS } from '../src/game/scenes/gameObjects.ts';
import { planetDefinitions } from '../src/game/definitions/planetDefinitions.ts';
import { projectPlanetPosition } from '../src/game/mechanics/planet/orbit.ts';
import { MOOLARIS_CONTROL_CLEARANCE, MOOLARIS_RECOVERY_SECONDS, moolarisDefinition } from '../src/game/definitions/moolarisDefinition.ts';
import { isRecoveringFromMoolaris, moolarisControlRadius, resolveMoolarisContact } from '../src/game/mechanics/moolaris/contact.ts';
import { asteroidBeltDefinition } from '../src/game/visual/asteroidBeltDefinition.ts';
import { asteroidBeltLayout, projectAsteroidBelt } from '../src/game/visual/asteroidBelt.ts';
import { createOrbitalPathDashes, ORBITAL_PATH_DASH_LENGTH, ORBITAL_PATH_GAP_LENGTH } from '../src/game/visual/orbitalPaths.ts';
import { activeTimeCycle, activeTimeWave } from '../src/game/visual/activeTime.ts';
import { launchFromPlanet, LANDING_CENTRE_RADIUS, tryLandAtCapturedPlanet } from '../src/game/mechanics/planet/landing.ts';
import { decodeGameState, encodeGameState } from '../src/game/application/gameStateCodec.ts';
import { asteroidFragmentChildCount, asteroidTuning, normalFlightMaxSpeed } from '../src/game/definitions/gameplayTuning.ts';
import { advanceAsteroidMotions, asteroidRadius, fragmentAsteroid } from '../src/game/mechanics/asteroid/asteroidSimulation.ts';
import { teleportShipToPlanet } from '../src/game/mechanics/debug/teleportShipToPlanet.ts';
import { teleportShipToAsteroid } from '../src/game/mechanics/debug/teleportShipToAsteroid.ts';
import { spawnDebugCargo } from '../src/game/mechanics/debug/spawnDebugCargo.ts';
import { asteroidDamageRanges, nextRandomInteger } from '../src/game/mechanics/hazards/damage.ts';
import { resolveTerminalResult } from '../src/game/mechanics/hazards/terminal.ts';
import { spawnAsteroidLoot } from '../src/game/mechanics/salvage/asteroidLoot.ts';
import { createRandomCargoManifest } from '../src/game/mechanics/salvage/cargoManifest.ts';
import { advanceLooseItems, advanceOrbitalCargo } from '../src/game/mechanics/salvage/salvageSimulation.ts';
import { maximumOrbitalCargoTransfer, transferOrbitalCargo } from '../src/game/application/salvageInteractions.ts';
import { collectLooseItem, damageOrbitalCargo, spillOrbitalCargo } from '../src/game/mechanics/salvage/cargoDamage.ts';
import { bindDebugCargoControl } from '../src/ui/components/debugCargoControl.ts';

function assertCargoManifest (manifest)
{
    assert(manifest.length >= 1 && manifest.length <= 3);
    assert.equal(new Set(manifest.map(stack => stack.commodityId)).size, manifest.length, 'cargo commodities are distinct');
    for (const stack of manifest) {
        assert(stack.quantity >= 1 && stack.quantity <= 5, 'each commodity quantity is within the configured range');
        assert.equal(stack.totalCost, 0);
    }
}

test('hazard damage uses inclusive seeded ranges and a terminal run cannot advance', () => {
    for (const [size, range] of Object.entries(asteroidDamageRanges)) {
        const values = new Set();
        for (let seed = 0; seed < 10_000; seed++) {
            const result = nextRandomInteger(seed, range.minimum, range.maximum);
            assert(result.value >= range.minimum && result.value <= range.maximum, size);
            values.add(result.value);
        }
        assert(values.has(range.minimum), `${size} reaches its inclusive minimum`);
        assert(values.has(range.maximum), `${size} reaches its inclusive maximum`);
    }
    const terminal = {
        ...initialGameState,
        clock: { ...initialGameState.clock, activeElapsedMs: 10 },
        shipStatus: { ...initialGameState.shipStatus, currentHitPoints: 0 },
        terminalResult: { runId: initialGameState.runId, outcome: 'death', activeElapsedMs: 10, finalCredits: initialGameState.credits }
    };
    assert.equal(advanceGameSimulation(terminal, { target: null, boostRequested: false, firing: false }, 100), terminal);
});

test('terminal reducer captures fractional active time as canonical integer milliseconds', () => {
    const terminal = resolveTerminalResult({
        ...initialGameState,
        clock: { ...initialGameState.clock, activeElapsedMs: 123.75 },
        shipStatus: { ...initialGameState.shipStatus, currentHitPoints: 0 }
    });
    assert.equal(terminal.terminalResult?.activeElapsedMs, 123);
});

test('Moolaris damages once per entry, re-arms after exit, and terminalizes a low-health return', () => {
    const input = { target: null, boostRequested: false, firing: false };
    const inside = {
        ...initialGameState,
        asteroids: [],
        ship: { ...initialGameState.ship, position: { ...moolarisDefinition.position } },
        shipStatus: { ...initialGameState.shipStatus, currentHitPoints: 30 }
    };
    const firstEntry = advanceGameSimulation(inside, input, 1);
    assert(firstEntry.shipStatus.currentHitPoints >= 5 && firstEntry.shipStatus.currentHitPoints <= 10);
    const heldInside = advanceGameSimulation(firstEntry, input, 1);
    assert.equal(heldInside.shipStatus.currentHitPoints, firstEntry.shipStatus.currentHitPoints);
    const exited = {
        ...heldInside,
        ship: { ...heldInside.ship, position: { x: moolarisControlRadius + 1, y: 0 } }
    };
    const rearmed = advanceGameSimulation(exited, input, 1);
    assert.equal(rearmed.moolarisDamageArmed, true);
    const lethalEntry = advanceGameSimulation({
        ...rearmed,
        ship: { ...rearmed.ship, position: { ...moolarisDefinition.position } },
        shipStatus: { ...rearmed.shipStatus, currentHitPoints: 29 }
    }, input, 1);
    assert.equal(lethalEntry.shipStatus.currentHitPoints, 0);
    assert.deepEqual(lethalEntry.terminalResult, {
        runId: initialGameState.runId,
        outcome: 'death',
        activeElapsedMs: lethalEntry.clock.activeElapsedMs,
        finalCredits: lethalEntry.credits
    });
});

test('debug teleport moves an airborne ship to a current planet centre without retaining flight momentum', () => {
    const target = initialGameState.planets.find(planet => planet.id === 'lactozis-7c');
    assert(target);
    const inFlight = {
        ...initialGameState,
        ship: {
            ...initialGameState.ship,
            velocity: { x: 220, y: -80 },
            enginesOn: true,
            boosting: true,
            boostAcceleration: 120,
            asteroidControlLockedUntilActiveMs: 500
        },
        shipStatus: { ...initialGameState.shipStatus, boosterUnlocked: true },
        planetLifecycle: { capturedPlanetId: 'seroton', landedPlanetId: null, relandingLockedPlanetId: 'seroton' }
    };
    const teleported = teleportShipToPlanet(inFlight, target.id);
    assert.deepEqual(teleported.ship.position, target.position);
    assert.deepEqual(teleported.ship.velocity, { x: 0, y: 0 });
    assert.equal(teleported.ship.enginesOn, false);
    assert.equal(teleported.ship.boosting, false);
    assert.equal(teleported.ship.boostAcceleration, 0);
    assert.equal(teleported.ship.asteroidControlLockedUntilActiveMs, null);
    assert.deepEqual(teleported.planetLifecycle, { capturedPlanetId: null, landedPlanetId: null, relandingLockedPlanetId: 'seroton' });
    assert.deepEqual(inFlight.ship.velocity, { x: 220, y: -80 }, 'teleport leaves its input immutable');
    assert.equal(teleportShipToPlanet(inFlight, 'unknown'), inFlight);
    const landed = { ...inFlight, planetLifecycle: { capturedPlanetId: 'seroton', landedPlanetId: 'seroton', relandingLockedPlanetId: null } };
    assert.equal(teleportShipToPlanet(landed, target.id), landed);
});

test('debug teleport moves an airborne ship to the first live asteroid without retaining flight momentum', () => {
    const target = initialGameState.asteroids[0];
    assert(target);
    const inFlight = {
        ...initialGameState,
        ship: { ...initialGameState.ship, velocity: { x: 220, y: -80 }, enginesOn: true, boosting: true, boostAcceleration: 120, asteroidControlLockedUntilActiveMs: 500 },
        planetLifecycle: { capturedPlanetId: 'seroton', landedPlanetId: null, relandingLockedPlanetId: null }
    };
    const teleported = teleportShipToAsteroid(inFlight);
    assert.deepEqual(teleported.ship.position, target.position);
    assert.deepEqual(teleported.ship.velocity, { x: 0, y: 0 });
    assert.equal(teleported.ship.enginesOn, false);
    assert.equal(teleported.ship.boosting, false);
    assert.equal(teleported.ship.boostAcceleration, 0);
    assert.equal(teleported.ship.asteroidControlLockedUntilActiveMs, null);
    assert.equal(teleported.planetLifecycle.capturedPlanetId, null);
    assert.deepEqual(inFlight.ship.velocity, { x: 220, y: -80 }, 'teleport leaves its input immutable');
    const withoutAsteroids = { ...inFlight, asteroids: [] };
    assert.equal(teleportShipToAsteroid(withoutAsteroids), withoutAsteroids);
});

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

test('configured orbital paths are complete Moolaris-centred 50 px dashes with 10 px gaps', () => {
    const dashes = createOrbitalPathDashes();
    const tolerance = 1e-8;
    for (const definition of planetDefinitions) {
        const path = dashes.filter(dash => dash.radius === definition.orbitRadius);
        assert(path.length > 0, `${definition.id} has an orbital path`);
        for (const dash of path) {
            assert.deepEqual(dash.centre, moolarisDefinition.position);
            assert.equal(dash.radius, definition.orbitRadius);
            const length = (dash.endRadians - dash.startRadians) * dash.radius;
            assert(length <= ORBITAL_PATH_DASH_LENGTH + tolerance);
            assert(length > 0);
        }
        for (let index = 1; index < path.length; index++) {
            const previous = path[index - 1];
            const gap = (path[index].startRadians - previous.endRadians) * definition.orbitRadius;
            assert(Math.abs(gap - ORBITAL_PATH_GAP_LENGTH) < tolerance);
            assert(Math.abs((previous.endRadians - previous.startRadians) * definition.orbitRadius - ORBITAL_PATH_DASH_LENGTH) < tolerance);
        }
        const finalDash = path[path.length - 1];
        assert(Math.abs(finalDash.endRadians * definition.orbitRadius - Math.PI * 2 * definition.orbitRadius) < tolerance,
            `${definition.id} path closes its complete circumference`);
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
    assert.deepEqual(landed.ship.velocity, { x: 0, y: 0 }, 'landing immediately stops the ship');
    assert.equal(landed.ship.enginesOn, false, 'landing immediately silences the engine loop');
    const boosting = { ...centre, ship: { ...centre.ship, boosting: true } };
    assert.equal(tryLandAtCapturedPlanet(boosting, true), boosting, 'a boosted ship must return to normal flight before landing');
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
    assert.equal(initialGameState.asteroids.length, 384);
    for (const [index, asteroid] of initialGameState.asteroids.entries()) {
        const layout = asteroidBeltLayout[index];
        assert.equal(asteroid.id, `asteroid-belt-${index + 1}`);
        assert.equal(asteroid.variant, layout.type);
        assert.equal(asteroid.size, 'big');
        assert.deepEqual(asteroid.orbit, {
            angleRadians: layout.angleRadians,
            radius: layout.radius,
            rotationRadians: layout.rotationRadians
        });
        assert.deepEqual(asteroid.position, { x: initial[index].x, y: initial[index].y });
    }
});

test('asteroid tuning keeps safe-area lifecycle and deterministic fragment counts bounded', () => {
    assert.equal(asteroidTuning.safeRadius, 1_280);
    assert.equal(asteroidTuning.outsideSafeAreaCullAfterMs, 15_000);
    assert.equal(asteroidTuning.fragmentChildCount.minimum, 2);
    assert.equal(asteroidTuning.fragmentChildCount.maximum, 4);
    assert.equal(asteroidTuning.planetCollisionPenetration, 1 / 4);
    assert.deepEqual(asteroidTuning.sizes, {
        big: { radius: 72, hitPoints: 3 },
        medium: { radius: 48, hitPoints: 2 },
        small: { radius: 24, hitPoints: 1 }
    });
    assert.deepEqual(asteroidTuning.shipDamage, {
        small: { minimum: 5, maximum: 10 },
        medium: { minimum: 10, maximum: 20 },
        big: { minimum: 15, maximum: 30 }
    });
    assert.equal(asteroidTuning.fragmentDrift.speed, 180);
    const counts = Array.from({ length: 1_000 }, (_, index) => asteroidFragmentChildCount(`asteroid-parent-${index}`));
    assert(counts.every(count => count >= 2 && count <= 4));
    assert.deepEqual(counts, Array.from({ length: 1_000 }, (_, index) => asteroidFragmentChildCount(`asteroid-parent-${index}`)));
    assert.deepEqual(new Set(counts), new Set([2, 3, 4]));
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

const asteroid = (id, position, size = 'big', extras = {}) => ({
    id, variant: 'rock', size, hitPoints: 1, position, velocity: { x: 0, y: 0 }, orbit: null, outsideSafeAreaSinceActiveMs: null, ...extras
});
const quietInput = { target: null, boostRequested: false, firing: false };

test('asteroids orbit only on active time while fragments drift, reset safe-area time, and cull at both boundaries', () => {
    const orbital = asteroid('orbital', { x: 100, y: 0 }, 'big', {
        orbit: { angleRadians: 0, radius: 100, rotationRadians: 0 }
    });
    const fragment = asteroid('fragment', { x: 100, y: 0 }, 'small', { velocity: { x: 20, y: -10 } });
    const moved = advanceAsteroidMotions([orbital, fragment], 1_000, 1_000, { x: 0, y: 0 });
    assert(Math.abs(moved[0].asteroid.position.x - 100 * Math.cos(Math.PI * 2 / 420)) < 1e-8);
    assert.deepEqual(moved[1].asteroid.position, { x: 120, y: -10 });
    const paused = advanceGameSimulation({ ...initialGameState, asteroids: [orbital, fragment], clock: { ...initialGameState.clock, pauseReasons: ['manual'] } }, quietInput, 10_000);
    assert.deepEqual(paused.asteroids, [orbital, fragment]);
    const outside = asteroid('outside', { x: 2_000, y: 0 }, 'small', { outsideSafeAreaSinceActiveMs: 0 });
    assert.equal(advanceAsteroidMotions([outside], 14_999, 1, { x: 0, y: 0 }).length, 1);
    assert.equal(advanceAsteroidMotions([outside], 15_000, 1, { x: 0, y: 0 }).length, 0);
    const returned = asteroid('returned', { x: 100, y: 0 }, 'small', { outsideSafeAreaSinceActiveMs: 0 });
    assert.equal(advanceAsteroidMotions([returned], 15_000, 1, { x: 0, y: 0 })[0].asteroid.outsideSafeAreaSinceActiveMs, null);
    assert.equal(advanceAsteroidMotions([asteroid('bounds', { x: 10_001, y: 0 })], 1, 1, { x: 0, y: 0 }).length, 0);
});

test('safe-area culling records the boundary crossing and cannot survive a long frame beyond fifteen seconds', () => {
    const crossing = asteroid('crossing', { x: 1_270, y: 0 }, 'small', { velocity: { x: 1_000, y: 0 } });
    const afterCrossing = advanceAsteroidMotions([crossing], 100, 100, { x: 0, y: 0 })[0].asteroid;
    assert.equal(afterCrossing.outsideSafeAreaSinceActiveMs, 10);
    const beforeCull = advanceAsteroidMotions([{ ...afterCrossing, velocity: { x: 0, y: 0 } }], 15_009, 14_909, { x: 0, y: 0 })[0].asteroid;
    assert.equal(beforeCull.outsideSafeAreaSinceActiveMs, 10);
    assert.equal(advanceAsteroidMotions([beforeCull], 15_010, 1, { x: 0, y: 0 }).length, 0);
});

test('asteroid impacts select the earliest stable target without tunnelling and apply deterministic S-07 damage', () => {
    const projectile = { id: 'shot', position: { x: 4_000, y: 0 }, velocity: { x: 20_000, y: 0 }, bornAtActiveMs: 0 };
    const crossed = advanceGameSimulation({ ...initialGameState, projectiles: [projectile], asteroids: [
        asteroid('far', { x: 5_000, y: 0 }), asteroid('near', { x: 4_500, y: 0 })
    ] }, quietInput, 100);
    assert.equal(crossed.projectiles.length, 0, 'a fast shot cannot tunnel through an asteroid');
    assert(!crossed.asteroids.some(candidate => candidate.id === 'near'));
    assert(crossed.asteroids.some(candidate => candidate.id === 'far'));
    const tied = advanceGameSimulation({ ...initialGameState, projectiles: [projectile], asteroids: [
        asteroid('z-target', { x: 4_500, y: 0 }), asteroid('a-target', { x: 4_500, y: 0 })
    ] }, quietInput, 100);
    assert(!tied.asteroids.some(candidate => candidate.id === 'a-target'));
    assert(tied.asteroids.some(candidate => candidate.id === 'z-target'));
    const shipState = advanceGameSimulation({ ...initialGameState, asteroids: [asteroid('ship-hit', { x: 5_000, y: 0 })], ship: {
        ...initialGameState.ship, position: { x: 5_000, y: 0 }
    } }, quietInput, 1);
    assert(shipState.shipStatus.currentHitPoints >= 70 && shipState.shipStatus.currentHitPoints <= 85);
    assert.equal(shipState.ship.asteroidImpactAtActiveMs, 1, 'every committed ship impact records an exact presentation event');
    assert.equal(Math.hypot(shipState.ship.velocity.x, shipState.ship.velocity.y), 240, 'every asteroid impact repels the ship at the sun escape speed');
    assert.equal(shipState.ship.asteroidControlLockedUntilActiveMs, 501, 'every asteroid impact applies a half-length sun-style recovery lock');
    assert(shipState.asteroids.some(candidate => candidate.id.startsWith('ship-hit-fragment-')));
    const planet = initialGameState.planets[0];
    const planetState = advanceGameSimulation({ ...initialGameState, asteroids: [asteroid('planet-hit', planet.position)] }, quietInput, 1);
    assert(planetState.asteroids.some(candidate => candidate.id.startsWith('planet-hit-fragment-')));
    const moolarisState = advanceGameSimulation({ ...initialGameState, asteroids: [asteroid('moolaris-hit', { x: 0, y: 0 })] }, quietInput, 1);
    assert.equal(moolarisState.asteroids.length, 0);
});

test('projectile blockers share ordered swept candidates with asteroid targets and new shots wait one active frame', () => {
    const projectile = { id: 'blocked-shot', position: { x: 4_000, y: 0 }, velocity: { x: 20_000, y: 0 }, bornAtActiveMs: 0 };
    const legacyBlocked = advanceGameSimulation({ ...initialGameState, projectiles: [projectile], asteroids: [asteroid('behind-legacy', { x: 5_000, y: 0 })] }, quietInput, 100, {
        obstacles: [{ x: 4_500, y: 0, radius: 50 }]
    });
    assert.equal(legacyBlocked.projectiles.length, 0);
    assert(legacyBlocked.asteroids.some(candidate => candidate.id === 'behind-legacy'));
    const moolarisBlocked = advanceGameSimulation({ ...initialGameState, ship: { ...initialGameState.ship, position: { x: 3_000, y: -3_000 } }, projectiles: [{ ...projectile, id: 'sun-blocked', position: { x: -2_000, y: 0 }, velocity: { x: 60_000, y: 0 } }], asteroids: [asteroid('behind-sun', { x: 3_000, y: 0 })] }, quietInput, 100);
    assert(moolarisBlocked.asteroids.some(candidate => candidate.id === 'behind-sun'));
    const firingState = { ...initialGameState, ship: { ...initialGameState.ship, position: { x: 4_000, y: 0 }, rotation: Math.PI / 2 }, asteroids: [asteroid('new-shot-target', { x: 4_100, y: 0 })] };
    const fired = advanceGameSimulation(firingState, { ...quietInput, firing: true }, 200);
    assert(fired.asteroids.some(candidate => candidate.id === 'new-shot-target'));
    assert.equal(fired.projectiles.length, 1);
    assert(!advanceGameSimulation(fired, quietInput, 200).asteroids.some(candidate => candidate.id === 'new-shot-target'));
});

test('fragmentation follows the size hierarchy and remains identical through serialization restore', () => {
    const projectile = { id: 'shot', position: { x: 4_000, y: 0 }, velocity: { x: 20_000, y: 0 }, bornAtActiveMs: 0 };
    const impact = (size) => advanceGameSimulation({ ...initialGameState, projectiles: [projectile], asteroids: [asteroid(`${size}-parent`, { x: 4_500, y: 0 }, size)] }, quietInput, 100);
    const big = impact('big');
    assert(big.asteroids.every(candidate => candidate.size === 'medium'));
    const medium = impact('medium');
    assert(medium.asteroids.every(candidate => candidate.size === 'small'));
    assert.equal(impact('small').asteroids.length, 0);
    const split = fragmentAsteroid(asteroid('noisy-parent', { x: 0, y: 0 }), { id: 'shot', kind: 'projectile', position: { x: -100, y: 0 } });
    const angles = split.map(child => Math.atan2(child.velocity.y, child.velocity.x)).sort((left, right) => left - right);
    const gaps = angles.map((angle, index) => (angles[(index + 1) % angles.length] + (index + 1 === angles.length ? Math.PI * 2 : 0)) - angle);
    assert(gaps.some(gap => Math.abs(gap - Math.PI * 2 / split.length) > 0.001), 'fragment directions must use an uneven split pattern');
    assert.deepEqual(fragmentAsteroid(asteroid('noisy-parent', { x: 0, y: 0 }), { id: 'shot', kind: 'projectile', position: { x: -100, y: 0 } }), split);
    assert.notDeepEqual(fragmentAsteroid(asteroid('noisy-parent', { x: 0, y: 0 }), { id: 'other-shot', kind: 'projectile', position: { x: -100, y: 0 } }).map(child => child.velocity), split.map(child => child.velocity), 'each impact rotates its chosen split pattern independently');
    const state = { ...initialGameState, projectiles: [projectile], asteroids: [asteroid('restore-parent', { x: 4_500, y: 0 })] };
    const partial = advanceGameSimulation(state, quietInput, 100);
    const uninterrupted = advanceGameSimulation(partial, quietInput, 100);
    const restored = decodeGameState(encodeGameState(partial));
    assert.deepEqual(advanceGameSimulation(restored, quietInput, 100), uninterrupted);
    assert.equal(asteroidRadius('big'), 72);
});

test('asteroid durability persists through shots, resets for fragments, and collision rules do not damage it', () => {
    const shot = { id: 'durability-shot', position: { x: 4_000, y: 0 }, velocity: { x: 20_000, y: 0 }, bornAtActiveMs: 0 };
    const fire = (target) => advanceGameSimulation({ ...initialGameState, projectiles: [shot], asteroids: [target] }, quietInput, 100);
    const big = asteroid('durable-big', { x: 4_500, y: 0 }, 'big', { hitPoints: 3 });
    const first = fire(big);
    assert.equal(first.asteroids[0].hitPoints, 2);
    const second = fire(first.asteroids[0]);
    assert.equal(second.asteroids[0].hitPoints, 1);
    const third = fire(second.asteroids[0]);
    assert(third.asteroids.every(candidate => candidate.size === 'medium' && candidate.hitPoints === 2));
    const medium = fire(asteroid('durable-medium', { x: 4_500, y: 0 }, 'medium', { hitPoints: 2 }));
    assert.equal(medium.asteroids[0].hitPoints, 1);
    assert(fire(medium.asteroids[0]).asteroids.every(candidate => candidate.size === 'small' && candidate.hitPoints === 1));

    const planet = initialGameState.planets[0];
    const planetImpact = advanceGameSimulation({ ...initialGameState, asteroids: [asteroid('planet-depth', {
        x: planet.position.x + planet.radius - 25, y: planet.position.y
    }, 'big', { hitPoints: 3 })] }, quietInput, 1);
    assert(planetImpact.asteroids.every(candidate => candidate.size === 'medium' && candidate.hitPoints === 2));
    const surfaceSkim = advanceGameSimulation({ ...initialGameState, asteroids: [asteroid('planet-skim', {
        x: planet.position.x + planet.radius - 15, y: planet.position.y
    }, 'big', { hitPoints: 3 })] }, quietInput, 1);
    assert(surfaceSkim.asteroids.some(candidate => candidate.id === 'planet-skim' && candidate.size === 'big'), 'the asteroid must penetrate half its radius before a planet impact');

    const ingested = advanceGameSimulation({ ...initialGameState, asteroids: [asteroid('star-inbound', { x: 890, y: 0 }, 'big', { hitPoints: 3 })] }, quietInput, 1);
    assert.equal(ingested.asteroids[0].hitPoints, 3);
    assert(ingested.asteroids[0].velocity.x < 0);
    const culled = advanceGameSimulation({ ...initialGameState, asteroids: [asteroid('star-core', { x: 400, y: 0 }, 'big', { hitPoints: 3 })] }, quietInput, 1);
    assert.equal(culled.asteroids.length, 0);

    const boosted = advanceGameSimulation({ ...initialGameState, asteroids: [asteroid('boost-impact', { x: 4_000, y: 0 }, 'big', { hitPoints: 3 })], ship: {
        ...initialGameState.ship, position: { x: 4_000, y: 0 }
    }, shipStatus: { ...initialGameState.shipStatus, boosterUnlocked: true } }, {
        target: { x: 5_000, y: 0 }, boostRequested: true, firing: false
    }, 1);
    assert.equal(boosted.ship.boosting, false);
    assert.equal(Math.hypot(boosted.ship.velocity.x, boosted.ship.velocity.y), 240);
    assert.equal(boosted.ship.asteroidImpactAtActiveMs, 1, 'boosted impacts share the same exact crash-feedback event');
    assert.equal(boosted.ship.asteroidControlLockedUntilActiveMs, 501);
});

const emptySpace = (shipStatus, ship = {}) => ({
    ...initialGameState,
    asteroids: [],
    planets: [],
    ship: { ...initialGameState.ship, position: { x: 20_000, y: 20_000 }, velocity: { x: 0, y: 0 }, ...ship },
    shipStatus: { ...initialGameState.shipStatus, ...shipStatus }
});

const distantTarget = { x: 20_000 + 400_000, y: 20_000 };

test('normal flight takes its cruise speed and acceleration basis from the engine level', () => {
    assert.equal(normalFlightMaxSpeed(1), 240);
    assert.equal(normalFlightMaxSpeed(2), 264);
    assert.equal(normalFlightMaxSpeed(5), 360);
    assert.equal(normalFlightMaxSpeed(9), 240, 'a level outside the catalogue falls back to the level-one basis');

    for (const engineLevel of [1, 2, 3, 4, 5]) {
        const expected = 240 * engineNormalSpeedPercentByLevel[engineLevel] / 100;
        let state = emptySpace({ engineLevel });
        const input = { target: distantTarget, boostRequested: false, firing: false };
        for (let tick = 0; tick < 5; tick++) state = advanceGameSimulation(state, input, 100);
        assert(Math.abs(Math.hypot(state.ship.velocity.x, state.ship.velocity.y) - expected / 2) < 1e-9,
            `engine level ${engineLevel} accelerates on its own basis`);
        for (let tick = 0; tick < 5; tick++) state = advanceGameSimulation(state, input, 100);
        assert(Math.abs(Math.hypot(state.ship.velocity.x, state.ship.velocity.y) - expected) < 1e-9,
            `engine level ${engineLevel} reaches its configured cruise speed after one second`);
        assert.equal(state.ship.rotation, Math.PI / 2);
    }

    let idle = emptySpace({ engineLevel: 5 });
    for (let tick = 0; tick < 20; tick++) idle = advanceGameSimulation(idle, { target: distantTarget, boostRequested: false, firing: false }, 100);
    let stopping = idle;
    for (let tick = 0; tick < 6; tick++) stopping = advanceGameSimulation(stopping, quietInput, 100);
    assert(Math.abs(stopping.ship.velocity.x) < 1e-9, 'an upgraded ship still stops in half a second');
});

test('recovery, asteroid impact, Moolaris pushback and boost keep the level-one speed basis', () => {
    const boosted = level => emptySpace({ engineLevel: level, boosterUnlocked: true });
    for (const engineLevel of [1, 5]) {
        let state = boosted(engineLevel);
        const input = { target: distantTarget, boostRequested: true, firing: false };
        for (let tick = 0; tick < 40; tick++) state = advanceGameSimulation(state, input, 100);
        assert.equal(state.ship.boosting, true, `engine level ${engineLevel} can still boost`);
        assert(Math.abs(Math.hypot(state.ship.velocity.x, state.ship.velocity.y) - 1200) < 1e-9,
            `engine level ${engineLevel} boosts at the fixed level-one 5x speed`);
    }
    assert.equal(boostAccelerationRate(0, 240, 5, 1), 1200, 'boost ramps toward the fixed level-one 5x speed');
    assert.notEqual(boostAccelerationRate(0, 240, 5, 1), normalFlightMaxSpeed(5) * 5, 'boost never uses the upgraded cruise speed as its basis');

    const impact = level => advanceGameSimulation({
        ...initialGameState,
        asteroids: [asteroid('basis-impact', { x: 5_000, y: 0 })],
        ship: { ...initialGameState.ship, position: { x: 5_000, y: 0 } },
        shipStatus: { ...initialGameState.shipStatus, engineLevel: level }
    }, quietInput, 1);
    for (const level of [1, 5]) {
        const impacted = impact(level);
        assert.equal(Math.hypot(impacted.ship.velocity.x, impacted.ship.velocity.y), 240, `engine level ${level} impact pushback`);
        assert.equal(impacted.ship.asteroidControlLockedUntilActiveMs, 501, `engine level ${level} impact recovery lock`);
    }

    const inContact = level => advanceGameSimulation({
        ...initialGameState,
        asteroids: [],
        ship: { ...initialGameState.ship, position: { x: moolarisControlRadius, y: 0 }, velocity: { x: 0, y: 0 } },
        shipStatus: { ...initialGameState.shipStatus, engineLevel: level, boosterUnlocked: true }
    }, { target: { x: -10_000, y: 0 }, boostRequested: true, firing: true }, 100);
    for (const level of [1, 5]) {
        assert.deepEqual(inContact(level).ship.velocity, { x: 240, y: 0 }, `engine level ${level} Moolaris escape`);
    }

    const recovering = level => advanceGameSimulation({
        ...initialGameState,
        asteroids: [],
        ship: { ...initialGameState.ship, position: { x: moolarisControlRadius + 1, y: 0 }, velocity: { x: 240, y: 0 }, enginesOn: true },
        shipStatus: { ...initialGameState.shipStatus, engineLevel: level }
    }, { target: { x: -10_000, y: 0 }, boostRequested: false, firing: false }, 100);
    for (const level of [1, 5]) {
        assert.equal(recovering(level).ship.velocity.x, 216, `engine level ${level} recovery coast uses the level-one deceleration basis`);
    }
});

test('every weapon level fires its configured symmetric volley with deterministic angles and identity', () => {
    assert.deepEqual(volleyAngleOffsetsDegrees(0), []);
    assert.deepEqual(volleyAngleOffsetsDegrees(1), [0]);
    assert.deepEqual(volleyAngleOffsetsDegrees(2), [-2.5, 2.5]);
    assert.deepEqual(volleyAngleOffsetsDegrees(3), [-5, 0, 5]);
    assert.deepEqual(volleyAngleOffsetsDegrees(4), [-7.5, -2.5, 2.5, 7.5]);
    assert.deepEqual(volleyAngleOffsetsDegrees(5), [-10, -5, 0, 5, 10]);
    assert.deepEqual(volleyAngleOffsetsDegrees(6), [-12.5, -7.5, -2.5, 2.5, 7.5, 12.5]);
    assert.deepEqual(volleyAngleOffsetsDegrees(10), [-22.5, -17.5, -12.5, -7.5, -2.5, 2.5, 7.5, 12.5, 17.5, 22.5]);

    // Every neighbouring pair, frontmost included, sits one uniform step apart in both parities.
    for (let projectileCount = 1; projectileCount <= 10; projectileCount++) {
        const offsets = volleyAngleOffsetsDegrees(projectileCount);
        for (let index = 1; index < offsets.length; index++) {
            assert.equal(offsets[index] - offsets[index - 1], volleyAngleStepDegrees,
                `${projectileCount} projectiles keep a uniform gap at index ${index}`);
        }
        assert(Math.abs(offsets.reduce((total, offset) => total + offset, 0)) < 1e-9, `${projectileCount} projectiles stay centred on the heading`);
        assert.equal(offsets.length, projectileCount);
        if (projectileCount % 2 === 1) assert(offsets.includes(0), `${projectileCount} projectiles fire one shot straight ahead`);
        else assert(!offsets.includes(0), `${projectileCount} projectiles straddle the heading`);
    }

    for (const weaponLevel of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
        const fired = advanceGameSimulation(emptySpace({ weaponLevel }, { rotation: 0 }), { target: null, boostRequested: false, firing: true }, 1);
        assert.equal(fired.weapon.projectileSequence, 1, `weapon level ${weaponLevel} counts one beat as one volley`);
        assert.equal(fired.projectiles.length, weaponProjectileCountByLevel[weaponLevel]);
        assert.equal(fired.projectiles.length, weaponLevel);
        assert.deepEqual(fired.projectiles.map(projectile => projectile.id),
            Array.from({ length: weaponLevel }, (_, index) => `projectile-1-${index + 1}`));
        const offsets = fired.projectiles.map(projectile => Math.atan2(projectile.velocity.x, -projectile.velocity.y) * 180 / Math.PI);
        const expected = volleyAngleOffsetsDegrees(weaponLevel);
        for (let index = 0; index < weaponLevel; index++) {
            assert(Math.abs(offsets[index] - expected[index]) < 1e-9, `weapon level ${weaponLevel} shot ${index + 1} flies at ${expected[index]} degrees`);
            assert(Math.abs(Math.hypot(fired.projectiles[index].velocity.x, fired.projectiles[index].velocity.y) - 400) < 1e-9,
                `weapon level ${weaponLevel} shot ${index + 1} keeps the configured projectile speed`);
            assert(Math.abs(Math.hypot(fired.projectiles[index].position.x - 20_000, fired.projectiles[index].position.y - 20_000) - 32) < 1e-9,
                `weapon level ${weaponLevel} shot ${index + 1} keeps the nose muzzle offset`);
        }
        assert.deepEqual([...offsets].sort((left, right) => left - right), offsets, `weapon level ${weaponLevel} lists its shots left to right`);
    }
});

test('consecutive volleys increment the sequence once and keep projectile identity stable through restore', () => {
    let state = { ...emptySpace({ weaponLevel: 4 }, { rotation: 0 }), planets: initialGameState.planets };
    const input = { target: null, boostRequested: false, firing: true };
    state = advanceGameSimulation(state, input, 1);
    assert.deepEqual(state.projectiles.map(projectile => projectile.id),
        ['projectile-1-1', 'projectile-1-2', 'projectile-1-3', 'projectile-1-4']);

    state = advanceGameSimulation(state, input, 400);
    assert.equal(state.weapon.projectileSequence, 2);
    assert.deepEqual(state.projectiles.map(projectile => projectile.id),
        ['projectile-1-1', 'projectile-1-2', 'projectile-1-3', 'projectile-1-4', 'projectile-2-1', 'projectile-2-2', 'projectile-2-3', 'projectile-2-4']);
    assert.equal(new Set(state.projectiles.map(projectile => projectile.id)).size, 8);

    const restored = decodeGameState(encodeGameState(state));
    assert.deepEqual(restored.projectiles, state.projectiles);
    assert.deepEqual(advanceGameSimulation(restored, input, 400).projectiles.map(projectile => projectile.id),
        advanceGameSimulation(state, input, 400).projectiles.map(projectile => projectile.id),
        'a restored run keeps counting volleys and projectile indices');
});

test('small asteroid loot guarantees cargo only for a cargo schedule marker and preserves loose-item probability in zero slots', () => {
    const target = asteroid('salvage-roll', { x: 2_000, y: 0 }, 'small');
    const looseOutcomes = new Map();
    for (let seed = 0; seed < 100; seed++) {
        const result = spawnAsteroidLoot(target, 123, seed, false);
        const kind = result.orbitalCargo ? 'cargo' : result.looseItem ? 'loose' : 'none';
        if (!looseOutcomes.has(kind)) looseOutcomes.set(kind, { seed, result });
        assert.equal(result.looseItem !== null, nextRandomInteger(seed, 0, 99).value < 10, 'zero schedule slots retain the configured 10% loose roll');
    }
    assert.deepEqual([...looseOutcomes.keys()].sort(), ['loose', 'none']);
    const cargoResult = spawnAsteroidLoot(target, 123, 1, true);
    const cargo = cargoResult.orbitalCargo;
    assert(cargo);
    const advancedCargo = advanceOrbitalCargo([cargo], 123)[0];
    assert(Math.abs(advancedCargo.position.x - target.position.x) < 1e-9, 'the first orbital update retains the kill x coordinate');
    assert(Math.abs(advancedCargo.position.y - target.position.y) < 1e-9, 'the first orbital update retains the kill y coordinate');
    assertCargoManifest(cargo.manifest);
    assert.deepEqual(spawnAsteroidLoot(target, 123, 1, true), cargoResult, 'a fixed seed replays exactly');
});

test('cargo manifests select one, two, or three distinct commodities at the configured seeded odds', () => {
    for (const stackCount of [1, 2, 3]) {
        const seed = Array.from({ length: 100 }, (_, candidate) => candidate).find(candidate => createRandomCargoManifest(candidate).manifest.length === stackCount);
        assert.notEqual(seed, undefined, `a seed produces a ${stackCount}-commodity manifest`);
        const result = createRandomCargoManifest(seed);
        assert.equal(result.manifest.length, stackCount);
        assertCargoManifest(result.manifest);
        assert.deepEqual(createRandomCargoManifest(seed), result, 'the persisted RNG makes manifests replay deterministic');
    }
});

test('loose asteroid loot uses the tuned 126 ejection speed while retaining active-time sun blending', () => {
    const target = asteroid('loose-speed', { x: 2_000, y: 0 }, 'small', { velocity: { x: 3, y: 4 } });
    const seed = Array.from({ length: 100 }, (_, candidate) => candidate).find(candidate => nextRandomInteger(candidate, 0, 99).value < 10);
    if (seed === undefined) throw new Error('Expected a deterministic loose-item seed.');
    const loot = spawnAsteroidLoot(target, 100, seed, false);
    assert(loot.looseItem);
    assert(Math.abs(Math.hypot(loot.looseItem.motion.ejectionVelocity.x, loot.looseItem.motion.ejectionVelocity.y) - 126) < 1e-8);
    assert(Math.abs(loot.looseItem.motion.sunVelocity.x + 240) < 1e-8);
    assert(Math.abs(loot.looseItem.motion.sunVelocity.y) < 1e-8);
    assert.equal(loot.looseItem.motion.createdAtActiveMs, 100);
});

test('small-asteroid projectile kills consume deterministic cargo schedules without advancing them for ineligible removals', () => {
    const projectile = { id: 'schedule-shot', position: { x: 4_000, y: 0 }, velocity: { x: 20_000, y: 0 }, bornAtActiveMs: 0 };
    const kill = (state, id, size = 'small') => advanceGameSimulation({
        ...state,
        projectiles: [{ ...projectile, id: `${id}-shot` }],
        asteroids: [asteroid(id, { x: 4_500, y: 0 }, size)]
    }, quietInput, 100);
    let state = { ...initialGameState, cargoSchedule: [], randomState: 77 };
    for (let index = 0; index < 5; index++) state = kill(state, `eligible-${index}`);
    assert.equal(state.orbitalCargo.length, 1, 'one cargo marker produces exactly one cargo in five eligible kills');
    assert.deepEqual(state.cargoSchedule, [], 'the fifth eligible kill exhausts the cycle');
    const nextCycle = kill(state, 'next-cycle');
    assert.equal(nextCycle.cargoSchedule.length, 4, 'the next eligible kill seeds and consumes a fresh cycle');

    let replay = { ...initialGameState, cargoSchedule: [], randomState: 77 };
    for (let index = 0; index < 6; index++) replay = kill(replay, `eligible-${index}`);
    assert.deepEqual(replay.cargoSchedule, nextCycle.cargoSchedule, 'the lazily selected marker replays across cycle boundaries');
    assert.equal(replay.randomState, nextCycle.randomState);
    assert.deepEqual(replay.orbitalCargo.map(cargo => ({ orbit: cargo.orbit, hitPoints: cargo.hitPoints, manifest: cargo.manifest })), nextCycle.orbitalCargo.map(cargo => ({ orbit: cargo.orbit, hitPoints: cargo.hitPoints, manifest: cargo.manifest })));
    assert.deepEqual(replay.looseItems, nextCycle.looseItems);

    const nonSmall = kill({ ...initialGameState, cargoSchedule: [1, 0, 0] }, 'medium-hit', 'medium');
    assert.deepEqual(nonSmall.cargoSchedule, [1, 0, 0]);
    const planet = initialGameState.planets[0];
    const nonProjectile = advanceGameSimulation({
        ...initialGameState,
        cargoSchedule: [1, 0, 0],
        asteroids: [asteroid('planet-removal', planet.position, 'small')]
    }, quietInput, 1);
    assert.deepEqual(nonProjectile.cargoSchedule, [1, 0, 0]);
});

test('salvage lifecycle advances only active time, cargo takes two projectile-only hits, and loose items blend toward the sun', () => {
    const cargo = { id: 'cargo-1', position: { x: 2_000, y: 0 }, orbit: { angleRadians: 0, radius: 2_000, rotationRadians: 0 }, hitPoints: 2, manifest: [{ commodityId: 'milk', quantity: 2, totalCost: 0 }] };
    const item = { id: 'item-1', position: { x: 2_000, y: 0 }, motion: { ejectionVelocity: { x: 180, y: 0 }, sunVelocity: { x: -240, y: 0 }, createdAtActiveMs: 0 }, container: { commodityId: 'milk', quantity: 1, totalCost: 0 } };
    const paused = advanceGameSimulation({ ...initialGameState, orbitalCargo: [cargo], looseItems: [item], clock: { ...initialGameState.clock, pauseReasons: ['manual'] } }, quietInput, 10_000);
    assert.deepEqual(paused.orbitalCargo, [cargo]);
    assert.deepEqual(paused.looseItems, [item]);
    assert.notDeepEqual(advanceOrbitalCargo([cargo], 10_000)[0].position, cargo.position);
    assert(advanceLooseItems([item], 10_000, 1_000)[0].position.x < item.position.x, 'the ten-second blend ends sun-directed');
    const first = damageOrbitalCargo({ ...initialGameState, orbitalCargo: [cargo] }, cargo.id);
    assert.equal(first.orbitalCargo[0].hitPoints, 1);
    const second = damageOrbitalCargo(first, cargo.id);
    assert.equal(second.orbitalCargo.length, 0);
    assert.equal(second.looseItems.length, 2);
});

test('debug cargo intent creates one normal deterministic state-backed container 100 pixels ahead of the ship', () => {
    const state = {
        ...initialGameState,
        randomState: 123,
        clock: { ...initialGameState.clock, activeElapsedMs: 8_000 },
        ship: { ...initialGameState.ship, position: { x: 2_000, y: 3_000 }, rotation: Math.PI / 2 }
    };
    const spawned = spawnDebugCargo(state);
    assert.equal(spawned.orbitalCargo.length, 1);
    const [cargo] = spawned.orbitalCargo;
    assert.deepEqual(cargo.position, { x: 2_100, y: 3_000 });
    assert.equal(Math.hypot(cargo.position.x - state.ship.position.x, cargo.position.y - state.ship.position.y), 100);
    assert.equal(cargo.orbit.radius, Math.hypot(2_100, 3_000));
    assert.equal(cargo.hitPoints, asteroidTuning.salvage.cargoHitPoints);
    assertCargoManifest(cargo.manifest);
    assert.notEqual(spawned.randomState, state.randomState);
    assert.deepEqual(spawnDebugCargo(state), spawned, 'the persisted RNG makes debug cargo replay deterministic');
    assert.deepEqual(advanceOrbitalCargo(spawned.orbitalCargo, state.clock.activeElapsedMs)[0].position, cargo.position, 'the first orbital update preserves the spawn position');
    assert.deepEqual(state.orbitalCargo, [], 'the reducer does not mutate the prior snapshot');
});

test('debug cargo control emits its scene intent only while the run can accept it', () => {
    let click = null;
    const emitted = [];
    let closed = 0;
    let allowed = true;
    const button = {
        textContent: null,
        addEventListener: (_type, listener) => { click = listener; },
        removeEventListener: (_type, listener) => { if (click === listener) click = null; }
    };
    const destroy = bindDebugCargoControl(button, { emit: event => emitted.push(event) }, 'Spawn cargo', () => allowed, () => { closed++; });
    assert.equal(button.textContent, 'Spawn cargo');
    click();
    assert.deepEqual(emitted, ['debug-spawn-cargo']);
    assert.equal(closed, 1);
    allowed = false;
    click();
    assert.deepEqual(emitted, ['debug-spawn-cargo']);
    destroy();
    assert.equal(click, null);
});

test('salvage intents preserve full ships and only transfer explicit holders', () => {
    const item = { id: 'item-full', position: { x: 9_000, y: 0 }, motion: { ejectionVelocity: { x: 0, y: 0 }, sunVelocity: { x: -1, y: 0 }, createdAtActiveMs: 0 }, container: { commodityId: 'grain', quantity: 1, totalCost: 0 } };
    const full = { ...initialGameState, cargo: [{ commodityId: 'milk', quantity: 40, totalCost: 1_000 }], looseItems: [item] };
    const pickup = collectLooseItem(full, item.id);
    assert.equal(pickup, full);
    const cargo = { id: 'cargo-transfer', position: { x: 2_000, y: 0 }, orbit: { angleRadians: 0, radius: 2_000, rotationRadians: 0 }, hitPoints: 2, manifest: [{ commodityId: 'grain', quantity: 2, totalCost: 8 }] };
    const transferred = transferOrbitalCargo({ ...initialGameState, orbitalCargo: [cargo] }, cargo.id, 'grain', 1, 'to-ship');
    assert.equal(transferred.failure, null);
    assert.deepEqual(transferred.state.cargo, [{ commodityId: 'grain', quantity: 1, totalCost: 4 }]);
    assert.equal(transferred.state.orbitalCargo[0].manifest[0].quantity, 1);
});

test('loose-item pickup uses the configured 30-unit interaction radius after a ship impact', () => {
    const itemAt = x => ({ id: `item-${x}`, position: { x, y: 0 }, motion: { ejectionVelocity: { x: 0, y: 0 }, sunVelocity: { x: -1, y: 0 }, createdAtActiveMs: 0 }, container: { commodityId: 'grain', quantity: 1, totalCost: 0 } });
    const impactState = item => ({ ...initialGameState, ship: { ...initialGameState.ship, position: { x: 4_000, y: 0 } }, asteroids: [asteroid('pickup-impact', { x: 4_000, y: 0 })], looseItems: [item] });
    const atBoundary = advanceGameSimulation(impactState(itemAt(4_030)), quietInput, 1);
    assert.equal(atBoundary.looseItems.length, 0, 'an item at the pickup boundary is collected');
    const outsideBoundary = advanceGameSimulation(impactState(itemAt(4_030.01)), quietInput, 1);
    assert.equal(outsideBoundary.looseItems.length, 1, 'an item beyond the pickup boundary remains loose');
});

test('orbital cargo transfers exact one and max quantities atomically within both capacity limits', () => {
    const cargo = (id, stacks) => ({ id, position: { x: 2_000, y: 0 }, orbit: { angleRadians: 0, radius: 2_000, rotationRadians: 0 }, hitPoints: 2, manifest: stacks });
    const source = { ...initialGameState, orbitalCargo: [cargo('cargo-1', [{ commodityId: 'grain', quantity: 2, totalCost: 8 }])] };

    const one = transferOrbitalCargo(source, 'cargo-1', 'grain', 1, 'to-ship');
    assert.equal(one.failure, null);
    assert.deepEqual(one.state.cargo, [{ commodityId: 'grain', quantity: 1, totalCost: 4 }]);
    assert.deepEqual(one.state.orbitalCargo[0].manifest, [{ commodityId: 'grain', quantity: 1, totalCost: 4 }]);
    assert.deepEqual(source.orbitalCargo[0].manifest, [{ commodityId: 'grain', quantity: 2, totalCost: 8 }], 'the reducer never mutates its input');

    assert.equal(maximumOrbitalCargoTransfer(source, 'cargo-1', 'grain', 'to-ship'), 2);
    const max = transferOrbitalCargo(source, 'cargo-1', 'grain', 2, 'to-ship');
    assert.equal(max.failure, null);
    assert.deepEqual(max.state.cargo, [{ commodityId: 'grain', quantity: 2, totalCost: 8 }]);
    assert.equal(max.state.orbitalCargo.length, 0, 'an emptied manifest removes the orbital cargo');

    const shipBoundary = { ...initialGameState, cargo: [{ commodityId: 'milk', quantity: 38, totalCost: 0 }], orbitalCargo: [cargo('cargo-b', [{ commodityId: 'milk', quantity: 5, totalCost: 0 }])] };
    assert.equal(maximumOrbitalCargoTransfer(shipBoundary, 'cargo-b', 'milk', 'to-ship'), 2);
    assert.equal(transferOrbitalCargo(shipBoundary, 'cargo-b', 'milk', 3, 'to-ship').failure, 'ship-cargo-full');
    assert.equal(transferOrbitalCargo(shipBoundary, 'cargo-b', 'milk', 2, 'to-ship').failure, null);

    const orbitBoundary = { ...initialGameState, cargo: [{ commodityId: 'cheese', quantity: 10, totalCost: 0 }], orbitalCargo: [cargo('cargo-c', [{ commodityId: 'cheese', quantity: 15, totalCost: 0 }])] };
    assert.equal(maximumOrbitalCargoTransfer(orbitBoundary, 'cargo-c', 'cheese', 'to-orbit'), 5);
    assert.equal(transferOrbitalCargo(orbitBoundary, 'cargo-c', 'cheese', 6, 'to-orbit').failure, 'orbit-cargo-full');
    assert.equal(transferOrbitalCargo(orbitBoundary, 'cargo-c', 'cheese', 5, 'to-orbit').failure, null);

    assert.equal(transferOrbitalCargo(source, 'missing', 'grain', 1, 'to-ship').failure, 'missing-cargo');
    assert.equal(transferOrbitalCargo(source, 'cargo-1', 'milk', 1, 'to-ship').failure, 'missing-commodity');
    assert.equal(transferOrbitalCargo(source, 'cargo-1', 'grain', 0, 'to-ship').failure, 'invalid-quantity');
    assert.equal(transferOrbitalCargo(source, 'cargo-1', 'grain', 3, 'to-ship').failure, 'insufficient-cargo');
    assert.equal(transferOrbitalCargo(source, 'cargo-1', 'cheese', 1, 'to-orbit').failure, 'missing-commodity');
    assert.equal(transferOrbitalCargo(source, 'cargo-1', 'grain', 3, 'to-ship').state, source, 'a failed transfer leaves state untouched');
});

test('spilling orbital cargo preserves per-stack cost and spreads items around the full circle at randomized 126-base speeds', () => {
    const cargo = { id: 'cargo-spill', position: { x: 2_000, y: 0 }, orbit: { angleRadians: 0, radius: 2_000, rotationRadians: 0 }, hitPoints: 1, manifest: [
        { commodityId: 'milk', quantity: 2, totalCost: 8 },
        { commodityId: 'grain', quantity: 1, totalCost: 7 }
    ] };
    const items = spillOrbitalCargo(cargo, 400);
    assert.equal(items.length, 3);
    assert.deepEqual(items.map(item => item.container), [
        { commodityId: 'milk', quantity: 1, totalCost: 4 },
        { commodityId: 'milk', quantity: 1, totalCost: 4 },
        { commodityId: 'grain', quantity: 1, totalCost: 7 }
    ]);
    assert.equal(items.reduce((sum, item) => sum + item.container.totalCost, 0), 15, 'spill preserves the manifest cost');
    const positions = new Set(items.map(item => `${item.position.x},${item.position.y}`));
    const velocities = new Set(items.map(item => `${item.motion.ejectionVelocity.x},${item.motion.ejectionVelocity.y}`));
    const directions = new Set(items.map(item => Math.round(Math.atan2(item.motion.ejectionVelocity.y, item.motion.ejectionVelocity.x) * 1e6) / 1e6));
    assert.equal(positions.size, 3, 'every manifest unit gets a distinct authoritative position');
    assert.equal(velocities.size, 3, 'every manifest unit gets a distinct authoritative velocity');
    assert.equal(directions.size, 3, 'every manifest unit ejects in a distinct radial direction');
    for (const item of items) {
        assert.equal(item.motion.createdAtActiveMs, 400);
        const speed = Math.hypot(item.motion.ejectionVelocity.x, item.motion.ejectionVelocity.y);
        assert(speed >= 126 * 0.7 - 1e-8 && speed <= 126 * 1.3 + 1e-8, `spill speed stays within the 30% randomization band, got ${speed}`);
    }
    assert.deepEqual(spillOrbitalCargo(cargo, 400), items, 'spill is deterministic for identical input');
});

const marketOf = (state, planetId) => state.markets.find(market => market.planetId === planetId);
const stockIn = (market, commodityId) => market.commodityStocks.find(entry => entry.commodityId === commodityId).stock;
const facilityIn = (market, facilityId) => market.facilities.find(facility => facility.facilityId === facilityId);
const stockOf = (state, planetId, commodityId) => stockIn(marketOf(state, planetId), commodityId);
const statusOf = (state, planetId, facilityId) => facilityIn(marketOf(state, planetId), facilityId).status;
const planetMarket = (planetId, { stocks = {}, levels = {} } = {}) => {
    const base = marketOf(initialGameState, planetId);
    return {
        planetId,
        commodityStocks: base.commodityStocks.map(entry => ({ commodityId: entry.commodityId, stock: stocks[entry.commodityId] ?? entry.stock })),
        facilities: base.facilities.map(facility => levels[facility.facilityId] === undefined ? { ...facility } : {
            facilityId: facility.facilityId,
            level: levels[facility.facilityId],
            status: levels[facility.facilityId] === 0 ? 'notBuilt' : 'working'
        })
    };
};

test('facility cycles cross whole active seconds and apply one recipe pass per crossed second', () => {
    const subSecond = advanceGameSimulation(initialGameState, quietInput, 999);
    assert.equal(subSecond.clock.activeElapsedMs, 999);
    assert.deepEqual(subSecond.markets, initialGameState.markets, 'no cycle runs before the first crossed second');

    const crossed = advanceGameSimulation(subSecond, quietInput, 1);
    assert.equal(crossed.clock.activeElapsedMs, 1_000);
    assert.deepEqual(crossed.markets, advanceGameSimulation(initialGameState, quietInput, 1_000).markets, 'crossing the boundary runs exactly one pass');

    const midSecond = advanceGameSimulation(initialGameState, quietInput, 1_500);
    assert.deepEqual(advanceGameSimulation(midSecond, quietInput, 400).markets, midSecond.markets, 'a frame inside one second attempts no cycle');

    const oneSecond = advanceGameSimulation(initialGameState, quietInput, 1_000);
    assert.equal(stockOf(oneSecond, 'seroton', 'milk'), 2, 'the cheese factory consumes 12 milk per second (the same-cycle farm-to-consumer ordering is proven by the lactozis case below)');
    assert.equal(stockOf(oneSecond, 'seroton', 'grain'), 110);
    assert.equal(stockOf(oneSecond, 'seroton', 'cheese'), 66, 'the seroton cheese factory applies its +20% output');
    assert.equal(statusOf(oneSecond, 'seroton', 'dairyFarm'), 'working');
    assert.equal(statusOf(oneSecond, 'seroton', 'bakery'), 'notBuilt', 'a level-zero facility never runs');
    assert.equal(stockOf(oneSecond, 'seroton', 'bun'), 50);
});

test('a multi-second frame equals the same span applied one second at a time', () => {
    const singleFrame = advanceGameSimulation(initialGameState, quietInput, 3_500);
    let stepped = initialGameState;
    for (const stepMs of [1_000, 1_000, 1_000, 500]) stepped = advanceGameSimulation(stepped, quietInput, stepMs);
    assert.equal(singleFrame.clock.activeElapsedMs, 3_500);
    assert.deepEqual(singleFrame.markets, stepped.markets, 'a 3 500 ms frame applies three sequential cycles');

    const economy = marketOf(initialGameState, 'seroton');
    const snapshot = JSON.parse(JSON.stringify(economy));
    const threeCycles = advancePlanetFacilities(economy, 3);
    assert.deepEqual(economy, snapshot, 'the reducer never mutates its input');
    let chained = economy;
    for (let cycle = 0; cycle < 3; cycle++) chained = advancePlanetFacilities(chained, 1);
    assert.deepEqual(threeCycles, chained, 'three cycles equal three single-cycle passes');
    assert.deepEqual(advancePlanetFacilities(economy, 3), threeCycles, 'the reducer is deterministic');
});

test('facility cycles run in their fixed order so a farm output supplies a later consumer in the same cycle', () => {
    const start = planetMarket('lactozis-7c', { stocks: { milk: 2 } });
    const once = advancePlanetFacilities(start, 1);
    assert.equal(facilityIn(once, 'dairyFarm').status, 'working');
    assert.equal(facilityIn(once, 'cheeseFactory').status, 'working');
    assert.equal(stockIn(once, 'milk'), 2, 'the dairy farm adds 10 milk before the cheese factory consumes 10');
    assert.equal(stockIn(once, 'cheese'), 55, 'a cheese-first order would have starved the factory');
});

test('an all-or-nothing shortfall leaves the stock untouched and flips the status until the input returns', () => {
    const starved = planetMarket('seroton', { stocks: { grain: 4, bun: 50 }, levels: { bakery: 1, grainFarm: 0 } });
    const afterShortfall = advancePlanetFacilities(starved, 1);
    assert.equal(facilityIn(afterShortfall, 'bakery').status, 'insufficientResources');
    assert.equal(stockIn(afterShortfall, 'grain'), 4, 'the uncovered input is not partially consumed');
    assert.equal(stockIn(afterShortfall, 'bun'), 50, 'no output is produced without the full recipe');
    assert.equal(facilityIn(afterShortfall, 'grainFarm').status, 'notBuilt', 'level zero stays not built');
    assert.equal(facilityIn(afterShortfall, 'dairyFarm').status, 'working', 'other facilities keep cycling');

    const supplied = planetMarket('seroton', { stocks: { grain: 40, bun: 50 }, levels: { bakery: 1, grainFarm: 0 } });
    const recovered = advancePlanetFacilities(supplied, 1);
    assert.equal(facilityIn(recovered, 'bakery').status, 'working');
    assert.equal(stockIn(recovered, 'grain'), 30);
    assert.equal(stockIn(recovered, 'bun'), 55);

    const repeated = advancePlanetFacilities(afterShortfall, 1);
    assert.equal(facilityIn(repeated, 'bakery').status, 'insufficientResources', 'the stored status persists until the next cycle evaluates it');
});

test('every pause reason freezes facility cycles and resuming continues from the stored stock', () => {
    const expected = advanceGameSimulation(initialGameState, quietInput, 1_000).markets;
    for (const reason of ['background', 'landed', 'manual', 'menu', 'orientation']) {
        const paused = {
            ...initialGameState,
            clock: { ...initialGameState.clock, pauseReasons: [reason] },
            planetLifecycle: reason === 'landed'
                ? { capturedPlanetId: 'seroton', landedPlanetId: 'seroton', relandingLockedPlanetId: null }
                : initialGameState.planetLifecycle
        };
        const frozen = advanceGameSimulation(paused, quietInput, 5_000);
        assert.equal(frozen.clock.activeElapsedMs, 0, `${reason} keeps active time frozen`);
        assert.deepEqual(frozen.markets, paused.markets, `${reason} keeps every stock frozen`);

        const resumed = advanceGameSimulation({
            ...frozen,
            clock: { ...frozen.clock, pauseReasons: [] },
            planetLifecycle: { capturedPlanetId: null, landedPlanetId: null, relandingLockedPlanetId: null }
        }, quietInput, 1_000);
        assert.deepEqual(resumed.markets, expected, `${reason} resumes the normal one-second cycle`);
    }
});

test('facility stock and status survive an encode and restore and keep cycling', () => {
    const advanced = advanceGameSimulation(initialGameState, quietInput, 2_000);
    assert.notDeepEqual(advanced.markets, initialGameState.markets, 'two seconds of cycles move the stock');
    const restored = decodeGameState(encodeGameState(advanced));
    assert.deepEqual(restored.markets, advanced.markets, 'the codec round-trips facility stock and status');
    assert.deepEqual(advanceGameSimulation(restored, quietInput, 2_000).markets, advanceGameSimulation(advanced, quietInput, 2_000).markets,
        'restored stock continues from the stored values');

    const starved = advancePlanetFacilities(planetMarket('seroton', { stocks: { grain: 4, bun: 50 }, levels: { bakery: 1, grainFarm: 0 } }), 1);
    const shorted = { ...advanced, markets: advanced.markets.map(market => market.planetId === 'seroton' ? starved : market) };
    assert.equal(statusOf(shorted, 'seroton', 'bakery'), 'insufficientResources', 'a starved consumer stores an insufficient-resources status');
    const restoredShortfall = decodeGameState(encodeGameState(shorted));
    assert.equal(statusOf(restoredShortfall, 'seroton', 'bakery'), 'insufficientResources', 'the codec preserves a stored insufficient-resources status');
});

test('each planet cycles its own facilities and planet modifiers in isolation', () => {
    const next = advanceGameSimulation(initialGameState, quietInput, 1_000);
    assert.equal(stockOf(next, 'seroton', 'milk'), 2);
    assert.equal(stockOf(next, 'seroton', 'cheese'), 66, 'the seroton cheese factory keeps its +20% output');
    assert.equal(stockOf(next, 'lactozis-7c', 'milk'), 100);
    assert.equal(stockOf(next, 'lactozis-7c', 'grain'), 132, 'the lactozis-7c grain farm keeps its +20% output');
    assert.equal(stockOf(next, 'maslo-prime', 'milk'), 122, 'the maslo-prime dairy farm keeps its +20% output');
    assert.equal(stockOf(next, 'maslo-prime', 'cheese'), 7);
    assert.equal(statusOf(next, 'maslo-prime', 'bakery'), 'notBuilt');

    const isolated = advancePlanetFacilities(marketOf(initialGameState, 'lactozis-7c'), 1);
    assert.deepEqual(isolated, marketOf(next, 'lactozis-7c'), 'advancing one planet never leaks into another');
});
