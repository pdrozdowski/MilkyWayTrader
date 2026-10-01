import type { GameStateSnapshot } from '../state/gameStateSnapshot';
import type { ProjectileState } from '../state/projectileState';
import type { AsteroidState } from '../state/asteroidState';
import type { CircleObstacle } from '../world/geometry';
import { sweptCircleIntersection } from '../world/geometry.ts';
import { asteroidTuning, projectileTuning, shipBoostTuning, shipTuning, weaponTuning } from '../definitions/gameplayTuning.ts';
import { advanceGameClock } from './clock/gameClock.ts';
import { shotTrajectory } from './projectile/trajectory.ts';
import { advanceFireCadence } from './spaceship/fireCadence.ts';
import { boostAccelerationRate, directionRotation, flightVelocity } from './spaceship/flight.ts';
import { getPlanetDefinition } from '../definitions/planetDefinitions.ts';
import { projectPlanetPosition } from './planet/orbit.ts';
import { isWithinPlanetOrbitBoundary } from './planet/proximity.ts';
import { tryLandAtCapturedPlanet } from './planet/landing.ts';
import { isRecoveringFromMoolaris, resolveMoolarisContact } from './moolaris/contact.ts';
import { MOOLARIS_RECOVERY_SECONDS } from '../definitions/moolarisDefinition.ts';
import { advanceSerotonMarket } from './serotonMarketSimulation.ts';
import { asteroidRadius, advanceAsteroidMotions, fragmentAsteroid, type AsteroidImpactSource } from './asteroid/asteroidSimulation.ts';
import { moolarisDefinition } from '../definitions/moolarisDefinition.ts';

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
    const options = { ...defaultGameSimulationOptions, ...overrides };
    const clock = advanceGameClock(state.clock, deltaMs);
    const activeDeltaMs = clock.activeElapsedMs - state.clock.activeElapsedMs;
    if (activeDeltaMs <= 0) return { ...state, clock };
    const marketElapsedSeconds = Math.floor(clock.activeElapsedMs / 1000) - Math.floor(state.clock.activeElapsedMs / 1000);
    const markets = marketElapsedSeconds === 0 ? state.markets : state.markets.map(market => advanceSerotonMarket(market, marketElapsedSeconds));

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
    const wantsBoost = !landed && hasControl && !recovering && state.shipStatus.boosterUnlocked && input.boostRequested
        && !!targetDelta && Math.hypot(targetDelta.x, targetDelta.y) > 2;
    const boostAcceleration = wantsBoost && !state.ship.boosting
        ? boostAccelerationRate(currentSpeed, shipTuning.maxSpeed, shipBoostTuning.speedMultiplier, shipBoostTuning.accelerationSeconds)
            || shipTuning.maxSpeed * (shipBoostTuning.speedMultiplier - 1) / shipBoostTuning.accelerationSeconds
        : state.ship.boostAcceleration;
    const coastDeceleration = recovering ? shipTuning.maxSpeed / MOOLARIS_RECOVERY_SECONDS : !targetDelta && state.ship.enginesOn
        ? Math.max(shipTuning.maxSpeed, currentSpeed) / shipTuning.stoppingSeconds
        : state.ship.coastDeceleration;
    const movementSeconds = Math.min(activeDeltaMs, 100) / 1000;
    const flight = flightVelocity(state.ship.velocity, targetDelta, movementSeconds, {
        ...shipTuning,
        maxSpeed: shipTuning.maxSpeed * (wantsBoost ? shipBoostTuning.speedMultiplier : 1),
        accelerationRate: wantsBoost ? boostAcceleration : shipTuning.maxSpeed / shipTuning.accelerationSeconds,
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
        const trajectory = shotTrajectory(orbitShip.position, orbitShip.rotation, options.muzzleOffset + options.projectileRadius + 1, options.projectileSpeed);
        projectiles = [...projectiles, {
            id: `projectile-${weapon.projectileSequence}`,
            position: trajectory.start,
            velocity: trajectory.velocity,
            bornAtActiveMs: clock.activeElapsedMs
        }];
    }
    const collisionShip = resolved.boostedShipImpact === null ? orbitShip : shipAfterBoostedAsteroidImpact(orbitShip, resolved.boostedShipImpact.position, clock.activeElapsedMs);
    return tryLandAtCapturedPlanet({ ...state, clock, markets, ship: collisionShip, planets, planetLifecycle: lifecycle, weapon, projectiles, asteroids: resolved.asteroids }, input.landingRequested === true);
}

function shipAfterBoostedAsteroidImpact (ship: GameStateSnapshot['ship'], asteroidPosition: Readonly<{ x: number; y: number }>, activeElapsedMs: number): GameStateSnapshot['ship']
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
        asteroidControlLockedUntilActiveMs: activeElapsedMs + MOOLARIS_RECOVERY_SECONDS * 1000
    };
}

function resolveAsteroidImpacts (
    motions: ReturnType<typeof advanceAsteroidMotions>, state: GameStateSnapshot, ship: GameStateSnapshot['ship'],
    planets: GameStateSnapshot['planets'], projectiles: readonly ProjectileState[], options: GameSimulationOptions
): { asteroids: GameStateSnapshot['asteroids']; projectiles: readonly ProjectileState[]; boostedShipImpact: AsteroidState | null }
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
            .map(impact => ({ asteroid: motion.asteroid, ...impact }));
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
    let boostedShipImpact: AsteroidState | null = null;
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
        removedAsteroids.add(event.asteroid.id);
        if (event.source.kind === 'ship' && ship.boosting) boostedShipImpact = event.asteroid;
        children.push(...fragmentAsteroid(event.asteroid, event.source));
    }
    for (const event of projectileEvents) {
        if (removedProjectiles.has(event.projectile.id)) continue;
        removedProjectiles.add(event.projectile.id);
        if (event.kind === 'asteroid' && !removedAsteroids.has(event.asteroid.id)) {
            const asteroid = changedAsteroids.get(event.asteroid.id) ?? event.asteroid;
            if (asteroid.hitPoints > 1) changedAsteroids.set(asteroid.id, { ...asteroid, hitPoints: asteroid.hitPoints - 1 });
            else {
                removedAsteroids.add(asteroid.id);
                children.push(...fragmentAsteroid(asteroid, { id: event.projectile.id, kind: 'projectile', position: event.projectile.position }));
            }
        }
    }
    return { asteroids: [...motions.filter(motion => !removedAsteroids.has(motion.asteroid.id)).map(motion => changedAsteroids.get(motion.asteroid.id) ?? motion.asteroid), ...children], projectiles: projectiles.filter(projectile => !removedProjectiles.has(projectile.id)), boostedShipImpact };
}
