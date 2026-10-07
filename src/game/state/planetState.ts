import type { Vector2State } from './vector2State';

/** Canonical identity for every configured landable planet. */
export type PlanetId = 'seroton' | 'lactozis-7c' | 'maslo-prime';

export interface PlanetState
{
    readonly id: string;
    readonly name: string;
    readonly position: Vector2State;
    readonly radius: number;
}
