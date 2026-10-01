import type { GameObjects, Scene } from 'phaser';
import { asteroidTuning } from '../../definitions/gameplayTuning';
import type { AsteroidState } from '../../state/asteroidState';
import { ObjectDepth } from '../../visual/layers';

/** Phaser-only projection of the authoritative asteroid snapshot collection. */
export class AsteroidProjection
{
    private readonly sprites = new Map<string, GameObjects.Image>();
    private destroyed = false;

    constructor (private readonly scene: Scene)
    {
        scene.events.once('shutdown', this.destroy, this);
    }

    synchronize (states: readonly AsteroidState[]): void
    {
        if (this.destroyed) return;
        const activeIds = new Set(states.map(state => state.id));
        for (const [id, sprite] of this.sprites) if (!activeIds.has(id)) {
            sprite.destroy();
            this.sprites.delete(id);
        }
        for (const state of states) {
            let sprite = this.sprites.get(state.id);
            if (!sprite) {
                sprite = this.scene.add.image(state.position.x, state.position.y, `asteroid:${state.variant}`)
                    .setDepth(ObjectDepth.Asteroid);
                this.sprites.set(state.id, sprite);
            }
            sprite.setPosition(state.position.x, state.position.y)
                .setTexture(`asteroid:${state.variant}`)
                .setScale(asteroidTuning.sizes[state.size].radius * 2 / sprite.width)
                .setRotation(state.orbit?.rotationRadians ?? 0);
        }
    }

    readonly destroy = (): void =>
    {
        if (this.destroyed) return;
        this.destroyed = true;
        this.scene.events.off('shutdown', this.destroy, this);
        for (const sprite of this.sprites.values()) sprite.destroy();
        this.sprites.clear();
    };
}
