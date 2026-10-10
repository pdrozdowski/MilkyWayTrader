import {
    cargoCapacityByLevel,
    engineNormalSpeedPercentByLevel,
    maximumShipHitPoints,
    shipBoosterCost,
    shipRepairCost,
    shipRepairHitPointPercent,
    weaponProjectileCountByLevel
} from '../domain/runBalance.ts';
import { quoteShipBooster, quoteShipRepair, quoteShipUpgrade, shipBoosterServicePlanetId, shipServiceDefinitions, shipServiceLevelOf } from './planetShipServices.ts';
import type { ShipServiceFailure, ShipServiceId } from './planetShipServices.ts';
import { healthBandOf } from './runStatus.ts';
import type { HealthBand, RunState } from './runStatus.ts';
import type { GameStateSnapshot } from '../state/gameStateSnapshot.ts';
import type { PlanetId } from '../state/planetState.ts';

export interface LandedShipyardClockSnapshot
{
    readonly remainingSeconds: number;
    readonly runState: RunState;
    readonly playerPaused: boolean;
}

export interface LandedShipyardRepairSnapshot
{
    readonly currentHitPoints: number;
    readonly maximumHitPoints: number;
    /** Hit points one purchase adds before the maximum-HP ceiling is applied. */
    readonly incrementHitPoints: number;
    readonly price: number;
    readonly failure: ShipServiceFailure | null;
    readonly healthBand: HealthBand;
}

export interface LandedShipyardServiceSnapshot
{
    readonly serviceId: ShipServiceId;
    readonly label: string;
    readonly servicePlanetId: PlanetId;
    readonly servicePlanetName: string;
    readonly level: number;
    readonly maximumLevel: number;
    /** Price of the next level; zero once the path is at its maximum level. */
    readonly price: number;
    readonly available: boolean;
    readonly affordable: boolean;
    readonly maximum: boolean;
    readonly failure: ShipServiceFailure | null;
    /** Capability the path currently provides, read from its balance table. */
    readonly currentCapability: number;
    readonly maximumCapability: number;
}

export interface LandedShipyardBoosterSnapshot
{
    readonly owned: boolean;
    readonly price: number;
    readonly servicePlanetId: PlanetId;
    readonly servicePlanetName: string;
    readonly available: boolean;
    readonly affordable: boolean;
    readonly failure: ShipServiceFailure | null;
}

export interface LandedShipyardSnapshot
{
    readonly visible: boolean;
    readonly eligible: boolean;
    readonly planetId: string | null;
    readonly planetName: string | null;
    readonly credits: number;
    readonly cargoUsed: number;
    readonly cargoCapacity: number;
    readonly clock: LandedShipyardClockSnapshot;
    readonly repair: LandedShipyardRepairSnapshot;
    readonly services: readonly LandedShipyardServiceSnapshot[];
    readonly booster: LandedShipyardBoosterSnapshot;
}

function planetNameOf (state: GameStateSnapshot, planetId: string): string
{
    return state.planets.find(planet => planet.id === planetId)?.name ?? planetId;
}

const capabilityByLevel: Readonly<Record<ShipServiceId, Readonly<Record<number, number>>>> = {
    cargo: cargoCapacityByLevel,
    engine: engineNormalSpeedPercentByLevel,
    weaponary: weaponProjectileCountByLevel
};

function capabilityOf (serviceId: ShipServiceId, level: number): number
{
    return capabilityByLevel[serviceId][level] ?? 0;
}

/** Readonly landed shipyard view: repair, the three upgrade paths and the booster row (BR-069 to BR-077). */
export function projectLandedShipyard (state: GameStateSnapshot): LandedShipyardSnapshot
{
    const planetId = state.planetLifecycle.landedPlanetId;
    const cargoUsed = state.cargo.reduce((total, stack) => total + stack.quantity, 0);
    const clock: LandedShipyardClockSnapshot = {
        remainingSeconds: Math.max(0, Math.ceil((state.clock.budgetMs - state.clock.activeElapsedMs) / 1000)),
        runState: state.clock.playerPaused || state.clock.pauseReasons.length > 0 ? 'PAUSED' : 'RUNNING',
        playerPaused: state.clock.playerPaused
    };
    const repairQuote = quoteShipRepair(state);
    const repair: LandedShipyardRepairSnapshot = {
        currentHitPoints: state.shipStatus.currentHitPoints,
        maximumHitPoints: maximumShipHitPoints,
        incrementHitPoints: Math.round(maximumShipHitPoints * shipRepairHitPointPercent / 100),
        price: shipRepairCost,
        failure: repairQuote.failure,
        healthBand: healthBandOf(state.shipStatus.currentHitPoints)
    };
    const services: readonly LandedShipyardServiceSnapshot[] = shipServiceDefinitions.map(definition => {
        const level = shipServiceLevelOf(state, definition.id);
        const quote = quoteShipUpgrade(state, definition.id);
        const maximum = level >= definition.maximumLevel;
        return Object.freeze({
            serviceId: definition.id,
            label: definition.label,
            servicePlanetId: definition.servicePlanetId,
            servicePlanetName: planetNameOf(state, definition.servicePlanetId),
            level,
            maximumLevel: definition.maximumLevel,
            price: maximum ? 0 : quote.price,
            available: planetId === definition.servicePlanetId && !maximum,
            affordable: quote.failure === null,
            maximum,
            failure: quote.failure,
            currentCapability: capabilityOf(definition.id, level),
            maximumCapability: capabilityOf(definition.id, definition.maximumLevel)
        });
    });
    const boosterQuote = quoteShipBooster(state);
    const booster: LandedShipyardBoosterSnapshot = {
        owned: state.shipStatus.boosterUnlocked,
        price: shipBoosterCost,
        servicePlanetId: shipBoosterServicePlanetId,
        servicePlanetName: planetNameOf(state, shipBoosterServicePlanetId),
        available: planetId === shipBoosterServicePlanetId && !state.shipStatus.boosterUnlocked,
        affordable: boosterQuote.failure === null,
        failure: boosterQuote.failure
    };
    return Object.freeze({
        visible: planetId !== null,
        eligible: planetId !== null,
        planetId,
        planetName: planetId === null ? null : planetNameOf(state, planetId),
        credits: state.credits,
        cargoUsed,
        cargoCapacity: cargoCapacityByLevel[state.shipStatus.cargoLevel] ?? 0,
        clock: Object.freeze(clock),
        repair: Object.freeze(repair),
        services: Object.freeze(services),
        booster: Object.freeze(booster)
    });
}
