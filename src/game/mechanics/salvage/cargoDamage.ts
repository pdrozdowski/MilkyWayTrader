import type { GameStateSnapshot } from '../../state/gameStateSnapshot.ts';
import { cargoCapacityByLevel } from '../../definitions/cargoDefinitions.ts';

/** Applies projectile-only orbital-cargo damage and emits its loose-item spill. */
export function damageOrbitalCargo (state: GameStateSnapshot, cargoId: string): GameStateSnapshot
{
    const cargo = state.orbitalCargo.find(candidate => candidate.id === cargoId);
    if (!cargo) return state;
    if (cargo.hitPoints > 1) {
        return {
            ...state,
            orbitalCargo: state.orbitalCargo.map(candidate => candidate.id === cargoId
                ? { ...candidate, hitPoints: candidate.hitPoints - 1 }
                : candidate)
        };
    }
    const unitCost = cargo.container.totalCost / cargo.container.quantity;
    const ejectionVelocity = { x: Math.cos(cargo.orbit.rotationRadians) * 180, y: Math.sin(cargo.orbit.rotationRadians) * 180 };
    const looseItems = Array.from({ length: cargo.container.quantity }, (_, index) => ({
        id: `${cargo.id}-spill-${index + 1}`,
        position: { ...cargo.position },
        motion: {
            ejectionVelocity,
            sunVelocity: sunVelocity(cargo.position),
            createdAtActiveMs: state.clock.activeElapsedMs
        },
        container: {
            commodityId: cargo.container.commodityId,
            quantity: 1,
            totalCost: index + 1 === cargo.container.quantity
                ? cargo.container.totalCost - unitCost * index
                : unitCost
        }
    }));
    return {
        ...state,
        orbitalCargo: state.orbitalCargo.filter(candidate => candidate.id !== cargoId),
        looseItems: [...state.looseItems, ...looseItems]
    };
}

/** Collects a loose item when capacity allows; otherwise preserves authoritative state. */
export function collectLooseItem (state: GameStateSnapshot, itemId: string): GameStateSnapshot
{
    const item = state.looseItems.find(candidate => candidate.id === itemId);
    const cargoUsed = state.cargo.reduce((total, container) => total + container.quantity, 0);
    const capacity = cargoCapacityByLevel[state.shipStatus.cargoLevel] ?? 0;
    if (!item || cargoUsed + item.container.quantity > capacity) return state;
    const existing = state.cargo.find(candidate => candidate.commodityId === item.container.commodityId);
    const nextContainer = existing === undefined
        ? item.container
        : {
            commodityId: existing.commodityId,
            quantity: existing.quantity + item.container.quantity,
            totalCost: existing.totalCost + item.container.totalCost
        };
    return {
        ...state,
        cargo: [...state.cargo.filter(candidate => candidate.commodityId !== item.container.commodityId), nextContainer],
        looseItems: state.looseItems.filter(candidate => candidate.id !== itemId)
    };
}

function sunVelocity (position: Readonly<{ x: number; y: number }>): { x: number; y: number }
{
    const length = Math.hypot(position.x, position.y) || 1;
    return { x: -position.x / length * 240, y: -position.y / length * 240 };
}
