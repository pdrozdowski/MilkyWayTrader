import { asteroidTuning } from '../../definitions/gameplayTuning.ts';
import { moolarisDefinition } from '../../definitions/moolarisDefinition.ts';
import { cargoOrbitPeriodMs } from '../salvage/salvageSimulation.ts';
import { createRandomCargoManifest } from '../salvage/cargoManifest.ts';
import type { GameStateSnapshot } from '../../state/gameStateSnapshot.ts';

const debugCargoDistance = 100;

/** Adds one normal cargo container from the debug intent using persisted run randomness. */
export function spawnDebugCargo (state: GameStateSnapshot): GameStateSnapshot
{
    if (state.terminalResult !== null) return state;
    const heading = { x: Math.sin(state.ship.rotation), y: -Math.cos(state.ship.rotation) };
    const position = {
        x: state.ship.position.x + heading.x * debugCargoDistance,
        y: state.ship.position.y + heading.y * debugCargoDistance
    };
    const cargoManifest = createRandomCargoManifest(state.randomState);
    const offset = {
        x: position.x - moolarisDefinition.position.x,
        y: position.y - moolarisDefinition.position.y
    };
    return {
        ...state,
        randomState: cargoManifest.nextRandomState,
        orbitalCargo: [...state.orbitalCargo, {
            id: `debug-cargo-${state.randomState}`,
            position,
            orbit: {
                angleRadians: Math.atan2(-offset.y, offset.x) - (state.clock.activeElapsedMs % cargoOrbitPeriodMs(Math.hypot(offset.x, offset.y))) / cargoOrbitPeriodMs(Math.hypot(offset.x, offset.y)) * Math.PI * 2,
                radius: Math.hypot(offset.x, offset.y),
                rotationRadians: state.ship.rotation
            },
            hitPoints: asteroidTuning.salvage.cargoHitPoints,
            manifest: cargoManifest.manifest
        }]
    };
}
