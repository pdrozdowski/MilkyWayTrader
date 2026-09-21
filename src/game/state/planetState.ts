import type { Vector2State } from './vector2State';

export interface PlanetState
{
    readonly id: string;
    readonly name: string;
    readonly position: Vector2State;
    readonly radius: number;
}
