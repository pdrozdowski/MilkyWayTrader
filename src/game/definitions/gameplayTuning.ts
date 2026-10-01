export const shipTuning = { maxSpeed: 240, accelerationSeconds: 1, stoppingSeconds: 0.5, collisionRadius: 18 };

export const shipBoostTuning = {
    speedMultiplier: 5,
    accelerationSeconds: 1,
    flameLengthMultiplier: 5,
    flameColor: 0x65dcff,
    cameraZoom: 0.78,
    cameraTransitionSeconds: 0.25,
    trailLifetime: 300
};

export const projectileTuning = { lifetime: 20000, radius: 6 };

export const weaponTuning = {
    shotsPerSecond: 3,
    projectileSpeed: 400,
    noseOffset: 25
};

export const asteroidTuning = {
    safeRadius: 1_280,
    outsideSafeAreaCullAfterMs: 15_000,
    worldBoundsRadius: 10_000,
    fragmentChildCount: { minimum: 2, maximum: 4 },
    planetCollisionPenetration: 1 / 3,
    starIngestionRadiusFactor: 1 / 2,
    starIngestionSpeed: 360,
    sizes: {
        big: { radius: 72, hitPoints: 3 },
        medium: { radius: 48, hitPoints: 2 },
        small: { radius: 24, hitPoints: 1 }
    },
    fragmentDrift: {
        speed: 180
    }
} as const;

export const asteroidBeltDefinition = {
    asteroidCount: 192,
    asteroidRadius: asteroidTuning.sizes.big.radius,
    innerClearance: 50,
    innerRadius: 2_197.4,
    width: 360,
    outerBeltGap: 50,
    outerBeltInset: 150,
    rotationPeriodMs: 420_000,
    seed: 2187
} as const;

export type AsteroidVariant = 'rock' | 'ice' | 'metal' | 'dirt';

export interface AsteroidBeltLayoutEntry
{
    readonly beltIndex: number;
    readonly variant: AsteroidVariant;
    readonly angleRadians: number;
    readonly rotationRadians: number;
    readonly radius: number;
}

const fullTurn = Math.PI * 2;
const asteroidVariants: readonly AsteroidVariant[] = ['rock', 'ice', 'metal', 'dirt'];

export const asteroidBeltLayout: readonly AsteroidBeltLayoutEntry[] = Array.from(
    { length: asteroidBeltDefinition.asteroidCount * 2 },
    (_, index) => {
        const beltIndex = Math.floor(index / asteroidBeltDefinition.asteroidCount);
        const beltOffset = beltIndex * (asteroidBeltDefinition.width + asteroidBeltDefinition.outerBeltGap
            + asteroidBeltDefinition.asteroidRadius * 2 - asteroidBeltDefinition.outerBeltInset);
        return {
            beltIndex,
            variant: asteroidVariants[Math.floor(pseudoRandom(index, 3) * asteroidVariants.length)],
            angleRadians: pseudoRandom(index, 1) * fullTurn,
            rotationRadians: pseudoRandom(index, 4) * fullTurn,
            radius: asteroidBeltDefinition.innerRadius + beltOffset
                + pseudoRandom(index, 2) * asteroidBeltDefinition.width
        };
    }
);

export function asteroidFragmentChildCount (parentId: string): number
{
    let hash = 2_166_136_261;
    for (const character of parentId) {
        hash ^= character.charCodeAt(0);
        hash = Math.imul(hash, 16_777_619);
    }
    return asteroidTuning.fragmentChildCount.minimum + (hash >>> 0) % (asteroidTuning.fragmentChildCount.maximum
        - asteroidTuning.fragmentChildCount.minimum + 1);
}

function pseudoRandom (index: number, salt: number): number
{
    const value = Math.sin((index + asteroidBeltDefinition.seed) * 91.345 + salt * 47.853) * 43758.5453;
    return value - Math.floor(value);
}
