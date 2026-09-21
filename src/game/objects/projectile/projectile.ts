import { Math as PhaserMath, Scene } from 'phaser';
import { SceneObject } from '../_shared/sceneObject';
import type { ProjectileState } from '../../state/projectileState';
import { definition } from './definition';

export class Projectile extends SceneObject
{
    readonly id: string;
    private readonly velocity = new PhaserMath.Vector2();

    constructor (scene: Scene, state: ProjectileState)
    {
        super(scene, definition, { ...state.position });
        this.id = state.id;
        this.synchronize(state);
    }

    synchronize (state: ProjectileState): void
    {
        super.setPosition(state.position.x, state.position.y);
        this.velocity.set(state.velocity.x, state.velocity.y);
        this.sprite.setRotation(this.velocity.angle() + Math.PI / 2);
    }
}
