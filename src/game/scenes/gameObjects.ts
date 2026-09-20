import type { PlanetOptions } from '../objects/planet/planet';
import type { SceneObjectOptions } from '../objects/_shared/types';

export const gameWorldSize = { width: 9216, height: 6912 };
export const gameWorldBounds = { x: -3072, y: -2304, ...gameWorldSize };
export const PLANET_SIZE_MULTIPLIER = 3;
export const SUN_RADIUS = 110 * PLANET_SIZE_MULTIPLIER * 5;

export const gameObjectLayout: { sun: SceneObjectOptions; ship: SceneObjectOptions; planets: PlanetOptions[] } = {
    sun: { x: 0, y: 0, size: SUN_RADIUS * 2 },
    ship: { x: 1950, y: 600 },
    planets: [
        { model: { id: 'seroton', name: 'Seroton', x: 2300, y: 200, radius: 48 * PLANET_SIZE_MULTIPLIER }, variant: 'blue', spinSpeed: 0.8 },
        { model: { id: 'lactozis-7c', name: 'Lactozis-7C', x: -1900, y: 900, radius: 80 * PLANET_SIZE_MULTIPLIER }, variant: 'green', spinSpeed: 1 },
        { model: { id: 'maslo-prime', name: 'Maslo-Prime', x: 600, y: 2100, radius: 110 * PLANET_SIZE_MULTIPLIER }, variant: 'amber', spinSpeed: 0.6 }
    ]
};
