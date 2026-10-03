import type { GameStateSnapshot } from '../../state/gameStateSnapshot.ts';

/** Moves an airborne ship onto the first current asteroid without retaining flight momentum. */
export function teleportShipToAsteroid (state: GameStateSnapshot): GameStateSnapshot
{
    if (state.planetLifecycle.landedPlanetId !== null || state.terminalResult !== null) return state;
    const asteroid = state.asteroids[0];
    if (!asteroid) return state;
    return {
        ...state,
        ship: {
            ...state.ship,
            position: { ...asteroid.position },
            velocity: { x: 0, y: 0 },
            enginesOn: false,
            boosting: false,
            boostAcceleration: 0,
            asteroidControlLockedUntilActiveMs: null
        },
        planetLifecycle: { ...state.planetLifecycle, capturedPlanetId: null }
    };
}
