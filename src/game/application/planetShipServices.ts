import {
    cargoUpgradePrices,
    engineUpgradePrices,
    maximumShipHitPoints,
    shipBoosterCost,
    shipRepairCost,
    shipRepairHitPointPercent,
    weaponUpgradePrices
} from '../domain/runBalance.ts';
import type { GameStateSnapshot } from '../state/gameStateSnapshot.ts';
import type { PlanetId } from '../state/planetState.ts';
import { landedMarketOf } from './serotonMarket.ts';

/** The three independent ship-service paths; each is sold on exactly one planet (BR-073 to BR-076). */
export const shipServiceIds = ['cargo', 'engine', 'weaponary'] as const;

export type ShipServiceId = (typeof shipServiceIds)[number];

export type ShipServiceAction = 'repair' | 'upgrade' | 'booster';

export type ShipServiceFailure =
    | 'not-landed'
    | 'unknown-service'
    | 'wrong-planet'
    | 'insufficient-credits'
    | 'full-health'
    | 'ship-destroyed'
    | 'maximum-level'
    | 'already-owned';

export interface ShipServiceDefinition
{
    readonly id: ShipServiceId;
    readonly label: string;
    readonly servicePlanetId: PlanetId;
    readonly maximumLevel: number;
    /** Price paid to reach each level above one; the first entry buys level two. */
    readonly upgradePrices: readonly number[];
}

export const shipServiceDefinitions: readonly ShipServiceDefinition[] = [
    { id: 'cargo', label: 'Cargo Capacity', servicePlanetId: 'seroton', maximumLevel: 5, upgradePrices: cargoUpgradePrices },
    { id: 'engine', label: 'Engine System', servicePlanetId: 'lactozis-7c', maximumLevel: 5, upgradePrices: engineUpgradePrices },
    { id: 'weaponary', label: 'Weapon System', servicePlanetId: 'maslo-prime', maximumLevel: 10, upgradePrices: weaponUpgradePrices }
];

/** The booster is an independent one-time purchase on the engine-service planet (BR-036). */
export const shipBoosterServicePlanetId: PlanetId = 'lactozis-7c';

const shipServiceDefinitionById: Readonly<Record<ShipServiceId, ShipServiceDefinition>> = Object.freeze(
    Object.fromEntries(shipServiceDefinitions.map(definition => [definition.id, definition])) as Record<ShipServiceId, ShipServiceDefinition>
);

export function shipServiceDefinitionOf (serviceId: ShipServiceId): ShipServiceDefinition
{
    return shipServiceDefinitionById[serviceId];
}

export interface ShipServiceQuote
{
    readonly action: ShipServiceAction;
    readonly serviceId: ShipServiceId | null;
    /** Current level, or current hit points for a repair. */
    readonly level: number;
    /** Level the purchase reaches, or restored hit points for a repair. */
    readonly targetLevel: number;
    readonly price: number;
    readonly failure: ShipServiceFailure | null;
}

function shipLevel (state: GameStateSnapshot, serviceId: ShipServiceId): number
{
    if (serviceId === 'cargo') return state.shipStatus.cargoLevel;
    if (serviceId === 'engine') return state.shipStatus.engineLevel;
    return state.shipStatus.weaponLevel;
}

function withShipLevel (state: GameStateSnapshot, serviceId: ShipServiceId, level: number): GameStateSnapshot
{
    if (serviceId === 'cargo') return { ...state, shipStatus: { ...state.shipStatus, cargoLevel: level } };
    if (serviceId === 'engine') return { ...state, shipStatus: { ...state.shipStatus, engineLevel: level } };
    return { ...state, shipStatus: { ...state.shipStatus, weaponLevel: level } };
}

/** 10% of maximum HP added per purchase, never above maximum HP (BR-071, BR-072). */
function repairedHitPoints (currentHitPoints: number): number
{
    return Math.min(maximumShipHitPoints, currentHitPoints + Math.round(maximumShipHitPoints * shipRepairHitPointPercent / 100));
}

export function quoteShipRepair (state: GameStateSnapshot): ShipServiceQuote
{
    const quote = {
        action: 'repair' as const,
        serviceId: null,
        level: state.shipStatus.currentHitPoints,
        targetLevel: state.shipStatus.currentHitPoints,
        price: shipRepairCost
    };
    if (landedMarketOf(state) === null) return { ...quote, failure: 'not-landed' };
    if (state.shipStatus.currentHitPoints <= 0) return { ...quote, failure: 'ship-destroyed' };
    const targetLevel = repairedHitPoints(state.shipStatus.currentHitPoints);
    if (targetLevel === state.shipStatus.currentHitPoints) return { ...quote, failure: 'full-health' };
    return { ...quote, targetLevel, failure: shipRepairCost > state.credits ? 'insufficient-credits' : null };
}

export function applyShipRepair (state: GameStateSnapshot): GameStateSnapshot
{
    const quote = quoteShipRepair(state);
    if (quote.failure !== null) return state;
    return {
        ...state,
        credits: state.credits - quote.price,
        shipStatus: { ...state.shipStatus, currentHitPoints: quote.targetLevel }
    };
}

export function quoteShipUpgrade (state: GameStateSnapshot, serviceId: ShipServiceId): ShipServiceQuote
{
    const definition = shipServiceDefinitionOf(serviceId);
    if (!definition) return { action: 'upgrade', serviceId, level: 0, targetLevel: 0, price: 0, failure: 'unknown-service' };
    const market = landedMarketOf(state);
    if (market === null) return { action: 'upgrade', serviceId, level: 0, targetLevel: 0, price: 0, failure: 'not-landed' };
    const level = shipLevel(state, serviceId);
    if (level >= definition.maximumLevel) {
        return { action: 'upgrade', serviceId, level, targetLevel: level, price: 0, failure: 'maximum-level' };
    }
    const targetLevel = level + 1;
    const price = definition.upgradePrices[level - 1];
    if (market.planetId !== definition.servicePlanetId) {
        return { action: 'upgrade', serviceId, level, targetLevel, price, failure: 'wrong-planet' };
    }
    return { action: 'upgrade', serviceId, level, targetLevel, price, failure: price > state.credits ? 'insufficient-credits' : null };
}

export function applyShipUpgrade (state: GameStateSnapshot, serviceId: ShipServiceId): GameStateSnapshot
{
    const quote = quoteShipUpgrade(state, serviceId);
    if (quote.failure !== null) return state;
    return { ...withShipLevel(state, serviceId, quote.targetLevel), credits: state.credits - quote.price };
}

export function quoteShipBooster (state: GameStateSnapshot): ShipServiceQuote
{
    const quote = {
        action: 'booster' as const,
        serviceId: null,
        level: state.shipStatus.boosterUnlocked ? 1 : 0,
        targetLevel: 1,
        price: shipBoosterCost
    };
    const market = landedMarketOf(state);
    if (market === null) return { ...quote, failure: 'not-landed' };
    if (state.shipStatus.boosterUnlocked) return { ...quote, failure: 'already-owned' };
    if (market.planetId !== shipBoosterServicePlanetId) return { ...quote, failure: 'wrong-planet' };
    return { ...quote, failure: shipBoosterCost > state.credits ? 'insufficient-credits' : null };
}

export function applyShipBooster (state: GameStateSnapshot): GameStateSnapshot
{
    const quote = quoteShipBooster(state);
    if (quote.failure !== null) return state;
    return {
        ...state,
        credits: state.credits - quote.price,
        shipStatus: { ...state.shipStatus, boosterUnlocked: true }
    };
}
