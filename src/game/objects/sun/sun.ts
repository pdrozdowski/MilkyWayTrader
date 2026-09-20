import { GameObjects, Scene } from 'phaser';
import { SceneObject } from '../_shared/sceneObject';
import { ObjectDepth } from '../../visual/layers';
import type { SceneObjectOptions } from '../_shared/types';
import { definition } from './definition';

interface Bubble {
    xRatio: number;
    radiusRatio: number;
    phase: number;
    speed: number;
    swayPhase: number;
}

const BUBBLE_COUNT = 96;

export class Sun extends SceneObject
{
    readonly atmosphere: GameObjects.Graphics;
    readonly bubbles: GameObjects.Graphics;
    private readonly bubbleLayout: Bubble[];
    private atmosphereState = '';

    constructor (scene: Scene, options: SceneObjectOptions)
    {
        super(scene, definition, options);
        this.atmosphere = scene.add.graphics().setDepth(ObjectDepth.Sun - 1);
        this.bubbles = scene.add.graphics().setDepth(ObjectDepth.SunSurface);
        this.bubbleLayout = Array.from({ length: BUBBLE_COUNT }, (_, index) => ({
            xRatio: pseudoRandom(index, 1) * 1.92 - 0.96,
            radiusRatio: 0.012 + pseudoRandom(index, 2) * 0.025,
            phase: pseudoRandom(index, 3),
            speed: 0.000025 + pseudoRandom(index, 4) * 0.00003,
            swayPhase: pseudoRandom(index, 5) * Math.PI * 2
        }));
        this.drawAtmosphere();
        this.ownCleanup(() => this.atmosphere.destroy());
        this.ownCleanup(() => this.bubbles.destroy());
    }

    update (time: number, _delta: number): void
    {
        this.drawAtmosphere();
        const view = this.scene.cameras.main.worldView;
        const nearestX = Math.max(view.left, Math.min(this.sprite.x, view.right));
        const nearestY = Math.max(view.top, Math.min(this.sprite.y, view.bottom));
        const visible = Math.hypot(nearestX - this.sprite.x, nearestY - this.sprite.y) <= this.radius + 100;
        this.atmosphere.setVisible(visible);
        this.bubbles.setVisible(visible);
        if (!visible) return;
        this.bubbles.clear().setPosition(this.sprite.x, this.sprite.y);
        for (const bubble of this.bubbleLayout) {
            const bubbleRadius = this.radius * bubble.radiusRatio;
            const innerRadius = this.radius - bubbleRadius - 2;
            const sway = Math.sin(time * 0.0007 + bubble.swayPhase) * this.radius * 0.012;
            const x = Math.max(-innerRadius, Math.min(innerRadius, bubble.xRatio * innerRadius + sway));
            const verticalLimit = Math.sqrt(Math.max(0, innerRadius * innerRadius - x * x));
            const cycle = (bubble.phase + time * bubble.speed) % 1;
            const y = verticalLimit - cycle * verticalLimit * 2;
            this.bubbles.fillStyle(0xffa33a, 0.14).fillCircle(x, y, bubbleRadius * 1.45);
            this.bubbles.fillStyle(0xe86616, 0.52).fillCircle(x, y, bubbleRadius);
            this.bubbles.lineStyle(Math.max(2, bubbleRadius * 0.08), 0xffd06a, 0.7)
                .strokeCircle(x, y, bubbleRadius * 0.82);
        }
    }

    private drawAtmosphere (): void
    {
        const state = `${this.sprite.x}:${this.sprite.y}:${this.radius}`;
        if (state === this.atmosphereState) return;
        this.atmosphereState = state;
        this.atmosphere.clear().setPosition(this.sprite.x, this.sprite.y);
        for (let halo = 8; halo >= 1; halo--) this.atmosphere.fillStyle(0xffd65a, 0.055)
            .fillCircle(0, 0, this.radius + halo * 10);
    }
}

function pseudoRandom(index: number, salt: number): number
{
    const value = Math.sin(index * 91.345 + salt * 47.853) * 43758.5453;
    return value - Math.floor(value);
}
