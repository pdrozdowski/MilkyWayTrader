import type { PlanetOptions } from '../objects/planet/planet';
import type { SceneObjectOptions } from '../objects/_shared/types';
import { initialGameState } from '../definitions/initialGameState.ts';

export const gameWorldSize = { width: 9216, height: 6912 };
export const gameWorldBounds = { x: -3072, y: -2304, ...gameWorldSize };
export const PLANET_SIZE_MULTIPLIER = 3;
export const SUN_RADIUS = 110 * PLANET_SIZE_MULTIPLIER * 5;

export const gameObjectLayout: { sun: SceneObjectOptions; ship: SceneObjectOptions; planets: PlanetOptions[] } = {
    sun: { x: 0, y: 0, size: SUN_RADIUS * 2 },
    ship: { ...initialGameState.ship.position },
    planets: initialGameState.planets.map((model, index) => ({
        model,
        variant: ['blue', 'green', 'amber'][index],
        spinSpeed: [0.8, 1, 0.6][index]
    }))
};
