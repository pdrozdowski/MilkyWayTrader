import { cargoCapacityByLevel } from '../domain/runBalance.ts';
import { addPaidCommodity, transferCommodityQuantity } from './commodityContainers.ts';
import type { GameStateSnapshot } from '../state/gameStateSnapshot.ts';

export type SalvageInteractionFailure = 'missing-cargo' | 'missing-item' | 'invalid-quantity' | 'insufficient-cargo' | 'ship-cargo-full';

export interface SalvageInteractionResult
{
    readonly state: GameStateSnapshot;
    readonly failure: SalvageInteractionFailure | null;
}

function cargoUsed (state: GameStateSnapshot): number
{
    return state.cargo.reduce((total, container) => total + container.quantity, 0);
}

export function transferOrbitalCargo (state: GameStateSnapshot, cargoId: string, quantity: number, direction: 'to-ship' | 'to-orbit'): SalvageInteractionResult
{
    const orbital = state.orbitalCargo.find(candidate => candidate.id === cargoId);
    if (!orbital) return { state, failure: 'missing-cargo' };
    const shipContainer = state.cargo.find(candidate => candidate.commodityId === orbital.container.commodityId);
    const source = direction === 'to-ship' ? orbital.container : shipContainer;
    if (!Number.isSafeInteger(quantity) || quantity <= 0) return { state, failure: 'invalid-quantity' };
    if (!source || quantity > source.quantity) return { state, failure: 'insufficient-cargo' };
    if (direction === 'to-ship' && cargoUsed(state) + quantity > (cargoCapacityByLevel[state.shipStatus.cargoLevel] ?? 0)) return { state, failure: 'ship-cargo-full' };
    const moved = direction === 'to-ship'
        ? transferCommodityQuantity(orbital.container, shipContainer, quantity)
        : transferCommodityQuantity(source, orbital.container, quantity);
    const cargo = direction === 'to-ship'
        ? [...state.cargo.filter(candidate => candidate.commodityId !== orbital.container.commodityId), moved.destination]
        : [...state.cargo.filter(candidate => candidate.commodityId !== orbital.container.commodityId), ...(moved.source ? [moved.source] : [])];
    const container = direction === 'to-ship' ? moved.source : moved.destination;
    return {
        state: {
            ...state,
            cargo,
            orbitalCargo: state.orbitalCargo.flatMap(candidate => candidate.id !== cargoId ? [candidate] : container === null ? [] : [{ ...candidate, container }])
        },
        failure: null
    };
}

export function pickupLooseItem (state: GameStateSnapshot, itemId: string): SalvageInteractionResult
{
    const item = state.looseItems.find(candidate => candidate.id === itemId);
    if (!item) return { state, failure: 'missing-item' };
    if (cargoUsed(state) + item.container.quantity > (cargoCapacityByLevel[state.shipStatus.cargoLevel] ?? 0)) return { state, failure: 'ship-cargo-full' };
    const existing = state.cargo.find(candidate => candidate.commodityId === item.container.commodityId);
    return {
        state: {
            ...state,
            cargo: [...state.cargo.filter(candidate => candidate.commodityId !== item.container.commodityId), addPaidCommodity(existing, item.container.commodityId, item.container.quantity, item.container.totalCost)],
            looseItems: state.looseItems.filter(candidate => candidate.id !== itemId)
        },
        failure: null
    };
}

export function destroyOrbitalCargo (state: GameStateSnapshot, cargoId: string): SalvageInteractionResult
{
    const cargo = state.orbitalCargo.find(candidate => candidate.id === cargoId);
    if (!cargo) return { state, failure: 'missing-cargo' };
    if (cargo.hitPoints > 1) return { state: { ...state, orbitalCargo: state.orbitalCargo.map(candidate => candidate.id === cargoId ? { ...candidate, hitPoints: candidate.hitPoints - 1 } : candidate) }, failure: null };
    const unitCost = cargo.container.totalCost / cargo.container.quantity;
    const ejectionVelocity = { x: Math.cos(cargo.orbit.rotationRadians) * 180, y: Math.sin(cargo.orbit.rotationRadians) * 180 };
    const looseItems = Array.from({ length: cargo.container.quantity }, (_, index) => ({
        id: `${cargo.id}-spill-${index + 1}`,
        position: { ...cargo.position },
        motion: { ejectionVelocity, sunVelocity: sunVelocity(cargo.position), createdAtActiveMs: state.clock.activeElapsedMs },
        container: { commodityId: cargo.container.commodityId, quantity: 1, totalCost: index + 1 === cargo.container.quantity ? cargo.container.totalCost - unitCost * index : unitCost }
    }));
    return { state: { ...state, orbitalCargo: state.orbitalCargo.filter(candidate => candidate.id !== cargoId), looseItems: [...state.looseItems, ...looseItems] }, failure: null };
}

function sunVelocity (position: Readonly<{ x: number; y: number }>): { x: number; y: number }
{
    const length = Math.hypot(position.x, position.y) || 1;
    return { x: -position.x / length * 240, y: -position.y / length * 240 };
}
