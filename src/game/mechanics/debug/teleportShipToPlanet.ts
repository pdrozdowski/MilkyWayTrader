import type { GameStateSnapshot } from '../../state/gameStateSnapshot.ts';

/** Moves an airborne ship to the current authoritative centre of a known planet. */
export function teleportShipToPlanet (state: GameStateSnapshot, planetId: string): GameStateSnapshot
{
    if (state.planetLifecycle.landedPlanetId !== null) return state;
    const planet = state.planets.find(candidate => candidate.id === planetId);
    if (!planet) return state;
    return {
        ...state,
        ship: {
            ...state.ship,
            position: { ...planet.position },
            velocity: { x: 0, y: 0 },
            enginesOn: false,
            boosting: false,
            boostAcceleration: 0,
            asteroidControlLockedUntilActiveMs: null
        },
        planetLifecycle: { ...state.planetLifecycle, capturedPlanetId: null }
    };
}
