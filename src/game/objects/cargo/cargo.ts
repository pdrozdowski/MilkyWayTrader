import { GameObjects, Scene } from 'phaser';
import { SceneObject } from '../_shared/sceneObject';
import { ObjectDepth } from '../../visual/layers';
import type { OrbitalCargoState } from '../../state/orbitalCargoState';
import { definition } from './definition';

const closedFrameDurationMs = 200;
const cargoAnimationDurationMs = 1_200;
const activationRadius = 20;

/** Presentation-only wrapper for one authoritative orbital cargo ID. */
export class Cargo extends SceneObject
{
    readonly id: string;
    private readonly activation: GameObjects.Arc;
    private readonly healthBar: GameObjects.Graphics;

    constructor (scene: Scene, state: OrbitalCargoState)
    {
        super(scene, definition, { ...state.position, size: 32 });
        this.id = state.id;
        this.activation = scene.add.circle(state.position.x, state.position.y, activationRadius)
            .setStrokeStyle(2, 0x9be0ff, 0.7).setDepth(ObjectDepth.Indicator);
        this.healthBar = scene.add.graphics();
        this.ownCleanup(() => this.activation.destroy());
        this.ownCleanup(() => this.healthBar.destroy());
        this.synchronize(state);
    }

    synchronize (state: OrbitalCargoState): void
    {
        super.setPosition(state.position.x, state.position.y);
        this.activation.setPosition(state.position.x, state.position.y);
        const texture = this.scene.time.now % cargoAnimationDurationMs >= closedFrameDurationMs
            ? 'object:cargo:open'
            : 'object:cargo:closed';
        this.sprite.setTexture(texture);
        this.drawHealthBar(state);
    }

    private drawHealthBar (state: OrbitalCargoState): void
    {
        this.healthBar.clear();
        if (state.hitPoints !== 1) return;
        const width = 24;
        const x = state.position.x - width / 2;
        const y = state.position.y - 26;
        this.healthBar.setDepth(ObjectDepth.Asteroid + 0.1);
        this.healthBar.fillStyle(0x111827, 0.82).fillRect(x - 1, y - 1, width + 2, 6);
        this.healthBar.fillStyle(0xffbd5c, 0.95).fillRect(x, y, width / 2, 4);
    }
}

/** Reconciles the state-owned collection without giving projections gameplay ownership. */
export class CargoProjection
{
    private readonly cargoById = new Map<string, Cargo>();
    private destroyed = false;

    constructor (private readonly scene: Scene)
    {
        scene.events.once('shutdown', this.destroy, this);
    }

    synchronize (states: readonly OrbitalCargoState[]): void
    {
        if (this.destroyed) return;
        const activeIds = new Set(states.map(state => state.id));
        for (const [id, cargo] of this.cargoById) if (!activeIds.has(id)) {
            cargo.destroy();
            this.cargoById.delete(id);
        }
        for (const state of states) {
            let cargo = this.cargoById.get(state.id);
            if (!cargo) {
                cargo = new Cargo(this.scene, state);
                this.cargoById.set(state.id, cargo);
            }
            cargo.synchronize(state);
        }
    }

    readonly destroy = (): void =>
    {
        if (this.destroyed) return;
        this.destroyed = true;
        this.scene.events.off('shutdown', this.destroy, this);
        for (const cargo of this.cargoById.values()) cargo.destroy();
        this.cargoById.clear();
    };
}
