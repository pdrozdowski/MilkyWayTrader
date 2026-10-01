import type { Vector2State } from './vector2State';

export type AsteroidSize = 'big' | 'medium' | 'small';
export const asteroidMaximumHitPoints: Readonly<Record<AsteroidSize, number>> = { big: 3, medium: 2, small: 1 };
export type AsteroidVariant = 'rock' | 'ice' | 'metal' | 'dirt';

export interface AsteroidOrbitState
{
    readonly angleRadians: number;
    readonly radius: number;
    readonly rotationRadians: number;
}

export interface AsteroidState
{
    readonly id: string;
    readonly variant: AsteroidVariant;
    readonly size: AsteroidSize;
    readonly hitPoints: number;
    readonly position: Vector2State;
    readonly velocity: Vector2State;
    readonly orbit: AsteroidOrbitState | null;
    readonly outsideSafeAreaSinceActiveMs: number | null;
}
