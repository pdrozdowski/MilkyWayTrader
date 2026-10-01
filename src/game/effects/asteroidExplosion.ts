import type { Scene } from 'phaser';
import type { AsteroidState } from '../state/asteroidState';
import type { PlanetState } from '../state/planetState';
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
        Math.hypot(parent.position.x - planet.position.x, parent.position.y - planet.position.y) <= planet.radius));
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
        const flash = this.scene.add.circle(position.x, position.y, 7, 0xfff1b0, 0.92).setDepth(ObjectDepth.Planet + 0.5);
        const ring = this.scene.add.circle(position.x, position.y, 8).setStrokeStyle(3, 0xff9d42, 0.9).setDepth(ObjectDepth.Planet + 0.5);
        this.scene.tweens.add({
            targets: flash,
            scale: 6,
            alpha: 0,
            duration: 260,
            ease: 'Cubic.Out',
            onComplete: () => flash.destroy()
        });
        this.scene.tweens.add({
            targets: ring,
            scale: 5,
            alpha: 0,
            duration: 320,
            ease: 'Cubic.Out',
            onComplete: () => ring.destroy()
        });
    }

    readonly destroy = (): void =>
    {
        if (this.destroyed) return;
        this.destroyed = true;
        this.scene.events.off('shutdown', this.destroy, this);
    };
}
