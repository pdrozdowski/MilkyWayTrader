import type { Vector2State } from '../../state/vector2State.ts';
import type { PlanetId } from '../../definitions/planetDefinitions.ts';
import { planetDefinitionById } from '../../definitions/planetDefinitions.ts';

export function projectPlanetPosition (id: PlanetId, activeElapsedMs: number): Vector2State
{
    if (!Number.isFinite(activeElapsedMs)) throw new Error('Planet active elapsed time must be finite.');
    const definition = planetDefinitionById[id];
    const phase = definition.initialPhaseRadians
        + (activeElapsedMs % definition.orbitalPeriodMs) / definition.orbitalPeriodMs * Math.PI * 2;
    return {
        x: definition.orbitRadius * Math.cos(phase),
        y: -definition.orbitRadius * Math.sin(phase)
    };
}
