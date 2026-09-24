import { asteroidBeltDefinition } from '../definitions/asteroidBeltDefinition.ts';

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
const asteroidTypes: readonly AsteroidType[] = ['rock', 'ice', 'metal', 'dirt'];

export const asteroidBeltLayout: readonly AsteroidBeltAsteroid[] = Array.from(
    { length: asteroidBeltDefinition.asteroidCount * 2 },
    (_, index) => {
        const beltIndex = Math.floor(index / asteroidBeltDefinition.asteroidCount);
        const beltOffset = beltIndex * (asteroidBeltDefinition.width + asteroidBeltDefinition.outerBeltGap
            + asteroidBeltDefinition.asteroidRadius * 2 - asteroidBeltDefinition.outerBeltInset);
        return {
            beltIndex,
            type: asteroidTypes[Math.floor(pseudoRandom(index, 3) * asteroidTypes.length)],
            angleRadians: pseudoRandom(index, 1) * fullTurn,
            rotationRadians: pseudoRandom(index, 4) * fullTurn,
            radius: asteroidBeltDefinition.innerRadius + beltOffset
                + pseudoRandom(index, 2) * asteroidBeltDefinition.width
        };
    }
);

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

function pseudoRandom (index: number, salt: number): number
{
    const value = Math.sin((index + asteroidBeltDefinition.seed) * 91.345 + salt * 47.853) * 43758.5453;
    return value - Math.floor(value);
}
