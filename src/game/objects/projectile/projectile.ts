import { Scene } from 'phaser';
import { SceneObject } from '../_shared/sceneObject';
import type { SceneObjectOptions } from '../_shared/types';
import type { CircleObstacle } from '../../world/geometry';
import { definition, projectileTuning } from './definition';
import { segmentHitsCircle } from '../../mechanics/projectile/trajectory';

interface ProjectileOptions extends SceneObjectOptions {
    velocity: { x: number; y: number };
    bornAt: number;
    onDestroy: () => void;
}

export class Projectile extends SceneObject
{
    alive = true;
    readonly velocity: Readonly<{ x: number; y: number }>;
    readonly bornAt: number;

    constructor (scene: Scene, options: ProjectileOptions)
    {
        super(scene, definition, options);
        this.velocity = Object.freeze({ ...options.velocity });
        this.bornAt = options.bornAt;
        this.sprite.setRotation(Math.atan2(this.velocity.y, this.velocity.x) + Math.PI / 2);
        this.ownCleanup(options.onDestroy);
    }

    advance (time: number, delta: number, obstacles: readonly CircleObstacle[]): void
    {
        if (!this.alive) return;
        if (time - this.bornAt >= projectileTuning.lifetime) {
            this.destroy();
            return;
        }
        const next = { x: this.sprite.x + this.velocity.x * delta / 1000, y: this.sprite.y + this.velocity.y * delta / 1000 };
        if (obstacles.some(obstacle => segmentHitsCircle(this.sprite, next, obstacle, projectileTuning.radius))) this.destroy();
        else this.sprite.setPosition(next.x, next.y);
    }

    destroy (): void
    {
        if (!this.alive) return;
        this.alive = false;
        super.destroy();
    }
}
