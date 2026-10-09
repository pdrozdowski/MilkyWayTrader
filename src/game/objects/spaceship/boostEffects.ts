import { GameObjects, Scene } from 'phaser';
import { ObjectDepth } from '../../visual/layers';
import { shipBoostTuning } from './definition';
import { engineExhaustLayout, engineFlamePulseLength } from './exhaustLayout';

interface WingSample {
    time: number;
    left: { x: number; y: number };
    right: { x: number; y: number };
}

export class BoostEffects
{
    readonly flames: GameObjects.Graphics;
    readonly trails: GameObjects.Graphics;
    private samples: WingSample[] = [];
    private readonly boostPipes = engineExhaustLayout(1, true);
    private visible = true;

    constructor (scene: Scene)
    {
        this.flames = scene.add.graphics().setDepth(ObjectDepth.Ship - 1);
        this.trails = scene.add.graphics().setDepth(ObjectDepth.Ship - 1);
    }

    update (time: number, sprite: GameObjects.Sprite, active: boolean): void
    {
        const burning = active && this.visible;
        this.flames.clear().setVisible(burning).setPosition(sprite.x, sprite.y)
            .setRotation(sprite.rotation).setScale(sprite.scaleX);
        if (burning) {
            const length = engineFlamePulseLength(time) * this.boostPipes[0].lengthMultiplier;
            for (const { x } of this.boostPipes) {
                this.flames.fillStyle(shipBoostTuning.flameColor, 0.12).fillTriangle(x - 5, 18, x + 5, 18, x, 18 + length);
                this.flames.fillStyle(shipBoostTuning.flameColor, 0.9).fillTriangle(x - 3, 18, x + 3, 18, x, 18 + length);
                this.flames.fillStyle(0xe2fbff, 1).fillTriangle(x - 1.4, 18, x + 1.4, 18, x, 18 + length * 0.75);
            }
            const wing = (x: number) => ({
                x: sprite.x + (x * Math.cos(sprite.rotation) - 14 * Math.sin(sprite.rotation)) * sprite.scaleX,
                y: sprite.y + (x * Math.sin(sprite.rotation) + 14 * Math.cos(sprite.rotation)) * sprite.scaleX
            });
            this.samples.push({ time, left: wing(-19), right: wing(19) });
        }
        this.samples = this.samples.filter(sample => time - sample.time <= shipBoostTuning.trailLifetime);
        this.trails.clear();
        for (let index = 1; index < this.samples.length; index++) {
            const previous = this.samples[index - 1];
            const current = this.samples[index];
            // A resumed boost starts new trails instead of bridging the coasting interval.
            if (current.time - previous.time > 100) continue;
            const alpha = (1 - (time - previous.time) / shipBoostTuning.trailLifetime) * 0.65;
            for (const side of ['left', 'right'] as const) {
                this.trails.lineStyle(6, shipBoostTuning.flameColor, alpha * 0.1)
                    .lineBetween(previous[side].x, previous[side].y, current[side].x, current[side].y);
                this.trails.lineStyle(1.5, shipBoostTuning.flameColor, alpha)
                    .lineBetween(previous[side].x, previous[side].y, current[side].x, current[side].y);
            }
        }
    }

    /** Hides the boosted flame and its wing trails with the hull, for example once the ship is destroyed. */
    setVisible (visible: boolean): void
    {
        this.visible = visible;
        this.flames.setVisible(false);
        this.trails.setVisible(visible);
    }

    destroy (): void
    {
        this.samples = [];
        this.flames.destroy();
        this.trails.destroy();
    }
}
