import type { AsteroidSize, AsteroidState } from '../../state/asteroidState.ts';
import type { Vector2State } from '../../state/vector2State.ts';
import { asteroidBeltDefinition, asteroidFragmentChildCount, asteroidTuning } from '../../definitions/gameplayTuning.ts';

export interface AsteroidMotion
{
    readonly asteroid: AsteroidState;
    readonly start: Vector2State;
}

export interface AsteroidImpactSource
{
    readonly id: string;
    readonly position: Vector2State;
    readonly kind: 'moolaris' | 'planet' | 'ship' | 'projectile';
}

const fullTurn = Math.PI * 2;

export function asteroidRadius (size: AsteroidSize): number
{
    return asteroidTuning.sizes[size].radius;
}

export function advanceAsteroidMotions (
    asteroids: readonly AsteroidState[], activeElapsedMs: number, activeDeltaMs: number, shipPosition: Vector2State,
    previousShipPosition: Vector2State = shipPosition
): readonly AsteroidMotion[]
{
    return asteroids.flatMap(asteroid => {
        const next = advanceAsteroid(asteroid, activeElapsedMs, activeDeltaMs, shipPosition, previousShipPosition);
        return next === null ? [] : [{ asteroid: next, start: asteroid.position }];
    });
}

function advanceAsteroid (asteroid: AsteroidState, activeElapsedMs: number, activeDeltaMs: number, shipPosition: Vector2State, previousShipPosition: Vector2State): AsteroidState | null
{
    if (asteroid.orbit) {
        const angle = asteroid.orbit.angleRadians + (activeElapsedMs % asteroidBeltDefinition.rotationPeriodMs)
            / asteroidBeltDefinition.rotationPeriodMs * fullTurn;
        const angularVelocity = fullTurn / asteroidBeltDefinition.rotationPeriodMs;
        return {
            ...asteroid,
            position: { x: Math.cos(angle) * asteroid.orbit.radius, y: -Math.sin(angle) * asteroid.orbit.radius },
            velocity: { x: -Math.sin(angle) * asteroid.orbit.radius * angularVelocity * 1000, y: -Math.cos(angle) * asteroid.orbit.radius * angularVelocity * 1000 }
        };
    }
    const position = {
        x: asteroid.position.x + asteroid.velocity.x * activeDeltaMs / 1000,
        y: asteroid.position.y + asteroid.velocity.y * activeDeltaMs / 1000
    };
    if (Math.hypot(position.x, position.y) > asteroidTuning.worldBoundsRadius) return null;
    const outsideSince = outsideSafeAreaSince(asteroid, position, activeElapsedMs, activeDeltaMs, previousShipPosition, shipPosition);
    if (outsideSince !== null && activeElapsedMs - outsideSince >= asteroidTuning.outsideSafeAreaCullAfterMs) return null;
    return { ...asteroid, position, outsideSafeAreaSinceActiveMs: outsideSince };
}

function outsideSafeAreaSince (
    asteroid: AsteroidState, position: Vector2State, activeElapsedMs: number, activeDeltaMs: number,
    previousShipPosition: Vector2State, shipPosition: Vector2State
): number | null
{
    const endX = position.x - shipPosition.x;
    const endY = position.y - shipPosition.y;
    if (Math.hypot(endX, endY) <= asteroidTuning.safeRadius) return null;
    const startX = asteroid.position.x - previousShipPosition.x;
    const startY = asteroid.position.y - previousShipPosition.y;
    const deltaX = endX - startX;
    const deltaY = endY - startY;
    const quadratic = deltaX * deltaX + deltaY * deltaY;
    const linear = 2 * (startX * deltaX + startY * deltaY);
    const constant = startX * startX + startY * startY - asteroidTuning.safeRadius ** 2;
    const discriminant = linear * linear - 4 * quadratic * constant;
    if (quadratic > 0 && discriminant >= 0) {
        const exitTime = (-linear + Math.sqrt(discriminant)) / (2 * quadratic);
        if (exitTime >= 0 && exitTime <= 1) return activeElapsedMs - activeDeltaMs + exitTime * activeDeltaMs;
    }
    return asteroid.outsideSafeAreaSinceActiveMs ?? activeElapsedMs - activeDeltaMs;
}

export function fragmentAsteroid (asteroid: AsteroidState, source: AsteroidImpactSource): readonly AsteroidState[]
{
    if (source.kind === 'moolaris' || asteroid.size === 'small') return [];
    const size: AsteroidSize = asteroid.size === 'big' ? 'medium' : 'small';
    const count = asteroidFragmentChildCount(asteroid.id);
    const baseAngle = source.kind === 'projectile'
        ? hashAngle(asteroid.id)
        : Math.atan2(asteroid.position.y - source.position.y, asteroid.position.x - source.position.x);
    return Array.from({ length: count }, (_, index) => {
        const angle = source.kind === 'projectile'
            ? baseAngle + index / count * asteroidTuning.fragmentDrift.spreadRadians
            : baseAngle + (index - (count - 1) / 2) * Math.PI / Math.max(6, count * 2);
        return {
            id: `${asteroid.id}-fragment-${index + 1}`,
            variant: asteroid.variant,
            size,
            position: { ...asteroid.position },
            velocity: { x: Math.cos(angle) * asteroidTuning.fragmentDrift.speed, y: Math.sin(angle) * asteroidTuning.fragmentDrift.speed },
            orbit: null,
            outsideSafeAreaSinceActiveMs: null
        };
    });
}

function hashAngle (id: string): number
{
    let hash = 2166136261;
    for (const character of id) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
    return (hash >>> 0) / 2 ** 32 * fullTurn;
}
