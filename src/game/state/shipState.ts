import type { Vector2State } from './vector2State';

export interface ShipState
{
    readonly position: Vector2State;
    readonly velocity: Vector2State;
    readonly rotation: number;
    readonly enginesOn: boolean;
    readonly boosting: boolean;
    readonly boostAcceleration: number;
    readonly coastDeceleration: number;
}
