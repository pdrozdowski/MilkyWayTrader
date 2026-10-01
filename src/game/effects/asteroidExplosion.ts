import type { Scene } from 'phaser';
import type { AsteroidState } from '../state/asteroidState';
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

    readonly destroy = (): void =>
    {
        if (this.destroyed) return;
        this.destroyed = true;
        this.scene.events.off('shutdown', this.destroy, this);
    };
}
