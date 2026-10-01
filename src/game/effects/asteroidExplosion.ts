import type { Scene } from 'phaser';
import type { AsteroidState } from '../state/asteroidState';
import type { PlanetState } from '../state/planetState';
import type { ProjectileState } from '../state/projectileState';
import { asteroidTuning } from '../definitions/gameplayTuning';
import { ObjectDepth } from '../visual/layers';

const explosionLifetimeMs = 220;
const explosionRadius = 54;

/** Finds actual parent-to-children transitions; restores and first synchronization have no parent. */
export function fragmentedParents (previous: readonly AsteroidState[], current: readonly AsteroidState[]): readonly AsteroidState[]
{
    const currentIds = new Set(current.map(asteroid => asteroid.id));
    return previous.filter(parent => !currentIds.has(parent.id)
        && current.some(candidate => candidate.id.startsWith(`${parent.id}-fragment-`)));
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
        const flash = this.scene.add.circle(position.x, position.y, 18, 0xff2f2f, 1).setDepth(ObjectDepth.Ship + 1);
        const fire = this.scene.add.circle(position.x, position.y, 9, 0xffa12f, 1).setDepth(ObjectDepth.Ship + 2);
        for (const target of [flash, fire]) this.scene.tweens.add({
            targets: target, scale: target === flash ? 5 : 3, alpha: 0, duration: 420, ease: 'Cubic.Out', onComplete: () => target.destroy()
        });
    }

    readonly destroy = (): void =>
    {
        if (this.destroyed) return;
        this.destroyed = true;
        this.scene.events.off('shutdown', this.destroy, this);
    };
}
