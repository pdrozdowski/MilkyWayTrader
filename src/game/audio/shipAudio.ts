import type { AudioScope } from './audioScope';

/** Gameplay state is authoritative; key presses alone never start engine audio. */
export function updateShipAudio(scope: AudioScope, ship: { enginesOn: boolean; boosting: boolean },
    speed: number, normalMaxSpeed: number, boostMultiplier: number, delta: number): void
{
    if (!ship.enginesOn) scope.setLoop('engine', null);
    else if (ship.boosting) {
        const fraction = Math.max(0, Math.min(1, (speed - normalMaxSpeed) / (normalMaxSpeed * (boostMultiplier - 1))));
        scope.setLoop('engine', 'ship-booster', { rate: 1 + 0.3 * fraction });
    } else {
        scope.setLoop('engine', 'ship-engine', { rate: 0.9 + 0.25 * Math.max(0, Math.min(1, speed / normalMaxSpeed)) });
    }
    scope.update(delta);
}
