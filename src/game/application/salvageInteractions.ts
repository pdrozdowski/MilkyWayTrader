import { transferCommodityQuantity } from './commodityContainers.ts';
import { cargoCapacityByLevel, orbitalCargoCapacity } from '../domain/runBalance.ts';
import type { CommodityContainerState } from '../state/commodityContainerState.ts';
import type { GameStateSnapshot } from '../state/gameStateSnapshot.ts';

export type SalvageInteractionFailure = 'missing-cargo' | 'missing-commodity' | 'invalid-quantity' | 'insufficient-cargo' | 'ship-cargo-full' | 'orbit-cargo-full';

export interface SalvageInteractionResult
{
    readonly state: GameStateSnapshot;
    readonly failure: SalvageInteractionFailure | null;
}

function shipCargoUsed (state: GameStateSnapshot): number
{
    return state.cargo.reduce((total, container) => total + container.quantity, 0);
}

function orbitalCargoUsed (manifest: readonly CommodityContainerState[]): number
{
    return manifest.reduce((total, stack) => total + stack.quantity, 0);
}

/** Transfers one commodity atomically between an orbital cargo manifest and the ship. */
export function transferOrbitalCargo (state: GameStateSnapshot, cargoId: string, commodityId: string, quantity: number, direction: 'to-ship' | 'to-orbit'): SalvageInteractionResult
{
    const orbital = state.orbitalCargo.find(candidate => candidate.id === cargoId);
    if (!orbital) return { state, failure: 'missing-cargo' };
    const cargoStack = orbital.manifest.find(stack => stack.commodityId === commodityId);
    const shipStack = state.cargo.find(stack => stack.commodityId === commodityId);
    if (!Number.isSafeInteger(quantity) || quantity <= 0) return { state, failure: 'invalid-quantity' };
    if (direction === 'to-ship') {
        if (!cargoStack) return { state, failure: 'missing-commodity' };
        if (quantity > cargoStack.quantity) return { state, failure: 'insufficient-cargo' };
        if (shipCargoUsed(state) + quantity > (cargoCapacityByLevel[state.shipStatus.cargoLevel] ?? 0)) return { state, failure: 'ship-cargo-full' };
        const moved = transferCommodityQuantity(cargoStack, shipStack, quantity);
        const manifest = orbital.manifest.flatMap(stack => stack.commodityId === commodityId ? (moved.source === null ? [] : [moved.source]) : [stack]);
        const cargo = [...state.cargo.filter(stack => stack.commodityId !== commodityId), moved.destination];
        const orbitalCargo = state.orbitalCargo.flatMap(candidate => {
            if (candidate.id !== cargoId) return [candidate];
            if (manifest.length === 0) return [];
            return [{ ...candidate, manifest }];
        });
        return { state: { ...state, cargo, orbitalCargo }, failure: null };
    }
    if (!shipStack) return { state, failure: 'missing-commodity' };
    if (quantity > shipStack.quantity) return { state, failure: 'insufficient-cargo' };
    if (orbitalCargoUsed(orbital.manifest) + quantity > orbitalCargoCapacity) return { state, failure: 'orbit-cargo-full' };
    const moved = transferCommodityQuantity(shipStack, cargoStack, quantity);
    const manifest = cargoStack === undefined
        ? [...orbital.manifest, moved.destination]
        : orbital.manifest.map(stack => stack.commodityId === commodityId ? moved.destination : stack);
    const cargo = [...state.cargo.filter(stack => stack.commodityId !== commodityId), ...(moved.source === null ? [] : [moved.source])];
    const orbitalCargo = state.orbitalCargo.map(candidate => candidate.id === cargoId ? { ...candidate, manifest } : candidate);
    return { state: { ...state, cargo, orbitalCargo }, failure: null };
}

/** Returns the largest legal one-commodity transfer in either direction; zero when impossible. */
export function maximumOrbitalCargoTransfer (state: GameStateSnapshot, cargoId: string, commodityId: string, direction: 'to-ship' | 'to-orbit'): number
{
    const orbital = state.orbitalCargo.find(candidate => candidate.id === cargoId);
    if (!orbital) return 0;
    if (direction === 'to-ship') {
        const cargoStack = orbital.manifest.find(stack => stack.commodityId === commodityId);
        if (!cargoStack) return 0;
        const shipCapacity = cargoCapacityByLevel[state.shipStatus.cargoLevel] ?? 0;
        return Math.max(0, Math.min(cargoStack.quantity, shipCapacity - shipCargoUsed(state)));
    }
    const shipStack = state.cargo.find(stack => stack.commodityId === commodityId);
    if (!shipStack) return 0;
    return Math.max(0, Math.min(shipStack.quantity, orbitalCargoCapacity - orbitalCargoUsed(orbital.manifest)));
}
