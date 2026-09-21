import type { Vector2State } from './vector2State';

export interface ProjectileState
{
    readonly id: string;
    readonly position: Vector2State;
    readonly velocity: Vector2State;
    readonly bornAtActiveMs: number;
}
