import { Curves, GameObjects, Math as PhaserMath, Scene } from 'phaser';
import { SceneObject } from '../_shared/sceneObject';
import { ObjectDepth } from '../../visual/layers';
import type { SceneObjectOptions } from '../_shared/types';
import { definition } from './definition';
import { moolarisDefinition } from '../../definitions/moolarisDefinition';
import { activeTimeWave } from '../../visual/activeTime';

interface SurfaceSpot {
    angle: number;
    distanceRatio: number;
    radiusRatio: number;
    stretch: number;
    phase: number;
}

const SURFACE_SPOT_COUNT = 84;
const PLASMA_ARC_COUNT = 7;
const PLASMA_PERIOD_MS = 2600;

export class Sun extends SceneObject
{
    readonly atmosphere: GameObjects.Graphics;
    readonly surface: GameObjects.Graphics;
    readonly plasma: GameObjects.Graphics;
    readonly label: GameObjects.Text;

    private readonly surfaceLayout: SurfaceSpot[];
    private readonly labelDirection = new PhaserMath.Vector2();
    private atmosphereState = '';

    constructor (scene: Scene, options: SceneObjectOptions)
    {
        super(scene, definition, options);

        // Vector-only sun: hide the inherited bitmap so a huge star never pixelates.
        this.sprite.setVisible(false);

        this.atmosphere = scene.add.graphics().setDepth(ObjectDepth.Sun - 1);
        this.surface = scene.add.graphics().setDepth(ObjectDepth.SunSurface);
        this.plasma = scene.add.graphics().setDepth(ObjectDepth.SunSurface + 1);

        this.label = scene.add.text(this.sprite.x, this.sprite.y, moolarisDefinition.name, {
            fontFamily: 'Arial', fontSize: 20, color: '#ffffff', align: 'center',
            stroke: '#431300', strokeThickness: 6
        }).setOrigin(0.5).setDepth(ObjectDepth.Indicator);

        this.surfaceLayout = Array.from({ length: SURFACE_SPOT_COUNT }, (_, index) => ({
            angle: pseudoRandom(index, 1) * Math.PI * 2,
            distanceRatio: Math.sqrt(pseudoRandom(index, 2)) * 0.91,
            radiusRatio: 0.016 + pseudoRandom(index, 3) * 0.030,
            stretch: 0.65 + pseudoRandom(index, 4) * 0.75,
            phase: pseudoRandom(index, 5) * Math.PI * 2
        }));

        // The base sprite remains the sun disk. Everything here is deliberately
        // just circles / ellipses / one curve: cheap, readable and easy to tune.
        this.drawAtmosphere();

        this.ownCleanup(() => this.atmosphere.destroy());
        this.ownCleanup(() => this.surface.destroy());
        this.ownCleanup(() => this.plasma.destroy());
        this.ownCleanup(() => this.label.destroy());
    }

    synchronize (activeElapsedMs: number, shipPosition: Readonly<{ x: number; y: number }>): void
    {
        this.drawAtmosphere();

        const view = this.scene.cameras.main.worldView;
        const nearestX = Math.max(view.left, Math.min(this.sprite.x, view.right));
        const nearestY = Math.max(view.top, Math.min(this.sprite.y, view.bottom));
        const visible = Math.hypot(nearestX - this.sprite.x, nearestY - this.sprite.y) <= this.radius + 140;

        this.atmosphere.setVisible(visible);
        this.surface.setVisible(visible);
        this.plasma.setVisible(visible);

        this.labelDirection.set(shipPosition.x - this.sprite.x, shipPosition.y - this.sprite.y);
        const shipDistance = this.labelDirection.length();
        this.label.setVisible(shipDistance <= this.radius + 200);
        if (this.labelDirection.lengthSq() === 0) this.labelDirection.set(1, 0);
        this.labelDirection.normalize();
        this.label.setPosition(
            this.sprite.x + this.labelDirection.x * (this.radius - 160),
            this.sprite.y + this.labelDirection.y * (this.radius - 160)
        );

        if (!visible) return;

        this.drawSurface(activeElapsedMs);
        this.drawPlasma(activeElapsedMs);
    }

    private drawSurface (activeElapsedMs: number): void
    {
        this.surface.clear().setPosition(this.sprite.x, this.sprite.y);

        // A few large translucent spots instead of dozens of tiny bubbles.
        // They barely drift and breathe, which is enough to make the disk feel alive.
        for (const spot of this.surfaceLayout) {
            const drift = activeTimeWave(spot.phase, 0.00010, activeElapsedMs);
            const breathe = 1 + activeTimeWave(spot.phase + 1.7, 0.00016, activeElapsedMs) * 0.08;
            const angle = spot.angle + drift * 0.10;
            const distance = this.radius * (spot.distanceRatio + drift * 0.018);
            const x = Math.cos(angle) * distance;
            const y = Math.sin(angle) * distance;
            const size = this.radius * spot.radiusRatio * breathe;

            // Soft outer spot + stronger core. Both are still simple ellipses.
            this.surface.fillStyle(0xffa12b, 0.16)
                .fillEllipse(x, y, size * 2.7 * spot.stretch, size * 2.3);
            this.surface.fillStyle(0xe86616, 0.40)
                .fillEllipse(x, y, size * 2.0 * spot.stretch, size * 1.65);
        }

        // A few small bright cells stop the surface looking completely flat.
        for (let i = 0; i < 5; i++) {
            const angle = pseudoRandom(i, 21) * Math.PI * 2;
            const distance = this.radius * (0.18 + pseudoRandom(i, 22) * 0.55);
            const pulse = 0.75 + activeTimeWave(i * 1.3, 0.00022, activeElapsedMs) * 0.25;
            const r = this.radius * (0.012 + pseudoRandom(i, 23) * 0.012) * pulse;
            this.surface.fillStyle(0xffdf67, 0.42)
                .fillCircle(Math.cos(angle) * distance, Math.sin(angle) * distance, r);
        }
    }

    private drawPlasma (activeElapsedMs: number): void
    {
        this.plasma.clear().setPosition(this.sprite.x, this.sprite.y);

        // Several small independent arcs overlap in time. Each one fades gently
        // and stays fully drawn, avoiding the old grow -> puff -> disappear effect.
        for (let slot = 0; slot < PLASMA_ARC_COUNT; slot++) {
            const offset = slot * (PLASMA_PERIOD_MS / PLASMA_ARC_COUNT);
            const localTime = activeElapsedMs + offset;
            const eventIndex = Math.floor(localTime / PLASMA_PERIOD_MS);
            const t = (localTime % PLASMA_PERIOD_MS) / PLASMA_PERIOD_MS;
            const seed = eventIndex * 31 + slot * 997;

            const fadeIn = smoothstep(0.00, 0.18, t);
            const fadeOut = 1 - smoothstep(0.72, 1.00, t);
            const alpha = fadeIn * fadeOut;
            if (alpha <= 0.01) continue;

            const baseAngle = pseudoRandom(seed, 31) * Math.PI * 2;
            const width = 0.16 + pseudoRandom(seed, 32) * 0.24;
            const startAngle = baseAngle - width * 0.5;
            const endAngle = baseAngle + width * 0.5;
            const foot = this.radius * 0.992;

            const start = new PhaserMath.Vector2(Math.cos(startAngle) * foot, Math.sin(startAngle) * foot);
            const end = new PhaserMath.Vector2(Math.cos(endAngle) * foot, Math.sin(endAngle) * foot);
            const peakAngle = baseAngle + (pseudoRandom(seed, 33) - 0.5) * 0.06;
            const height = this.radius * (1.045 + pseudoRandom(seed, 34) * 0.105);
            const breathe = 0.94 + Math.sin(t * Math.PI) * 0.06;
            const control = new PhaserMath.Vector2(
                Math.cos(peakAngle) * height * breathe,
                Math.sin(peakAngle) * height * breathe
            );

            const points = new Curves.QuadraticBezier(start, control, end).getPoints(12);
            this.plasma.lineStyle(Math.max(3, this.radius * 0.010), 0xff6b16, 0.18 * alpha)
                .strokePoints(points, false, false);
            this.plasma.lineStyle(Math.max(1.5, this.radius * 0.0035), 0xffd44d, 0.78 * alpha)
                .strokePoints(points, false, false);
        }
    }

    private drawAtmosphere (): void
    {
        const state = `${this.sprite.x}:${this.sprite.y}:${this.radius}`;
        if (state === this.atmosphereState) return;
        this.atmosphereState = state;

        this.atmosphere.clear().setPosition(this.sprite.x, this.sprite.y);

        // Everything is vector Graphics: broad fake glow plus the actual star disk.
        this.atmosphere.fillStyle(0xff6418, 0.045).fillCircle(0, 0, this.radius * 1.18);
        this.atmosphere.fillStyle(0xff8b1f, 0.065).fillCircle(0, 0, this.radius * 1.11);
        this.atmosphere.fillStyle(0xffc23a, 0.09).fillCircle(0, 0, this.radius * 1.055);
        this.atmosphere.fillStyle(0xffb52b, 1).fillCircle(0, 0, this.radius);
        this.atmosphere.fillStyle(0xffc83d, 0.45)
            .fillCircle(-this.radius * 0.12, -this.radius * 0.10, this.radius * 0.88);
        this.atmosphere.lineStyle(Math.max(3, this.radius * 0.008), 0xffe16a, 0.72)
            .strokeCircle(0, 0, this.radius * 0.992);
    }

}

function smoothstep (edge0: number, edge1: number, value: number): number
{
    const x = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
    return x * x * (3 - 2 * x);
}

function pseudoRandom(index: number, salt: number): number
{
    const value = Math.sin(index * 91.345 + salt * 47.853) * 43758.5453;
    return value - Math.floor(value);
}
