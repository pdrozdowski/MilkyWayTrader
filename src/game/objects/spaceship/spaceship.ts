import { Physics, Scene } from 'phaser';
import { SceneObject } from '../_shared/sceneObject';
import type { ShipState } from '../../state/shipState';
import { definition } from './definition';
import { BoostEffects } from './boostEffects';
import { EngineExhaust } from './engineExhaust';
import { engineExhaustLayout } from './exhaustLayout';

export class Spaceship extends SceneObject
{
    declare readonly body: Physics.Arcade.Body;
    readonly boostEffects: BoostEffects;
    readonly exhaust: EngineExhaust;

    constructor (scene: Scene, state: ShipState)
    {
        super(scene, definition, { ...state.position });
        this.body.setEnable(false);
        this.boostEffects = new BoostEffects(scene);
        this.ownCleanup(() => this.boostEffects.destroy());
        this.exhaust = new EngineExhaust(scene);
        this.ownCleanup(() => this.exhaust.destroy());
        this.synchronize(state, 1, 0);
    }

    synchronize (state: ShipState, engineLevel: number, visualTimeMs: number): void
    {
        super.setPosition(state.position.x, state.position.y);
        this.body.setVelocity(0, 0);
        this.sprite.setRotation(state.rotation);
        const boosting = state.boosting && state.enginesOn;
        this.exhaust.update(visualTimeMs, this.sprite, engineExhaustLayout(engineLevel, false), state.enginesOn && !boosting);
        this.boostEffects.update(visualTimeMs, this.sprite, boosting);
    }

    /** Hides the whole ship presentation: hull, exhaust and boost imagery together. */
    setVisible (visible: boolean): void
    {
        this.sprite.setVisible(visible);
        this.exhaust.setVisible(visible);
        this.boostEffects.setVisible(visible);
    }
}
