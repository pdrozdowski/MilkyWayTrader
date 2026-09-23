import type { SceneObjectOptions } from '../objects/_shared/types';
import { initialGameState } from '../definitions/initialGameState.ts';
import { planetDefinitions, type PlanetId } from '../definitions/planetDefinitions.ts';
import { moolarisDefinition } from '../definitions/moolarisDefinition.ts';

export const gameWorldSize = { width: 9216, height: 6912 };
export const gameWorldBounds = { x: -3072, y: -2304, ...gameWorldSize };
export const PLANET_SIZE_MULTIPLIER = 3;
export const SUN_RADIUS = moolarisDefinition.radius;

export interface PlanetSceneOptions
{
    readonly id: PlanetId;
    readonly variant: 'blue' | 'green' | 'amber';
    readonly spinSpeed: number;
}

export const gameObjectLayout: { sun: SceneObjectOptions; ship: SceneObjectOptions; planets: readonly PlanetSceneOptions[] } = {
    sun: { ...moolarisDefinition.position, size: SUN_RADIUS * 2 },
    ship: { ...initialGameState.ship.position },
    planets: planetDefinitions.map(definition => ({
        id: definition.id,
        variant: definition.variant,
        spinSpeed: definition.spinSpeed
    }))
};
