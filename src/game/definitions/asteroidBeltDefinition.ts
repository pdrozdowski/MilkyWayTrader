import { planetDefinitions } from './planetDefinitions.ts';

const smallestPlanetRadius = Math.min(...planetDefinitions.map(planet => planet.radius));
const outermostPlanet = planetDefinitions[planetDefinitions.length - 1];

export const asteroidBeltDefinition = {
    asteroidCount: 192,
    asteroidRadius: smallestPlanetRadius / 2,
    innerClearance: 50,
    innerRadius: outermostPlanet.orbitRadius + outermostPlanet.radius + 50 + smallestPlanetRadius / 2,
    width: 360,
    outerBeltGap: 50,
    outerBeltInset: 150,
    rotationPeriodMs: 420_000,
    seed: 2187
} as const;
