import type { CommodityContainerState } from './commodityContainerState';
import type { Vector2State } from './vector2State';

export interface LooseItemMotionState
{
    readonly ejectionVelocity: Vector2State;
    readonly sunVelocity: Vector2State;
    readonly createdAtActiveMs: number;
}

export interface LooseItemState
{
    readonly id: string;
    readonly position: Vector2State;
    readonly motion: LooseItemMotionState;
    /** Exactly one unit; its cost basis remains independent from every other holder. */
    readonly container: CommodityContainerState;
}
