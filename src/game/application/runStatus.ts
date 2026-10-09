import { cargoCapacityByLevel, maximumShipHitPoints } from '../domain/runBalance.ts';
import type { GameStateSnapshot } from '../state/gameStateSnapshot';

export type RunState = 'RUNNING' | 'PAUSED';
export type HealthBand = 'healthy' | 'warning' | 'critical';

/** Inclusive 70/69/30/29 boundaries shared by every hull-health presentation. */
export function healthBandOf (currentHitPoints: number): HealthBand
{
    return currentHitPoints >= 70 ? 'healthy' : currentHitPoints >= 30 ? 'warning' : 'critical';
}

export interface RunStatusCargoStack { readonly commodityId: string; readonly quantity: number; readonly totalCost: number; }
export interface RunStatusSystem { readonly level: number; readonly available: boolean; }
export interface RunStatusSnapshot
{
    readonly visible: boolean;
    readonly remainingSeconds: number;
    readonly runState: RunState;
    readonly credits: number;
    readonly cargo: readonly RunStatusCargoStack[];
    readonly cargoUsed: number;
    readonly cargoCapacity: number;
    readonly currentHitPoints: number;
    readonly maximumHitPoints: number;
    readonly healthBand: HealthBand;
    readonly cargoSystem: RunStatusSystem;
    readonly engineSystem: RunStatusSystem;
    readonly weaponSystem: RunStatusSystem;
    readonly boosterAvailable: boolean;
}

export function projectRunStatus (state: GameStateSnapshot, visible: boolean): RunStatusSnapshot
{
    const cargo = state.cargo.map(stack => ({ ...stack }));
    return {
        visible,
        remainingSeconds: Math.max(0, Math.ceil((state.clock.budgetMs - state.clock.activeElapsedMs) / 1000)),
        runState: state.clock.pauseReasons.length > 0 ? 'PAUSED' : 'RUNNING',
        credits: state.credits,
        cargo,
        cargoUsed: cargo.reduce((used, stack) => used + stack.quantity, 0),
        cargoCapacity: cargoCapacityByLevel[state.shipStatus.cargoLevel] ?? 0,
        currentHitPoints: state.shipStatus.currentHitPoints,
        maximumHitPoints: maximumShipHitPoints,
        healthBand: healthBandOf(state.shipStatus.currentHitPoints),
        cargoSystem: { level: state.shipStatus.cargoLevel, available: true },
        engineSystem: { level: state.shipStatus.engineLevel, available: true },
        weaponSystem: { level: state.shipStatus.weaponLevel, available: true },
        boosterAvailable: state.shipStatus.boosterUnlocked
    };
}
