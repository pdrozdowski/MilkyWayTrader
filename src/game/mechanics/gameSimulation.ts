import type { GameStateSnapshot } from '../state/gameStateSnapshot';
import type { ProjectileState } from '../state/projectileState';
import type { CircleObstacle } from '../world/geometry';
import { projectileTuning, shipBoostTuning, shipTuning, weaponTuning } from '../definitions/gameplayTuning.ts';
import { advanceGameClock } from './clock/gameClock.ts';
import { segmentHitsCircle, shotTrajectory } from './projectile/trajectory.ts';
import { advanceFireCadence } from './spaceship/fireCadence.ts';
import { boostAccelerationRate, directionRotation, flightVelocity } from './spaceship/flight.ts';

export interface GameSimulationInput
{
    readonly target: Readonly<{ x: number; y: number }> | null;
    readonly boostRequested: boolean;
    readonly firing: boolean;
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
        if (options.obstacles.some(obstacle => segmentHitsCircle(projectile.position, next, obstacle, options.projectileRadius))) return [];
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

    const targetDelta = input.target ? {
        x: input.target.x - state.ship.position.x,
        y: input.target.y - state.ship.position.y
    } : null;
    const currentSpeed = Math.hypot(state.ship.velocity.x, state.ship.velocity.y);
    const wantsBoost = input.boostRequested && !!targetDelta && Math.hypot(targetDelta.x, targetDelta.y) > 2;
    const boostAcceleration = wantsBoost && !state.ship.boosting
        ? boostAccelerationRate(currentSpeed, shipTuning.maxSpeed, shipBoostTuning.speedMultiplier, shipBoostTuning.accelerationSeconds)
            || shipTuning.maxSpeed * (shipBoostTuning.speedMultiplier - 1) / shipBoostTuning.accelerationSeconds
        : state.ship.boostAcceleration;
    const coastDeceleration = !targetDelta && state.ship.enginesOn
        ? Math.max(shipTuning.maxSpeed, currentSpeed) / shipTuning.stoppingSeconds
        : state.ship.coastDeceleration;
    const movementSeconds = Math.min(activeDeltaMs, 100) / 1000;
    const velocity = flightVelocity(state.ship.velocity, targetDelta, movementSeconds, {
        ...shipTuning,
        maxSpeed: shipTuning.maxSpeed * (wantsBoost ? shipBoostTuning.speedMultiplier : 1),
        accelerationRate: wantsBoost ? boostAcceleration : shipTuning.maxSpeed / shipTuning.accelerationSeconds,
        decelerationRate: !targetDelta ? coastDeceleration : shipTuning.maxSpeed * (shipBoostTuning.speedMultiplier - 1) / shipBoostTuning.accelerationSeconds
    });
    const ship = {
        ...state.ship,
        position: {
            x: state.ship.position.x + velocity.x * movementSeconds,
            y: state.ship.position.y + velocity.y * movementSeconds
        },
        velocity: { x: velocity.x, y: velocity.y },
        rotation: directionRotation(velocity.x, velocity.y, state.ship.rotation),
        enginesOn: velocity.enginesOn,
        boosting: wantsBoost,
        boostAcceleration,
        coastDeceleration
    };

    let projectiles = advanceProjectiles(state.projectiles, clock.activeElapsedMs, activeDeltaMs, options);
    const cadence = advanceFireCadence(state.weapon, clock.activeElapsedMs, input.firing && !ship.boosting, options.shotIntervalMs);
    let weapon = cadence.weapon;
    if (cadence.fired) {
        const trajectory = shotTrajectory(ship.position, ship.rotation, options.muzzleOffset + options.projectileRadius + 1, options.projectileSpeed);
        const sequence = weapon.projectileSequence + 1;
        projectiles = [...projectiles, {
            id: `projectile-${sequence}`,
            position: trajectory.start,
            velocity: trajectory.velocity,
            bornAtActiveMs: clock.activeElapsedMs
        }];
        weapon = { ...weapon, projectileSequence: sequence };
    }
    return { ...state, clock, ship, weapon, projectiles };
}
