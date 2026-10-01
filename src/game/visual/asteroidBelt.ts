import { asteroidBeltDefinition, asteroidBeltLayout as configuredAsteroidBeltLayout } from '../definitions/gameplayTuning.ts';

export type AsteroidType = 'rock' | 'ice' | 'metal' | 'dirt';

export interface AsteroidBeltAsteroid
{
    readonly beltIndex: number;
    readonly type: AsteroidType;
    readonly angleRadians: number;
    readonly rotationRadians: number;
    readonly radius: number;
}

export interface AsteroidBeltPosition
{
    readonly x: number;
    readonly y: number;
    readonly radius: number;
}

const fullTurn = Math.PI * 2;

export const asteroidBeltLayout: readonly AsteroidBeltAsteroid[] = configuredAsteroidBeltLayout.map(asteroid => ({
    beltIndex: asteroid.beltIndex,
    type: asteroid.variant,
    angleRadians: asteroid.angleRadians,
    rotationRadians: asteroid.rotationRadians,
    radius: asteroid.radius
}));

export function projectAsteroidBelt (activeElapsedMs: number): readonly AsteroidBeltPosition[]
{
    const rotation = (activeElapsedMs % asteroidBeltDefinition.rotationPeriodMs)
        / asteroidBeltDefinition.rotationPeriodMs * fullTurn;
    return asteroidBeltLayout.map(asteroid => {
        const angle = asteroid.angleRadians + rotation;
        return {
            x: Math.cos(angle) * asteroid.radius,
            y: -Math.sin(angle) * asteroid.radius,
            radius: asteroidBeltDefinition.asteroidRadius
        };
    });
}
