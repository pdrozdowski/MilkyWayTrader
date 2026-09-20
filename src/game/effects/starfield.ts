import { GameObjects, Math as PhaserMath, Scene } from 'phaser';
import { ObjectDepth } from '../visual/layers';

interface Star {
    x: number;
    y: number;
    radius: number;
    color: number;
    brightness: number;
    phase: number;
    frequency: number;
}

// One world-space graphics object; only visible stars are drawn each frame.
export class Starfield
{
    readonly graphics: GameObjects.Graphics;
    private readonly stars: Star[];

    constructor (private readonly scene: Scene, width: number, height: number, x = 0, y = 0)
    {
        this.graphics = scene.add.graphics().setDepth(ObjectDepth.Background);
        const marginX = scene.scale.width / (2 * 0.75);
        const marginY = scene.scale.height / (2 * 0.75);
        const count = Math.round((width + marginX * 2) * (height + marginY * 2) / (1024 * 768) * 180);
        this.stars = Array.from({ length: count }, () => {
            const colorRoll = Math.random();
            return {
                x: PhaserMath.FloatBetween(x - marginX, x + width + marginX),
                y: PhaserMath.FloatBetween(y - marginY, y + height + marginY),
                radius: PhaserMath.FloatBetween(0.45, 1.65),
                color: colorRoll < 0.03 ? 0xff8d8d : colorRoll < 0.25 ? 0x8abaff : 0xffffff,
                brightness: PhaserMath.FloatBetween(0.2, 0.8),
                phase: PhaserMath.FloatBetween(0, Math.PI * 2),
                frequency: Math.PI * 2 / PhaserMath.FloatBetween(3000, 7000)
            };
        });
        scene.events.once('shutdown', this.destroy, this);
    }

    update (time: number): void
    {
        const camera = this.scene.cameras.main;
        const left = camera.scrollX + camera.width / 2 - camera.width / (2 * camera.zoom) - 16;
        const top = camera.scrollY + camera.height / 2 - camera.height / (2 * camera.zoom) - 16;
        const right = left + camera.width / camera.zoom + 32;
        const bottom = top + camera.height / camera.zoom + 32;
        this.graphics.clear();
        for (const star of this.stars) {
            if (star.x < left || star.x > right || star.y < top || star.y > bottom) continue;
            const alpha = star.brightness * (0.87 + 0.13 * Math.sin(time * star.frequency + star.phase));
            if (star.radius > 1.2) this.graphics.fillStyle(star.color, alpha * 0.08).fillCircle(star.x, star.y, star.radius * 2.2);
            this.graphics.fillStyle(star.color, alpha).fillCircle(star.x, star.y, star.radius);
        }
    }

    destroy (): void
    {
        this.scene.events.off('shutdown', this.destroy, this);
        this.graphics.destroy();
    }
}
