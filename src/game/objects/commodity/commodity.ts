import { Scene } from 'phaser';
import { SceneObject } from '../_shared/sceneObject';
import type { LooseItemState } from '../../state/looseItemState';
import { definition } from './definition';

export const looseItemSunFadeDurationMs = 1_000;

/** Presentation-only wrapper for a single loose commodity item. */
export class Commodity extends SceneObject
{
    readonly id: string;

    constructor (scene: Scene, state: LooseItemState)
    {
        super(scene, definition, { ...state.position, size: 32, variant: state.container.commodityId });
        this.id = state.id;
        this.synchronize(state);
    }

    synchronize (state: LooseItemState): void
    {
        super.setPosition(state.position.x, state.position.y);
        this.sprite.setTexture(commodityTexture(state.container.commodityId));
    }

    fadeOutSunConsumed (onComplete: () => void): void
    {
        this.scene.tweens.add({ targets: this.sprite, alpha: 0, duration: looseItemSunFadeDurationMs, ease: 'Linear', onComplete });
    }
}

export class CommodityProjection
{
    private readonly commodityById = new Map<string, Commodity>();
    private readonly fadingIds = new Set<string>();
    private destroyed = false;

    constructor (private readonly scene: Scene)
    {
        scene.events.once('shutdown', this.destroy, this);
    }

    synchronize (states: readonly LooseItemState[], sunConsumedIds: ReadonlySet<string>): void
    {
        if (this.destroyed) return;
        const activeIds = new Set(states.map(state => state.id));
        for (const [id, commodity] of this.commodityById) if (!activeIds.has(id) && !this.fadingIds.has(id)) {
            if (sunConsumedIds.has(id)) {
                this.fadingIds.add(id);
                commodity.fadeOutSunConsumed(() => {
                    if (this.destroyed) return;
                    commodity.destroy();
                    this.commodityById.delete(id);
                    this.fadingIds.delete(id);
                });
            } else {
                commodity.destroy();
                this.commodityById.delete(id);
            }
        }
        for (const state of states) {
            let commodity = this.commodityById.get(state.id);
            if (!commodity) {
                commodity = new Commodity(this.scene, state);
                this.commodityById.set(state.id, commodity);
            }
            commodity.synchronize(state);
        }
    }

    readonly destroy = (): void =>
    {
        if (this.destroyed) return;
        this.destroyed = true;
        this.scene.events.off('shutdown', this.destroy, this);
        for (const commodity of this.commodityById.values()) commodity.destroy();
        this.commodityById.clear();
        this.fadingIds.clear();
    };
}

function commodityTexture (commodityId: string): string
{
    if (commodityId === 'alloys' || commodityId === 'medicines') return `object:commodity:${commodityId}`;
    return 'object:commodity:supplies';
}
