import { Physics, Scene } from 'phaser';
import { SceneObject } from '../_shared/sceneObject';
import type { SceneObjectOptions } from '../_shared/types';
import { definition, shipBoostTuning, shipEngineAnimation, shipFrames, shipTuning } from './definition';
import { boostAccelerationRate, directionRotation, flightVelocity } from '../../mechanics/spaceship/flight';
import { BoostEffects } from './boostEffects';

export class Spaceship extends SceneObject
{
    declare readonly body: Physics.Arcade.Body;
    private target: { x: number; y: number } | null = null;
    enginesOn = false;
    boosting = false;
    readonly boostEffects: BoostEffects;
    private boostRequested = false;
    private boostAcceleration = 0;
    private coastDeceleration = shipTuning.maxSpeed / shipTuning.stoppingSeconds;

    constructor (scene: Scene, options: SceneObjectOptions)
    {
        super(scene, definition, options);
        this.boostEffects = new BoostEffects(scene);
        this.ownCleanup(() => this.boostEffects.destroy());
    }

    setBoostRequested (requested: boolean): void
    {
        this.boostRequested = requested;
    }

    setTarget (target: { x: number; y: number } | null): void
    {
        this.target = target;
    }

    update (time: number, delta: number): void
    {
        const targetDelta = this.target ? { x: this.target.x - this.sprite.x, y: this.target.y - this.sprite.y } : null;
        const speed = this.body.velocity.length();
        const wantsBoost = this.boostRequested && !!targetDelta && Math.hypot(targetDelta.x, targetDelta.y) > 2;
        if (wantsBoost && !this.boosting) {
            this.boostAcceleration = boostAccelerationRate(speed, shipTuning.maxSpeed, shipBoostTuning.speedMultiplier, shipBoostTuning.accelerationSeconds)
                || shipTuning.maxSpeed * (shipBoostTuning.speedMultiplier - 1) / shipBoostTuning.accelerationSeconds;
        }
        if (!targetDelta && this.enginesOn) this.coastDeceleration = Math.max(shipTuning.maxSpeed, speed) / shipTuning.stoppingSeconds;
        this.boosting = wantsBoost;
        const velocity = flightVelocity(this.body.velocity, targetDelta, Math.min(delta, 100) / 1000, {
            ...shipTuning,
            maxSpeed: shipTuning.maxSpeed * (this.boosting ? shipBoostTuning.speedMultiplier : 1),
            accelerationRate: this.boosting ? this.boostAcceleration : shipTuning.maxSpeed / shipTuning.accelerationSeconds,
            decelerationRate: !targetDelta ? this.coastDeceleration : (shipTuning.maxSpeed * (shipBoostTuning.speedMultiplier - 1) / shipBoostTuning.accelerationSeconds)
        });
        this.body.setVelocity(velocity.x, velocity.y);
        this.enginesOn = velocity.enginesOn;
        if (this.enginesOn && !this.boosting) this.sprite.play(shipEngineAnimation, true);
        else {
            this.sprite.anims.stop();
            if (this.sprite.texture.key !== shipFrames.off.key) this.sprite.setTexture(shipFrames.off.key);
        }
        this.sprite.setRotation(directionRotation(velocity.x, velocity.y, this.sprite.rotation));
        this.boostEffects.update(time, this.sprite, this.boosting && this.enginesOn);
    }
}
