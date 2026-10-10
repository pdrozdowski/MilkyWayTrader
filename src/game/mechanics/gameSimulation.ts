import type { GameStateSnapshot } from '../state/gameStateSnapshot';
import type { ProjectileState } from '../state/projectileState';
import type { AsteroidState } from '../state/asteroidState';
import type { CircleObstacle } from '../world/geometry';
import { sweptCircleIntersection } from '../world/geometry.ts';
import { asteroidTuning, normalFlightMaxSpeed, projectileTuning, shipBoostTuning, shipTuning, weaponTuning } from '../definitions/gameplayTuning.ts';
import { advanceGameClock } from './clock/gameClock.ts';
import { volleyAngleOffsetsDegrees, volleyShotTrajectory } from './projectile/trajectory.ts';
import { advanceFireCadence } from './spaceship/fireCadence.ts';
import { boostAccelerationRate, directionRotation, flightVelocity } from './spaceship/flight.ts';
import { getPlanetDefinition } from '../definitions/planetDefinitions.ts';
import { projectPlanetPosition } from './planet/orbit.ts';
import { isWithinPlanetOrbitBoundary } from './planet/proximity.ts';
import { tryLandAtCapturedPlanet } from './planet/landing.ts';
import { isRecoveringFromMoolaris, resolveMoolarisContact } from './moolaris/contact.ts';
import { MOOLARIS_RECOVERY_SECONDS } from '../definitions/moolarisDefinition.ts';
import { asteroidRadius, advanceAsteroidMotions, fragmentAsteroid, type AsteroidImpactSource } from './asteroid/asteroidSimulation.ts';
import { moolarisDefinition } from '../definitions/moolarisDefinition.ts';
import { asteroidDamageRanges, moolarisDamageRange, nextRandomInteger } from './hazards/damage.ts';
import { resolveTerminalResult } from './hazards/terminal.ts';
import { createCargoSchedule, spawnAsteroidLoot } from './salvage/asteroidLoot.ts';
import { advanceLooseItems, advanceOrbitalCargo } from './salvage/salvageSimulation.ts';
import { collectLooseItem, damageOrbitalCargo } from './salvage/cargoDamage.ts';
import { advancePlanetFacilities } from './planetFacilitySimulation.ts';

const asteroidRecoverySeconds = MOOLARIS_RECOVERY_SECONDS / 2;

export interface GameSimulationInput
{
    readonly target: Readonly<{ x: number; y: number }> | null;
    readonly boostRequested: boolean;
    readonly firing: boolean;
    readonly landingRequested?: boolean;
}

export interface GameSimulationOptions
{
    readonly obstacles: readonly CircleObstacle[];
    readonly projectileLifetimeMs: number;
    readonly projectileSpeed: number;
    readonly projectileRadius: number;
    readonly shotIntervalMs: number;
    readonly muzzleOffset: number;
}

export const defaultGameSimulationOptions: GameSimulationOptions = {
    obstacles: [],
    projectileLifetimeMs: projectileTuning.lifetime,
    projectileSpeed: weaponTuning.projectileSpeed,
    projectileRadius: projectileTuning.radius,
    shotIntervalMs: 1000 / weaponTuning.shotsPerSecond,
    muzzleOffset: weaponTuning.noseOffset
};

function advanceProjectiles (
    projectiles: readonly ProjectileState[],
    activeTimeMs: number,
    activeDeltaMs: number,
    options: GameSimulationOptions
): readonly ProjectileState[]
{
    return projectiles.flatMap(projectile => {
        if (activeTimeMs - projectile.bornAtActiveMs >= options.projectileLifetimeMs) return [];
        const next = {
            x: projectile.position.x + projectile.velocity.x * activeDeltaMs / 1000,
            y: projectile.position.y + projectile.velocity.y * activeDeltaMs / 1000
        };
        return [{ ...projectile, position: next }];
    });
}

export function advanceGameSimulation (
    state: GameStateSnapshot,
    input: GameSimulationInput,
    deltaMs: number,
    overrides: Partial<GameSimulationOptions> = {}
): GameStateSnapshot
{
    if (state.terminalResult !== null) return state;
    const options = { ...defaultGameSimulationOptions, ...overrides };
    const clock = advanceGameClock(state.clock, deltaMs);
    const activeDeltaMs = clock.activeElapsedMs - state.clock.activeElapsedMs;
    if (activeDeltaMs <= 0) return { ...state, clock };
    const facilityCycles = Math.floor(clock.activeElapsedMs / 1000) - Math.floor(state.clock.activeElapsedMs / 1000);
    const markets = facilityCycles > 0 ? state.markets.map(market => advancePlanetFacilities(market, facilityCycles)) : state.markets;
    const landed = state.planetLifecycle.landedPlanetId !== null;
    const contact = resolveMoolarisContact(state.ship);
    const asteroidControlLocked = state.ship.asteroidControlLockedUntilActiveMs !== null
        && clock.activeElapsedMs < state.ship.asteroidControlLockedUntilActiveMs;
    const recovering = asteroidControlLocked || (contact.hasControl && isRecoveringFromMoolaris(state.ship, input.target));
    const hasControl = contact.hasControl && !asteroidControlLocked;
    const targetDelta = hasControl && !recovering && input.target ? {
        x: input.target.x - state.ship.position.x,
        y: input.target.y - state.ship.position.y
    } : null;
    const currentSpeed = Math.hypot(state.ship.velocity.x, state.ship.velocity.y);
    const normalMaxSpeed = normalFlightMaxSpeed(state.shipStatus.engineLevel);
    const wantsBoost = !landed && hasControl && !recovering && state.shipStatus.boosterUnlocked && input.boostRequested
        && !!targetDelta && Math.hypot(targetDelta.x, targetDelta.y) > 2;
    const boostAcceleration = wantsBoost && !state.ship.boosting
        ? boostAccelerationRate(currentSpeed, shipTuning.maxSpeed, shipBoostTuning.speedMultiplier, shipBoostTuning.accelerationSeconds)
            || shipTuning.maxSpeed * (shipBoostTuning.speedMultiplier - 1) / shipBoostTuning.accelerationSeconds
        : state.ship.boostAcceleration;
    const coastDeceleration = recovering ? shipTuning.maxSpeed / (asteroidControlLocked ? asteroidRecoverySeconds : MOOLARIS_RECOVERY_SECONDS) : !targetDelta && state.ship.enginesOn
        ? Math.max(normalMaxSpeed, currentSpeed) / shipTuning.stoppingSeconds
        : state.ship.coastDeceleration;
    const movementSeconds = Math.min(activeDeltaMs, 100) / 1000;
    const flight = flightVelocity(state.ship.velocity, targetDelta, movementSeconds, {
        ...shipTuning,
        maxSpeed: wantsBoost ? shipTuning.maxSpeed * shipBoostTuning.speedMultiplier : normalMaxSpeed,
        accelerationRate: wantsBoost ? boostAcceleration : normalMaxSpeed / shipTuning.accelerationSeconds,
        decelerationRate: !targetDelta ? coastDeceleration : shipTuning.maxSpeed * (shipBoostTuning.speedMultiplier - 1) / shipBoostTuning.accelerationSeconds
    });
    const velocity = contact.forcedVelocity ?? flight;
    const ship = {
        ...state.ship,
        position: {
            x: state.ship.position.x + velocity.x * movementSeconds,
            y: state.ship.position.y + velocity.y * movementSeconds
        },
        velocity: { x: velocity.x, y: velocity.y },
        rotation: directionRotation(velocity.x, velocity.y, state.ship.rotation),
        enginesOn: contact.forcedVelocity !== null || flight.enginesOn,
        boosting: wantsBoost,
        boostAcceleration: contact.forcedVelocity !== null ? 0 : boostAcceleration,
        coastDeceleration
    };

    let projectiles = advanceProjectiles(state.projectiles, clock.activeElapsedMs, activeDeltaMs, options);
    const cadence = advanceFireCadence(state.weapon, clock.activeElapsedMs, !landed && hasControl && !recovering && input.firing && !ship.boosting, options.shotIntervalMs);
    let weapon = cadence.weapon;
    if (cadence.fired) {
        const sequence = weapon.projectileSequence + 1;
        weapon = { ...weapon, projectileSequence: sequence };
    }
    const planets = state.planets.map(planet => ({
        ...planet,
        position: projectPlanetPosition(getPlanetDefinition(planet.id).id, clock.activeElapsedMs)
    }));
    const capturedPlanetId = state.planetLifecycle.capturedPlanetId;
    const capturedPlanet = capturedPlanetId === null ? null : planets.find(planet => planet.id === capturedPlanetId) ?? null;
    const previousCapturedPlanet = capturedPlanetId === null ? null : state.planets.find(planet => planet.id === capturedPlanetId) ?? null;
    let lifecycle = state.planetLifecycle;
    let orbitShip = ship;
    let detachedThisTick = false;
    if (capturedPlanet && previousCapturedPlanet) {
        const displacedPosition = {
            x: ship.position.x + capturedPlanet.position.x - previousCapturedPlanet.position.x,
            y: ship.position.y + capturedPlanet.position.y - previousCapturedPlanet.position.y
        };
        if (isWithinPlanetOrbitBoundary(Math.hypot(displacedPosition.x - capturedPlanet.position.x, displacedPosition.y - capturedPlanet.position.y), capturedPlanet.radius, shipTuning.collisionRadius)) {
            orbitShip = { ...ship, position: displacedPosition };
        } else {
            lifecycle = { ...lifecycle, capturedPlanetId: null, relandingLockedPlanetId: lifecycle.relandingLockedPlanetId === capturedPlanet.id ? null : lifecycle.relandingLockedPlanetId };
            detachedThisTick = true;
        }
    }
    if (lifecycle.relandingLockedPlanetId !== null && lifecycle.capturedPlanetId === lifecycle.relandingLockedPlanetId) {
        const lockedPlanet = planets.find(planet => planet.id === lifecycle.relandingLockedPlanetId);
        if (lockedPlanet && Math.hypot(orbitShip.position.x - lockedPlanet.position.x, orbitShip.position.y - lockedPlanet.position.y) > lockedPlanet.radius) {
            lifecycle = { ...lifecycle, relandingLockedPlanetId: null };
        }
    }
    if (!detachedThisTick && lifecycle.capturedPlanetId === null && lifecycle.landedPlanetId === null) {
        const eligible = planets.find(planet => planet.id !== lifecycle.relandingLockedPlanetId
            && isWithinPlanetOrbitBoundary(Math.hypot(orbitShip.position.x - planet.position.x, orbitShip.position.y - planet.position.y), planet.radius, shipTuning.collisionRadius));
        if (eligible) {
            const previous = state.planets.find(planet => planet.id === eligible.id);
            if (previous) orbitShip = {
                ...orbitShip,
                position: {
                    x: orbitShip.position.x + eligible.position.x - previous.position.x,
                    y: orbitShip.position.y + eligible.position.y - previous.position.y
                }
            };
            lifecycle = { ...lifecycle, capturedPlanetId: eligible.id };
        }
    }
    const asteroidMotions = advanceAsteroidMotions(state.asteroids, clock.activeElapsedMs, activeDeltaMs, orbitShip.position, state.ship.position);
    const resolved = resolveAsteroidImpacts(asteroidMotions, state, orbitShip, planets,
        projectiles.filter(projectile => projectile.bornAtActiveMs < clock.activeElapsedMs), options);
    projectiles = resolved.projectiles;
    if (cadence.fired) {
        const volley = weapon.projectileSequence;
        const muzzleOffset = options.muzzleOffset + options.projectileRadius + 1;
        const volleyProjectiles = volleyAngleOffsetsDegrees(state.shipStatus.weaponLevel).map((angleOffsetDegrees, index) => {
            const trajectory = volleyShotTrajectory(orbitShip.position, orbitShip.rotation, angleOffsetDegrees, muzzleOffset, options.projectileSpeed);
            return {
                id: `projectile-${volley}-${index + 1}`,
                position: trajectory.start,
                velocity: trajectory.velocity,
                bornAtActiveMs: clock.activeElapsedMs
            };
        });
        projectiles = [...projectiles, ...volleyProjectiles];
    }
    const collisionShip = resolved.shipImpact === null ? orbitShip : shipAfterAsteroidImpact(orbitShip, resolved.shipImpact.position, clock.activeElapsedMs);
    const impactedShip = resolved.shipImpact === null ? collisionShip : { ...collisionShip, asteroidImpactAtActiveMs: clock.activeElapsedMs };
    let randomState = state.randomState;
    let cargoSchedule = state.cargoSchedule;
    const spawnedCargo = [];
    const spawnedLooseItems = [];
    for (const asteroid of resolved.destroyedSmallAsteroids) {
        if (cargoSchedule.length === 0) {
            const nextSchedule = createCargoSchedule(randomState);
            cargoSchedule = nextSchedule.schedule;
            randomState = nextSchedule.nextRandomState;
        }
        const [cargoGuaranteed, ...remainingSchedule] = cargoSchedule;
        cargoSchedule = remainingSchedule;
        const loot = spawnAsteroidLoot(asteroid, clock.activeElapsedMs, randomState, cargoGuaranteed === 1);
        randomState = loot.nextRandomState;
        if (loot.orbitalCargo) spawnedCargo.push(loot.orbitalCargo);
        if (loot.looseItem) spawnedLooseItems.push(loot.looseItem);
    }
    let currentHitPoints = state.shipStatus.currentHitPoints;
    if (resolved.shipImpact !== null) {
        const damage = nextRandomInteger(randomState, asteroidDamageRanges[resolved.shipImpact.size].minimum, asteroidDamageRanges[resolved.shipImpact.size].maximum);
        randomState = damage.nextState;
        currentHitPoints = Math.max(0, currentHitPoints - damage.value);
    }
    const inMoolarisControlRadius = !resolveMoolarisContact(impactedShip).hasControl;
    let moolarisDamageArmed = state.moolarisDamageArmed;
    if (!inMoolarisControlRadius) moolarisDamageArmed = true;
    else if (moolarisDamageArmed) {
        const damage = nextRandomInteger(randomState, moolarisDamageRange.minimum, moolarisDamageRange.maximum);
        randomState = damage.nextState;
        currentHitPoints = currentHitPoints >= 30 ? damage.value : 0;
        moolarisDamageArmed = false;
    }
    let salvageState: GameStateSnapshot = {
        ...state,
        clock,
        randomState,
        cargoSchedule,
        moolarisDamageArmed,
        markets,
        ship: impactedShip,
        shipStatus: { ...state.shipStatus, currentHitPoints },
        planets,
        planetLifecycle: lifecycle,
        weapon,
        projectiles,
        asteroids: resolved.asteroids,
        orbitalCargo: advanceOrbitalCargo([...state.orbitalCargo, ...spawnedCargo], clock.activeElapsedMs),
        looseItems: advanceLooseItems([...state.looseItems, ...spawnedLooseItems], clock.activeElapsedMs, activeDeltaMs)
    };
    const cargoProjectileResult = resolveCargoProjectileHits(salvageState, projectiles, state.projectiles, options);
    salvageState = cargoProjectileResult.state;
    projectiles = cargoProjectileResult.projectiles;
    const pickup = salvageState.looseItems.find(item => Math.hypot(item.position.x - impactedShip.position.x, item.position.y - impactedShip.position.y) <= asteroidTuning.salvage.looseItemPickupRadius);
    if (pickup) salvageState = collectLooseItem(salvageState, pickup.id);
    const next = tryLandAtCapturedPlanet({ ...salvageState, projectiles }, input.landingRequested === true);
    return resolveTerminalResult(next);
}

function shipAfterAsteroidImpact (ship: GameStateSnapshot['ship'], asteroidPosition: Readonly<{ x: number; y: number }>, activeElapsedMs: number): GameStateSnapshot['ship']
{
    const x = ship.position.x - asteroidPosition.x;
    const y = ship.position.y - asteroidPosition.y;
    const distance = Math.hypot(x, y);
    const direction = distance === 0 ? { x: 1, y: 0 } : { x: x / distance, y: y / distance };
    return {
        ...ship,
        velocity: { x: direction.x * shipTuning.maxSpeed, y: direction.y * shipTuning.maxSpeed },
        enginesOn: true,
        boosting: false,
        boostAcceleration: 0,
        asteroidControlLockedUntilActiveMs: activeElapsedMs + asteroidRecoverySeconds * 1000
    };
}

function resolveAsteroidImpacts (
    motions: ReturnType<typeof advanceAsteroidMotions>, state: GameStateSnapshot, ship: GameStateSnapshot['ship'],
    planets: GameStateSnapshot['planets'], projectiles: readonly ProjectileState[], options: GameSimulationOptions
): { asteroids: GameStateSnapshot['asteroids']; projectiles: readonly ProjectileState[]; shipImpact: AsteroidState | null; destroyedSmallAsteroids: readonly AsteroidState[] }
{
    const sources: readonly (AsteroidImpactSource & { readonly start: Readonly<{ x: number; y: number }>; readonly radius: number })[] = [
        { id: moolarisDefinition.id, kind: 'moolaris', position: moolarisDefinition.position, start: moolarisDefinition.position, radius: moolarisDefinition.radius },
        { id: 'ship', kind: 'ship', position: ship.position, start: state.ship.position, radius: shipTuning.collisionRadius },
        ...planets.map(planet => ({ id: `planet-${planet.id}`, kind: 'planet' as const, position: planet.position,
            start: state.planets.find(previous => previous.id === planet.id)?.position ?? planet.position, radius: planet.radius }))
    ];
    const asteroidEvents = motions.flatMap(motion => {
        const asteroid = { id: motion.asteroid.id, start: motion.start, end: motion.asteroid.position, radius: asteroidRadius(motion.asteroid.size) };
        return sources.map(source => {
            const radius = source.kind === 'planet'
                ? Math.max(0, source.radius - asteroidRadius(motion.asteroid.size) * asteroidTuning.planetCollisionPenetration)
                : source.radius;
            const movingAsteroid = source.kind === 'planet' ? { ...asteroid, radius: 0 } : asteroid;
            return { source, time: sweptCircleIntersection(movingAsteroid, { id: source.id, start: source.start, end: source.position, radius }) };
        })
            .filter((impact): impact is { source: typeof sources[number]; time: number } => impact.time !== null)
            .map(impact => ({ asteroid: motion.asteroid, asteroidStart: motion.start, ...impact }));
    }).sort((left, right) => left.time - right.time || left.asteroid.id.localeCompare(right.asteroid.id) || left.source.id.localeCompare(right.source.id));
    const blockers = [{ id: moolarisDefinition.id, position: moolarisDefinition.position, radius: moolarisDefinition.radius },
        ...options.obstacles.map((obstacle, index) => ({ id: `legacy-obstacle-${index}`, position: obstacle, radius: obstacle.radius }))];
    const projectileEvents = projectiles.flatMap(projectile => {
        const start = state.projectiles.find(previous => previous.id === projectile.id)?.position ?? projectile.position;
        const shot = { id: projectile.id, start, end: projectile.position, radius: options.projectileRadius };
        const targets = motions.flatMap(motion => {
            const time = sweptCircleIntersection(shot, { id: motion.asteroid.id, start: motion.start, end: motion.asteroid.position, radius: asteroidRadius(motion.asteroid.size) });
            return time === null ? [] : [{ kind: 'asteroid' as const, projectile, asteroid: motion.asteroid, time }];
        });
        const blockerEvents = blockers.flatMap(blocker => {
            const time = sweptCircleIntersection(shot, { id: blocker.id, start: blocker.position, end: blocker.position, radius: blocker.radius });
            return time === null ? [] : [{ kind: 'blocker' as const, projectile, blocker, time }];
        });
        return [...targets, ...blockerEvents];
    }).sort((left, right) => left.time - right.time || left.projectile.id.localeCompare(right.projectile.id)
        || (left.kind === 'asteroid' ? left.asteroid.id : left.blocker.id).localeCompare(right.kind === 'asteroid' ? right.asteroid.id : right.blocker.id));
    const removedAsteroids = new Set<string>();
    const changedAsteroids = new Map<string, AsteroidState>();
    const removedProjectiles = new Set<string>();
    const children: AsteroidState[] = [];
    const destroyedSmallAsteroids: AsteroidState[] = [];
    let shipImpact: AsteroidState | null = null;
    for (const event of asteroidEvents) {
        if (removedAsteroids.has(event.asteroid.id)) continue;
        if (event.source.kind === 'moolaris') {
            const distance = Math.hypot(event.asteroid.position.x - moolarisDefinition.position.x, event.asteroid.position.y - moolarisDefinition.position.y);
            if (distance <= moolarisDefinition.radius * asteroidTuning.starIngestionRadiusFactor) {
                removedAsteroids.add(event.asteroid.id);
            } else {
                const x = moolarisDefinition.position.x - event.asteroid.position.x;
                const y = moolarisDefinition.position.y - event.asteroid.position.y;
                const length = Math.hypot(x, y) || 1;
                changedAsteroids.set(event.asteroid.id, { ...event.asteroid, orbit: null, velocity: { x: x / length * asteroidTuning.starIngestionSpeed, y: y / length * asteroidTuning.starIngestionSpeed } });
            }
            continue;
        }
        const asteroidAtImpact = { ...event.asteroid, position: interpolatedPosition(event.asteroidStart, event.asteroid.position, event.time) };
        const sourceAtImpact = { ...event.source, position: interpolatedPosition(event.source.start, event.source.position, event.time) };
        removedAsteroids.add(event.asteroid.id);
        if (event.source.kind === 'ship' && shipImpact === null) {
            shipImpact = asteroidAtImpact;
        }
        children.push(...fragmentAsteroid(asteroidAtImpact, sourceAtImpact));
    }
    for (const event of projectileEvents) {
        if (removedProjectiles.has(event.projectile.id)) continue;
        removedProjectiles.add(event.projectile.id);
        if (event.kind === 'asteroid' && !removedAsteroids.has(event.asteroid.id)) {
            const asteroid = changedAsteroids.get(event.asteroid.id) ?? event.asteroid;
            if (asteroid.hitPoints > 1) changedAsteroids.set(asteroid.id, { ...asteroid, hitPoints: asteroid.hitPoints - 1 });
            else {
                removedAsteroids.add(asteroid.id);
                if (asteroid.size === 'small') destroyedSmallAsteroids.push(asteroid);
                children.push(...fragmentAsteroid(asteroid, { id: event.projectile.id, kind: 'projectile', position: event.projectile.position }));
            }
        }
    }
    return { asteroids: [...motions.filter(motion => !removedAsteroids.has(motion.asteroid.id)).map(motion => changedAsteroids.get(motion.asteroid.id) ?? motion.asteroid), ...children], projectiles: projectiles.filter(projectile => !removedProjectiles.has(projectile.id)), shipImpact, destroyedSmallAsteroids };
}

function resolveCargoProjectileHits (state: GameStateSnapshot, projectiles: readonly ProjectileState[], previousProjectiles: readonly ProjectileState[], options: GameSimulationOptions): { state: GameStateSnapshot; projectiles: readonly ProjectileState[] }
{
    // Cargo is treated as a static circle at its post-tick position while the projectile segment is swept.
    // Orbital cargo moves slowly enough per tick relative to its collision radius that this bounded-motion
    // simplification cannot tunnel a hit in practice; asteroid collisions remain fully swept.
    let nextState = state;
    const removed = new Set<string>();
    for (const projectile of projectiles) {
        const start = previousProjectiles.find(previous => previous.id === projectile.id)?.position ?? projectile.position;
        const cargo = nextState.orbitalCargo.find(candidate => sweptCircleIntersection({ id: projectile.id, start, end: projectile.position, radius: options.projectileRadius }, { id: candidate.id, start: candidate.position, end: candidate.position, radius: asteroidTuning.salvage.cargoCollisionRadius }) !== null);
        if (!cargo) continue;
        removed.add(projectile.id);
        nextState = damageOrbitalCargo(nextState, cargo.id);
    }
    return { state: nextState, projectiles: projectiles.filter(projectile => !removed.has(projectile.id)) };
}

function interpolatedPosition (
    start: Readonly<{ x: number; y: number }>, end: Readonly<{ x: number; y: number }>, time: number
): { x: number; y: number }
{
    return { x: start.x + (end.x - start.x) * time, y: start.y + (end.y - start.y) * time };
}
