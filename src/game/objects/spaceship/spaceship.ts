import { Physics, Scene } from 'phaser';
import { SceneObject } from '../_shared/sceneObject';
import type { ShipState } from '../../state/shipState';
import { definition, shipEngineAnimation, shipFrames } from './definition';
import { BoostEffects } from './boostEffects';

export class Spaceship extends SceneObject
{
    declare readonly body: Physics.Arcade.Body;
    readonly boostEffects: BoostEffects;

    constructor (scene: Scene, state: ShipState)
    {
        super(scene, definition, { ...state.position });
        this.body.setEnable(false);
        this.boostEffects = new BoostEffects(scene);
        this.ownCleanup(() => this.boostEffects.destroy());
        this.synchronize(state, 0);
    }

    synchronize (state: ShipState, visualTimeMs: number): void
    {
        super.setPosition(state.position.x, state.position.y);
        this.body.setVelocity(0, 0);
        this.sprite.setRotation(state.rotation);
        if (state.enginesOn && !state.boosting) this.sprite.play(shipEngineAnimation, true);
        else {
            this.sprite.anims.stop();
            if (this.sprite.texture.key !== shipFrames.off.key) this.sprite.setTexture(shipFrames.off.key);
        }
        this.boostEffects.update(visualTimeMs, this.sprite, state.boosting && state.enginesOn);
    }
}
