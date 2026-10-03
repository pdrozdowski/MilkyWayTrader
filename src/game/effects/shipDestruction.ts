import { GameObjects, Math as PhaserMath, Scene } from 'phaser';
import { ObjectDepth } from '../visual/layers';

export const shipDestructionDurationMs = 2_000;
export const shipDestructionFragmentCounts = { large: 5, small: 8 } as const;

/** Transient scene-owned death imagery; it never represents gameplay state. */
export class ShipDestruction
{
    private readonly fragments: GameObjects.Graphics[] = [];
    private overlay: GameObjects.Rectangle | null = null;
    private destroyed = false;

    constructor (private readonly scene: Scene)
    {
        scene.events.once('shutdown', this.destroy, this);
    }

    play (position: Readonly<{ x: number; y: number }>, complete: () => void): void
    {
        if (this.destroyed) return;
        const origin = new PhaserMath.Vector2(position.x, position.y);
        const largeDirections = [new PhaserMath.Vector2(-1, -0.65), new PhaserMath.Vector2(-0.2, -1), new PhaserMath.Vector2(0.8, -0.35), new PhaserMath.Vector2(0.9, 0.65), new PhaserMath.Vector2(-0.4, 1)].map(direction => direction.normalize());
        for (const [index, direction] of largeDirections.entries()) {
            const fragment = this.scene.add.graphics().setDepth(ObjectDepth.Ship + 2);
            fragment.fillStyle(0xff6b12, 1).fillTriangle(-13, 10, 0, -18, 13, 10);
            fragment.fillStyle(0xffe07a, 1).fillCircle(0, 4, 7);
            fragment.setPosition(origin.x, origin.y).setRotation(index * 1.7);
            this.fragments.push(fragment);
            const destination = origin.clone().add(direction.scale(180 + index * 45));
            this.scene.tweens.add({ targets: fragment, x: destination.x, y: destination.y, rotation: fragment.rotation + (index + 1) * 3, alpha: 0, duration: shipDestructionDurationMs, ease: 'Cubic.Out' });
        }
        for (let index = 0; index < shipDestructionFragmentCounts.small; index += 1) {
            const angle = (index / shipDestructionFragmentCounts.small) * Math.PI * 2 + 0.2;
            const direction = new PhaserMath.Vector2(Math.cos(angle), Math.sin(angle));
            const fragment = this.scene.add.graphics().setDepth(ObjectDepth.Ship + 2);
            fragment.fillStyle(0xffb13d, 1).fillTriangle(-6, 5, 0, -8, 6, 5);
            fragment.setPosition(origin.x, origin.y).setRotation(index * 0.9);
            this.fragments.push(fragment);
            const destination = origin.clone().add(direction.scale(100 + index * 14));
            this.scene.tweens.add({ targets: fragment, x: destination.x, y: destination.y, rotation: fragment.rotation - (index + 1) * 4, alpha: 0, duration: shipDestructionDurationMs, ease: 'Cubic.Out' });
        }
        this.overlay = this.scene.add.rectangle(0, 0, this.scene.scale.width, this.scene.scale.height, 0x000000, 0)
            .setOrigin(0).setScrollFactor(0).setDepth(ObjectDepth.UI + 1);
        this.scene.tweens.add({ targets: this.overlay, alpha: 1, duration: shipDestructionDurationMs, ease: 'Linear', onComplete: complete });
    }

    readonly destroy = (): void =>
    {
        if (this.destroyed) return;
        this.destroyed = true;
        this.scene.events.off('shutdown', this.destroy, this);
        for (const fragment of this.fragments.splice(0)) { this.scene.tweens.killTweensOf(fragment); fragment.destroy(); }
        if (this.overlay) { this.scene.tweens.killTweensOf(this.overlay); this.overlay.destroy(); this.overlay = null; }
    };
}
