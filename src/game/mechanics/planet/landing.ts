import { getPlanetDefinition } from '../../definitions/planetDefinitions.ts';
import type { GameStateSnapshot } from '../../state/gameStateSnapshot.ts';

export const LANDING_CENTRE_RADIUS = 35;

export function tryLandAtCapturedPlanet (state: GameStateSnapshot, landingRequested: boolean): GameStateSnapshot
{
    const planetId = state.planetLifecycle.capturedPlanetId;
    if (!landingRequested || state.ship.boosting || state.planetLifecycle.landedPlanetId !== null || state.planetLifecycle.relandingLockedPlanetId === planetId || !planetId) return state;
    const planet = state.planets.find(candidate => candidate.id === planetId);
    if (!planet || Math.hypot(state.ship.position.x - planet.position.x, state.ship.position.y - planet.position.y) > LANDING_CENTRE_RADIUS) return state;
    return {
        ...state,
        clock: { ...state.clock, playerPaused: true },
        ship: {
            ...state.ship,
            velocity: { x: 0, y: 0 },
            enginesOn: false,
            boosting: false,
            boostAcceleration: 0
        },
        planetLifecycle: { ...state.planetLifecycle, landedPlanetId: planetId }
    };
}

export function launchFromPlanet (state: GameStateSnapshot): GameStateSnapshot
{
    const planetId = state.planetLifecycle.landedPlanetId;
    if (!planetId) return state;
    getPlanetDefinition(planetId);
    return {
        ...state,
        clock: { ...state.clock, playerPaused: false },
        planetLifecycle: { capturedPlanetId: planetId, landedPlanetId: null, relandingLockedPlanetId: planetId }
    };
}
