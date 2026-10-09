import { GameObjects, Scene } from 'phaser';
import { ObjectDepth } from '../../visual/layers';
import { shipFrames } from './definition';
import { engineFlamePulseLength } from './exhaustLayout';
import type { EngineExhaustPipe, EngineFlameVariant } from './exhaustLayout';

// Nozzle geometry copied from the hull artwork, in unscaled ship-local pixels with the nose up.
const nozzleWidth = 6;
const nozzleHeight = 8;
const nozzleTop = 10;
const nozzleMouthY = 17;
const flameMouthY = 18;
const flameWidth = 6;

const flameKeyByVariant: Readonly<Record<EngineFlameVariant, string>> = {
    normal: shipFrames.flameNormal.key,
    hot: shipFrames.flameHot.key,
    boost: shipFrames.flameHot.key
};

/** Draws the ship's nozzles and their pulsing flames for the current engine layout. */
export class EngineExhaust
{
    private readonly nozzles: GameObjects.Graphics;
    private readonly flames: GameObjects.Image[] = [];

    constructor (private readonly scene: Scene)
    {
        this.nozzles = scene.add.graphics().setDepth(ObjectDepth.Ship + 0.5);
    }

    update (time: number, sprite: GameObjects.Sprite, pipes: readonly EngineExhaustPipe[], burning: boolean): void
    {
        this.nozzles.clear().setPosition(sprite.x, sprite.y).setRotation(sprite.rotation).setScale(sprite.scaleX);
        for (const pipe of pipes) {
            this.nozzles.fillStyle(0x335777, 1).fillRoundedRect(pipe.x - nozzleWidth / 2, nozzleTop, nozzleWidth, nozzleHeight, 1);
            this.nozzles.lineStyle(1, 0x182e4b, 1).strokeRoundedRect(pipe.x - nozzleWidth / 2, nozzleTop, nozzleWidth, nozzleHeight, 1);
            this.nozzles.lineStyle(1.5, 0x9dcce4, 1).lineBetween(pipe.x - nozzleWidth / 2, nozzleMouthY, pipe.x + nozzleWidth / 2, nozzleMouthY);
        }
        const pulse = engineFlamePulseLength(time);
        pipes.forEach((pipe, index) => {
            const flame = this.flame(index);
            const length = pipe.lengthMultiplier * pulse;
            flame.setTexture(flameKeyByVariant[pipe.variant])
                .setOrigin(0.5, 0)
                .setRotation(sprite.rotation)
                .setPosition(
                    sprite.x + (pipe.x * Math.cos(sprite.rotation) - flameMouthY * Math.sin(sprite.rotation)) * sprite.scaleX,
                    sprite.y + (pipe.x * Math.sin(sprite.rotation) + flameMouthY * Math.cos(sprite.rotation)) * sprite.scaleX
                )
                .setDisplaySize(flameWidth * sprite.scaleX, length * sprite.scaleX)
                .setVisible(burning);
        });
        for (let index = pipes.length; index < this.flames.length; index++) this.flames[index].setVisible(false);
    }

    destroy (): void
    {
        this.nozzles.destroy();
        for (const flame of this.flames) flame.destroy();
        this.flames.length = 0;
    }

    private flame (index: number): GameObjects.Image
    {
        const existing = this.flames[index];
        if (existing) return existing;
        const flame = this.scene.add.image(0, 0, shipFrames.flameNormal.key).setDepth(ObjectDepth.Ship - 1);
        this.flames[index] = flame;
        return flame;
    }
}
