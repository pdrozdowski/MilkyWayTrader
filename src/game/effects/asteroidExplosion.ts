import type { Scene } from 'phaser';
import type { AsteroidState } from '../state/asteroidState';
import type { PlanetState } from '../state/planetState';
import type { ProjectileState } from '../state/projectileState';
import { asteroidTuning } from '../definitions/gameplayTuning';
import { moolarisDefinition } from '../definitions/moolarisDefinition';
import { ObjectDepth } from '../visual/layers';
import { sweptCircleIntersection } from '../world/geometry';

const explosionLifetimeMs = 220;
const explosionRadius = 54;

/** Finds actual parent-to-children transitions; restores and first synchronization have no parent. */
export function fragmentedParents (previous: readonly AsteroidState[], current: readonly AsteroidState[]): readonly AsteroidState[]
{
    const currentIds = new Set(current.map(asteroid => asteroid.id));
    return previous.filter(parent => !currentIds.has(parent.id)
        && current.some(candidate => candidate.id.startsWith(`${parent.id}-fragment-`)));
}

/** Children begin at the committed collision point; use it for one-shot feedback rather than the prior-frame parent position. */
export function fragmentImpactPosition (parent: AsteroidState, current: readonly AsteroidState[]): Readonly<{ x: number; y: number }>
{
    return current.find(candidate => candidate.id.startsWith(`${parent.id}-fragment-`))?.position ?? parent.position;
}

/** A parent can only be classified after its authoritative removal and children are committed. */
export function planetImpactParents (
    previous: readonly AsteroidState[], current: readonly AsteroidState[], planets: readonly PlanetState[]
): readonly AsteroidState[]
{
    return fragmentedParents(previous, current).filter(parent => planets.some(planet =>
        Math.hypot(parent.position.x - planet.position.x, parent.position.y - planet.position.y)
            <= planet.radius + asteroidTuning.sizes[parent.size].radius));
}

/** SMALL asteroids have no children, so their planet impact is identified from committed removal at the surface. */
export function planetImpactSmallAsteroids (
    previous: readonly AsteroidState[], current: readonly AsteroidState[], planets: readonly PlanetState[]
): readonly AsteroidState[]
{
    const currentIds = new Set(current.map(asteroid => asteroid.id));
    return previous.filter(asteroid => asteroid.size === 'small' && !currentIds.has(asteroid.id)
        && planets.some(planet => Math.hypot(asteroid.position.x - planet.position.x, asteroid.position.y - planet.position.y)
            <= planet.radius + asteroidTuning.sizes.small.radius));
}

/** A SMALL asteroid has no children, so pair its committed removal with a consumed shot. */
export function projectileDestroyedSmallAsteroids (
    previous: readonly AsteroidState[], current: readonly AsteroidState[], previousProjectiles: readonly ProjectileState[], currentProjectiles: readonly ProjectileState[]
): readonly AsteroidState[]
{
    const currentIds = new Set(current.map(asteroid => asteroid.id));
    const currentProjectileIds = new Set(currentProjectiles.map(projectile => projectile.id));
    const consumedShot = previousProjectiles.some(projectile => !currentProjectileIds.has(projectile.id));
    return consumedShot ? previous.filter(asteroid => asteroid.size === 'small' && !currentIds.has(asteroid.id)) : [];
}

export function projectileDamagedAsteroids (previous: readonly AsteroidState[], current: readonly AsteroidState[]): readonly AsteroidState[]
{
    const currentById = new Map(current.map(asteroid => [asteroid.id, asteroid]));
    return previous.filter(asteroid => (currentById.get(asteroid.id)?.hitPoints ?? asteroid.hitPoints) < asteroid.hitPoints);
}

/** Locates each committed projectile hit from the same swept paths used by the simulation. */
export function projectileImpactPositions (
    previous: readonly AsteroidState[], current: readonly AsteroidState[], previousProjectiles: readonly ProjectileState[], currentProjectiles: readonly ProjectileState[], activeDeltaMs: number, projectileRadius: number
): readonly Readonly<{ x: number; y: number }>[]
{
    const currentIds = new Set(current.map(asteroid => asteroid.id));
    const affected = previous.filter(asteroid => !currentIds.has(asteroid.id)
        || (current.find(candidate => candidate.id === asteroid.id)?.hitPoints ?? asteroid.hitPoints) < asteroid.hitPoints);
    const activeProjectileIds = new Set(currentProjectiles.map(projectile => projectile.id));
    return previousProjectiles.flatMap(projectile => {
        if (activeProjectileIds.has(projectile.id)) return [];
        const end = {
            x: projectile.position.x + projectile.velocity.x * activeDeltaMs / 1000,
            y: projectile.position.y + projectile.velocity.y * activeDeltaMs / 1000
        };
        const hit = affected.map(asteroid => {
            const currentAsteroid = current.find(candidate => candidate.id === asteroid.id);
            const asteroidEnd = currentAsteroid?.position ?? {
                x: asteroid.position.x + asteroid.velocity.x * activeDeltaMs / 1000,
                y: asteroid.position.y + asteroid.velocity.y * activeDeltaMs / 1000
            };
            const time = sweptCircleIntersection(
                { id: projectile.id, start: projectile.position, end, radius: projectileRadius },
                { id: asteroid.id, start: asteroid.position, end: asteroidEnd, radius: asteroidTuning.sizes[asteroid.size].radius }
            );
            return time === null ? null : { time, position: {
                x: projectile.position.x + (end.x - projectile.position.x) * time,
                y: projectile.position.y + (end.y - projectile.position.y) * time
            } };
        }).filter((candidate): candidate is { time: number; position: Readonly<{ x: number; y: number }> } => candidate !== null)
            .sort((left, right) => left.time - right.time)[0];
        return hit ? [hit.position] : [];
    });
}

export function sunConsumedAsteroids (previous: readonly AsteroidState[], current: readonly AsteroidState[]): readonly AsteroidState[]
{
    const currentIds = new Set(current.map(asteroid => asteroid.id));
    return previous.filter(asteroid => !currentIds.has(asteroid.id)
        && Math.hypot(asteroid.position.x - moolarisDefinition.position.x, asteroid.position.y - moolarisDefinition.position.y)
            <= moolarisDefinition.radius * asteroidTuning.starIngestionRadiusFactor);
}

/** Transient scene effect. It deliberately has no link to persisted asteroid state. */
export class AsteroidExplosion
{
    private destroyed = false;

    constructor (private readonly scene: Scene)
    {
        scene.events.once('shutdown', this.destroy, this);
    }

    explode (position: Readonly<{ x: number; y: number }>): void
    {
        if (this.destroyed) return;
        const burst = this.scene.add.circle(position.x, position.y, 8, 0xffc56b, 0.9).setDepth(ObjectDepth.AsteroidEffect);
        this.scene.tweens.add({
            targets: burst,
            scale: explosionRadius / 8,
            alpha: 0,
            duration: explosionLifetimeMs,
            ease: 'Cubic.Out',
            onComplete: () => burst.destroy()
        });
    }

    /** A half-size version of the asteroid breakup ring for a projectile contact. */
    explodeProjectileImpact (position: Readonly<{ x: number; y: number }>): void
    {
        if (this.destroyed) return;
        const burst = this.scene.add.circle(position.x, position.y, 4, 0xffc56b, 0.9).setDepth(ObjectDepth.AsteroidEffect);
        this.scene.tweens.add({
            targets: burst,
            scale: explosionRadius / 2 / 4,
            alpha: 0,
            duration: explosionLifetimeMs,
            ease: 'Cubic.Out',
            onComplete: () => burst.destroy()
        });
    }

    /** Red breakup ring for a destroyed orbital cargo container. */
    explodeCargoDestroyed (position: Readonly<{ x: number; y: number }>): void
    {
        if (this.destroyed) return;
        const burst = this.scene.add.circle(position.x, position.y, 8, 0xff1616, 0.9).setDepth(ObjectDepth.AsteroidEffect);
        this.scene.tweens.add({
            targets: burst,
            scale: explosionRadius / 8,
            alpha: 0,
            duration: explosionLifetimeMs,
            ease: 'Cubic.Out',
            onComplete: () => burst.destroy()
        });
    }

    /** Yellow breakup ring for a loose item consumed by the sun. */
    explodeSunConsumedLooseItem (position: Readonly<{ x: number; y: number }>): void
    {
        if (this.destroyed) return;
        const burst = this.scene.add.circle(position.x, position.y, 8, 0xfff1b0, 0.9).setDepth(ObjectDepth.AsteroidEffect);
        this.scene.tweens.add({
            targets: burst,
            scale: explosionRadius / 8,
            alpha: 0,
            duration: explosionLifetimeMs,
            repeat: 2,
            ease: 'Cubic.Out',
            onComplete: () => burst.destroy()
        });
    }

    /** Compact surface flash used only for the committed asteroid-planet impact transition. */
    explodePlanetImpact (position: Readonly<{ x: number; y: number }>): void
    {
        if (this.destroyed) return;
        const flash = this.scene.add.circle(position.x, position.y, 13, 0xfff1b0, 1).setDepth(ObjectDepth.AsteroidEffect);
        const ring = this.scene.add.circle(position.x, position.y, 16).setStrokeStyle(5, 0xff5a36, 1).setDepth(ObjectDepth.AsteroidEffect);
        this.scene.tweens.add({
            targets: flash,
            scale: 9,
            alpha: 0,
            duration: 360,
            ease: 'Cubic.Out',
            onComplete: () => flash.destroy()
        });
        this.scene.tweens.add({
            targets: ring,
            scale: 7,
            alpha: 0,
            duration: 440,
            ease: 'Cubic.Out',
            onComplete: () => ring.destroy()
        });
    }

    explodeShipCrash (position: Readonly<{ x: number; y: number }>): void
    {
        if (this.destroyed) return;
        const flash = this.scene.add.circle(position.x, position.y, 28, 0xff1616, 1).setDepth(ObjectDepth.Ship + 1);
        const fire = this.scene.add.circle(position.x, position.y, 16, 0xff6b12, 1).setDepth(ObjectDepth.Ship + 2);
        for (const target of [flash, fire]) this.scene.tweens.add({
            targets: target, scale: target === flash ? 6 : 4, alpha: 0, duration: 520, ease: 'Cubic.Out', onComplete: () => target.destroy()
        });
    }

    readonly destroy = (): void =>
    {
        if (this.destroyed) return;
        this.destroyed = true;
        this.scene.events.off('shutdown', this.destroy, this);
    };
}
