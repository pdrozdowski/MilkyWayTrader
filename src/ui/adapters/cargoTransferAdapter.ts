import type { Game } from 'phaser';
import { transferOrbitalCargo } from '../../game/application/salvageInteractions.ts';
import type { GameStateProvider } from '../../game/application/gameStateProvider.ts';
import { cargoCapacityByLevel } from '../../game/domain/runBalance.ts';
import { pauseGameClock, resumeGameClock } from '../../game/mechanics/clock/gameClock.ts';
import type { CargoTransferPort, CargoTransferSnapshot } from '../contracts.ts';

export const cargoTransferRange = 20;
export const cargoFullWarning = 'WARNING - CARGO IS FULL';
export const cargoFullWarningDurationMs = 2_000;

export function createCargoTransferPort (game: Game): CargoTransferPort
{
    const provider = game.registry.get('gameStateProvider') as GameStateProvider;
    const listeners = new Set<(snapshot: Readonly<CargoTransferSnapshot>) => void>();
    const suppressedIds = new Set<string>();
    let activeCargoId: string | null = null;
    let warningUntilMs = 0;
    let snapshot: CargoTransferSnapshot = {
        visible: false,
        cargoId: null,
        cargo: null,
        ship: null,
        cargoUsed: 0,
        cargoCapacity: 0,
        warning: null
    };
    let destroyed = false;
    function project (): CargoTransferSnapshot {
        const state = provider.snapshot();
        const nearby = state.orbitalCargo.find(candidate => Math.hypot(candidate.position.x - state.ship.position.x, candidate.position.y - state.ship.position.y) <= cargoTransferRange);
        for (const id of [...suppressedIds]) if (!state.orbitalCargo.some(candidate => candidate.id === id && Math.hypot(candidate.position.x - state.ship.position.x, candidate.position.y - state.ship.position.y) <= cargoTransferRange)) suppressedIds.delete(id);
        if (activeCargoId !== null && (!nearby || nearby.id !== activeCargoId)) activeCargoId = null;
        if (activeCargoId === null && nearby && !suppressedIds.has(nearby.id)) activeCargoId = nearby.id;
        const cargo = activeCargoId === null ? null : state.orbitalCargo.find(candidate => candidate.id === activeCargoId)?.container ?? null;
        const ship = cargo === null ? null : state.cargo.find(candidate => candidate.commodityId === cargo.commodityId) ?? null;
        const cargoUsed = state.cargo.reduce((total, container) => total + container.quantity, 0);
        return { visible: cargo !== null, cargoId: cargo === null ? null : activeCargoId, cargo, ship, cargoUsed, cargoCapacity: cargoCapacityByLevel[state.shipStatus.cargoLevel] ?? 0,
            warning: Date.now() < warningUntilMs ? cargoFullWarning : null };
    }
    const refresh = (): void => {
        if (destroyed) return;
        const previous = snapshot;
        snapshot = project();
        if (snapshot.visible && !previous.visible) provider.update(state => ({ ...state, clock: pauseGameClock(state.clock, 'manual') }));
        if (!snapshot.visible && previous.visible) provider.update(state => ({ ...state, clock: resumeGameClock(state.clock, 'manual') }));
        for (const listener of listeners) listener(snapshot);
    };
    const unsubscribe = provider.subscribe(refresh);
    const step = (): void => refresh();
    const failedPickup = (): void => { warningUntilMs = Date.now() + cargoFullWarningDurationMs; refresh(); };
    game.events.on('step', step);
    game.events.on('salvage-pickup-cargo-full', failedPickup);
    refresh();
    return {
        getSnapshot: () => snapshot,
        subscribe: listener => { listeners.add(listener); listener(snapshot); return () => listeners.delete(listener); },
        transferToShip: () => { if (snapshot.cargoId) provider.update(state => transferOrbitalCargo(state, snapshot.cargoId!, 1, 'to-ship').state); },
        transferToCargo: () => { if (snapshot.cargoId) provider.update(state => transferOrbitalCargo(state, snapshot.cargoId!, 1, 'to-orbit').state); },
        close: () => { if (activeCargoId) suppressedIds.add(activeCargoId); activeCargoId = null; refresh(); },
        destroy: () => { if (destroyed) return; destroyed = true; unsubscribe(); game.events.off('step', step); game.events.off('salvage-pickup-cargo-full', failedPickup); listeners.clear(); }
    };
}
