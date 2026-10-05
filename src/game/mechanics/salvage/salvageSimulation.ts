import type { LooseItemState } from '../../state/looseItemState.ts';
import type { OrbitalCargoState } from '../../state/orbitalCargoState.ts';
import type { Vector2State } from '../../state/vector2State.ts';
import { asteroidTuning } from '../../definitions/gameplayTuning.ts';
import { moolarisDefinition } from '../../definitions/moolarisDefinition.ts';

const fullTurn = Math.PI * 2;

export function cargoOrbitPeriodMs (radius: number): number
{
    return Math.round(radius * 300_000 / 1902.6);
}

export function cargoOrbitAtActiveTime (cargo: OrbitalCargoState, activeElapsedMs: number): OrbitalCargoState
{
    const periodMs = cargoOrbitPeriodMs(cargo.orbit.radius);
    const angle = cargo.orbit.angleRadians + (activeElapsedMs % periodMs) / periodMs * fullTurn;
    return {
        ...cargo,
        position: {
            x: moolarisDefinition.position.x + Math.cos(angle) * cargo.orbit.radius,
            y: moolarisDefinition.position.y - Math.sin(angle) * cargo.orbit.radius
        }
    };
}

export function advanceOrbitalCargo (cargo: readonly OrbitalCargoState[], activeElapsedMs: number): readonly OrbitalCargoState[]
{
    return cargo.map(candidate => cargoOrbitAtActiveTime(candidate, activeElapsedMs));
}

export function looseItemVelocityAtActiveTime (item: LooseItemState, activeElapsedMs: number): Vector2State
{
    const progress = Math.max(0, Math.min(1, (activeElapsedMs - item.motion.createdAtActiveMs) / asteroidTuning.salvage.looseItemBlendDurationMs));
    return {
        x: item.motion.ejectionVelocity.x * (1 - progress) + item.motion.sunVelocity.x * progress,
        y: item.motion.ejectionVelocity.y * (1 - progress) + item.motion.sunVelocity.y * progress
    };
}

export function advanceLooseItems (items: readonly LooseItemState[], activeElapsedMs: number, activeDeltaMs: number): readonly LooseItemState[]
{
    return items.flatMap(item => {
        const velocity = looseItemVelocityAtActiveTime(item, activeElapsedMs);
        const position = {
            x: item.position.x + velocity.x * activeDeltaMs / 1000,
            y: item.position.y + velocity.y * activeDeltaMs / 1000
        };
        return Math.hypot(position.x - moolarisDefinition.position.x, position.y - moolarisDefinition.position.y) <= moolarisDefinition.radius ? [] : [{ ...item, position }];
    });
}
