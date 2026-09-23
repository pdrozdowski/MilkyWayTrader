import { MOOLARIS_CONTROL_CLEARANCE, MOOLARIS_RECOVERY_SECONDS, moolarisDefinition } from '../../definitions/moolarisDefinition.ts';
import { shipTuning } from '../../definitions/gameplayTuning.ts';
import type { ShipState } from '../../state/shipState.ts';
import type { Vector2State } from '../../state/vector2State.ts';

export interface MoolarisContactResult
{
    readonly hasControl: boolean;
    readonly forcedVelocity: Vector2State | null;
}

export const moolarisControlRadius = moolarisDefinition.radius + shipTuning.collisionRadius + MOOLARIS_CONTROL_CLEARANCE;
const moolarisRecoveryDistance = shipTuning.maxSpeed * MOOLARIS_RECOVERY_SECONDS / 2;

export function resolveMoolarisContact (ship: Pick<ShipState, 'position'>): MoolarisContactResult
{
    const x = ship.position.x - moolarisDefinition.position.x;
    const y = ship.position.y - moolarisDefinition.position.y;
    const distance = Math.hypot(x, y);
    if (distance > moolarisControlRadius) return { hasControl: true, forcedVelocity: null };
    const direction = distance > 0 ? { x: x / distance, y: y / distance } : { x: 1, y: 0 };
    return {
        hasControl: false,
        forcedVelocity: {
            x: direction.x * shipTuning.maxSpeed,
            y: direction.y * shipTuning.maxSpeed
        }
    };
}

export function isRecoveringFromMoolaris (
    ship: Pick<ShipState, 'position' | 'velocity'>,
    target: Readonly<{ x: number; y: number }> | null
): boolean
{
    if (!target) return false;
    const radialX = ship.position.x - moolarisDefinition.position.x;
    const radialY = ship.position.y - moolarisDefinition.position.y;
    const distance = Math.hypot(radialX, radialY);
    if (distance <= moolarisControlRadius || distance > moolarisControlRadius + moolarisRecoveryDistance || distance === 0) return false;
    const targetX = target.x - ship.position.x;
    const targetY = target.y - ship.position.y;
    return radialX * ship.velocity.x + radialY * ship.velocity.y > 0
        && radialX * targetX + radialY * targetY < 0;
}
