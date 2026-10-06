import type { Game } from 'phaser';
import { maximumOrbitalCargoTransfer, transferOrbitalCargo } from '../../game/application/salvageInteractions.ts';
import { transferCommodityQuantity } from '../../game/application/commodityContainers.ts';
import type { GameStateProvider } from '../../game/application/gameStateProvider.ts';
import { cargoCapacityByLevel, orbitalCargoCapacity } from '../../game/domain/runBalance.ts';
import { pauseGameClock, resumeGameClock } from '../../game/mechanics/clock/gameClock.ts';
import type { GameStateSnapshot } from '../../game/state/gameStateSnapshot.ts';
import type { OrbitalCargoState } from '../../game/state/orbitalCargoState.ts';
import type { CargoTransferAmount, CargoTransferDirection, CargoTransferPort, CargoTransferSnapshot } from '../contracts.ts';
import { displayLabels } from '../components/displayLabels.ts';

export const cargoTransferRange = 20;
export const cargoFullWarning = displayLabels.cargoFullWarning;
export const cargoFullWarningDurationMs = 2_000;

function transferIntoMissingOrbitalCargo (state: GameStateSnapshot, template: OrbitalCargoState, commodityId: string, amount: CargoTransferAmount): GameStateSnapshot
{
    const shipStack = state.cargo.find(stack => stack.commodityId === commodityId);
    if (!shipStack) return state;
    const quantity = amount === 'one' ? 1 : Math.min(shipStack.quantity, orbitalCargoCapacity);
    if (quantity <= 0) return state;
    const moved = transferCommodityQuantity(shipStack, undefined, quantity);
    return {
        ...state,
        cargo: [...state.cargo.filter(stack => stack.commodityId !== commodityId), ...(moved.source === null ? [] : [moved.source])],
        orbitalCargo: [...state.orbitalCargo, { ...template, manifest: [moved.destination] }]
    };
}

export function createCargoTransferPort (game: Game): CargoTransferPort
{
    const provider = game.registry.get('gameStateProvider') as GameStateProvider;
    const listeners = new Set<(snapshot: Readonly<CargoTransferSnapshot>) => void>();
    const suppressedIds = new Set<string>();
    let activeCargoId: string | null = null;
    let stayOpenCargoId: string | null = null;
    let lastCargoTemplate: OrbitalCargoState | null = null;
    let warningUntilMs = 0;
    let snapshot: CargoTransferSnapshot = {
        visible: false,
        cargoId: null,
        rows: [],
        cargoUsed: 0,
        cargoCapacity: orbitalCargoCapacity,
        shipUsed: 0,
        shipCapacity: 0,
        warning: null
    };
    let destroyed = false;
    function project (): CargoTransferSnapshot {
        const state = provider.snapshot();
        const nearby = state.orbitalCargo.find(candidate => Math.hypot(candidate.position.x - state.ship.position.x, candidate.position.y - state.ship.position.y) <= cargoTransferRange);
        for (const id of [...suppressedIds]) if (!state.orbitalCargo.some(candidate => candidate.id === id && Math.hypot(candidate.position.x - state.ship.position.x, candidate.position.y - state.ship.position.y) <= cargoTransferRange)) suppressedIds.delete(id);
        if (activeCargoId !== null && (!nearby || nearby.id !== activeCargoId) && stayOpenCargoId !== activeCargoId) activeCargoId = null;
        if (activeCargoId === null && nearby && !suppressedIds.has(nearby.id)) activeCargoId = nearby.id;
        const cargo = activeCargoId === null ? null : state.orbitalCargo.find(candidate => candidate.id === activeCargoId) ?? null;
        if (cargo !== null) lastCargoTemplate = cargo;
        const shipCapacity = cargoCapacityByLevel[state.shipStatus.cargoLevel] ?? 0;
        const shipUsed = state.cargo.reduce((total, stack) => total + stack.quantity, 0);
        const warning = Date.now() < warningUntilMs ? cargoFullWarning : null;
        const shipRows = state.cargo.map(stack => ({
            commodityId: stack.commodityId,
            cargoQuantity: 0,
            shipQuantity: stack.quantity
        })).sort((left, right) => left.commodityId.localeCompare(right.commodityId));
        if (cargo === null) {
            if (activeCargoId !== null && stayOpenCargoId === activeCargoId) {
                return { visible: true, cargoId: activeCargoId, rows: shipRows, cargoUsed: 0, cargoCapacity: orbitalCargoCapacity, shipUsed, shipCapacity, warning };
            }
            return { visible: false, cargoId: null, rows: [], cargoUsed: 0, cargoCapacity: orbitalCargoCapacity, shipUsed, shipCapacity, warning };
        }
        const commodityIds = new Set<string>();
        for (const stack of cargo.manifest) commodityIds.add(stack.commodityId);
        for (const stack of state.cargo) commodityIds.add(stack.commodityId);
        const rows = [...commodityIds]
            .map(commodityId => ({
                commodityId,
                cargoQuantity: cargo.manifest.find(stack => stack.commodityId === commodityId)?.quantity ?? 0,
                shipQuantity: state.cargo.find(stack => stack.commodityId === commodityId)?.quantity ?? 0
            }))
            .sort((left, right) => left.commodityId.localeCompare(right.commodityId));
        return {
            visible: true,
            cargoId: activeCargoId,
            rows,
            cargoUsed: cargo.manifest.reduce((total, stack) => total + stack.quantity, 0),
            cargoCapacity: orbitalCargoCapacity,
            shipUsed,
            shipCapacity,
            warning
        };
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
        transfer: (commodityId: string, direction: CargoTransferDirection, amount: CargoTransferAmount): void => {
            const cargoId = snapshot.cargoId;
            if (!cargoId) return;
            const beforeTransfer = provider.snapshot();
            if (!beforeTransfer.orbitalCargo.some(candidate => candidate.id === cargoId)) {
                const template = lastCargoTemplate;
                if (direction === 'to-orbit' && template?.id === cargoId) {
                    provider.update(state => transferIntoMissingOrbitalCargo(state, template, commodityId, amount));
                    stayOpenCargoId = null;
                }
                return;
            }
            if (direction === 'to-ship') {
                const cargo = beforeTransfer.orbitalCargo.find(candidate => candidate.id === cargoId);
                const stack = cargo?.manifest.find(candidate => candidate.commodityId === commodityId);
                const quantity = amount === 'one' ? 1 : maximumOrbitalCargoTransfer(beforeTransfer, cargoId, commodityId, direction);
                const remaining = (cargo?.manifest.reduce((total, candidate) => total + candidate.quantity, 0) ?? 0) - Math.min(quantity, stack?.quantity ?? 0);
                if (quantity > 0 && remaining === 0) stayOpenCargoId = cargoId;
            }
            provider.update(state => {
                const quantity = amount === 'one' ? 1 : maximumOrbitalCargoTransfer(state, cargoId, commodityId, direction);
                if (quantity <= 0) return state;
                return transferOrbitalCargo(state, cargoId, commodityId, quantity, direction).state;
            });
        },
        close: () => { if (activeCargoId) suppressedIds.add(activeCargoId); activeCargoId = null; stayOpenCargoId = null; refresh(); },
        destroy: () => { if (destroyed) return; destroyed = true; unsubscribe(); game.events.off('step', step); game.events.off('salvage-pickup-cargo-full', failedPickup); listeners.clear(); }
    };
}
