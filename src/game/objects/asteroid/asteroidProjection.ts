import type { GameObjects, Scene } from 'phaser';
import { asteroidTuning } from '../../definitions/gameplayTuning';
import type { AsteroidState } from '../../state/asteroidState';
import { ObjectDepth } from '../../visual/layers';

interface AsteroidDisplay
{
    readonly sprite: GameObjects.Image;
    readonly healthBar: GameObjects.Graphics;
}

const healthBarHeight = 4;
const healthBarOffset = 8;

/** Asteroids always remain readable above planets and other world bodies. */
export function asteroidProjectionDepth (_state: AsteroidState): number
{
    return ObjectDepth.Asteroid;
}

/** Phaser-only projection of the authoritative asteroid snapshot collection. */
export class AsteroidProjection
{
    private readonly displays = new Map<string, AsteroidDisplay>();
    private destroyed = false;

    constructor (private readonly scene: Scene)
    {
        scene.events.once('shutdown', this.destroy, this);
    }

    synchronize (states: readonly AsteroidState[]): void
    {
        if (this.destroyed) return;
        const activeIds = new Set(states.map(state => state.id));
        for (const [id, display] of this.displays) if (!activeIds.has(id)) {
            display.sprite.destroy();
            display.healthBar.destroy();
            this.displays.delete(id);
        }
        for (const state of states) {
            let display = this.displays.get(state.id);
            if (!display) {
                display = {
                    sprite: this.scene.add.image(state.position.x, state.position.y, `asteroid:${state.variant}`),
                    healthBar: this.scene.add.graphics()
                };
                this.displays.set(state.id, display);
            }
            const { sprite, healthBar } = display;
            const radius = asteroidTuning.sizes[state.size].radius;
            const depth = asteroidProjectionDepth(state);
            sprite.setPosition(state.position.x, state.position.y)
                .setTexture(`asteroid:${state.variant}`)
                .setScale(radius * 2 / sprite.width)
                .setRotation(state.orbit?.rotationRadians ?? 0)
                .setDepth(depth);
            this.drawHealthBar(healthBar, state, radius, depth);
        }
    }

    readonly destroy = (): void =>
    {
        if (this.destroyed) return;
        this.destroyed = true;
        this.scene.events.off('shutdown', this.destroy, this);
        for (const display of this.displays.values()) {
            display.sprite.destroy();
            display.healthBar.destroy();
        }
        this.displays.clear();
    };

    private drawHealthBar (healthBar: GameObjects.Graphics, state: AsteroidState, radius: number, depth: number): void
    {
        const maximum = asteroidTuning.sizes[state.size].hitPoints;
        const width = Math.max(18, radius * 1.15);
        const x = state.position.x - width / 2;
        const y = state.position.y - radius - healthBarOffset;
        const fraction = Math.max(0, Math.min(1, state.hitPoints / maximum));
        healthBar.clear();
        if (fraction >= 1) return;
        healthBar.setDepth(depth + 0.1);
        healthBar.fillStyle(0x111827, 0.82).fillRect(x - 1, y - 1, width + 2, healthBarHeight + 2);
        healthBar.fillStyle(fraction > 0.5 ? 0x83f28f : 0xffbd5c, 0.95).fillRect(x, y, width * fraction, healthBarHeight);
    }
}
