import { cargoCapacityByLevel } from '../domain/runBalance.ts';
import { quoteFacilityInvestment } from './planetFacilities.ts';
import type { LandedFacilityInvestmentAction } from './planetFacilities.ts';
import type { RunState } from './runStatus.ts';
import type { GameStateSnapshot } from '../state/gameStateSnapshot.ts';
import type { PlanetId } from '../state/planetState.ts';
import type { PlanetFacilityId, PlanetFacilityStatus, SerotonCommodityId } from '../state/serotonMarketState.ts';

export interface LandedFacilityProjectionInput
{
    readonly commodityId: SerotonCommodityId;
    readonly quantity: number;
}

export interface LandedFacilityProjectionDefinition
{
    readonly id: PlanetFacilityId;
    readonly label: string;
    readonly maxLevel: number;
    readonly outputCommodityId: SerotonCommodityId;
    readonly outputByLevel: readonly number[];
    readonly inputsPerOutput: readonly LandedFacilityProjectionInput[];
    readonly upgradePrices: readonly [number, number];
}

export interface LandedFacilityProjectionModifier
{
    readonly upgradePriceMultiplier: number;
    readonly outputMultiplier: number;
}

export interface LandedFacilityProjectionCatalogue
{
    readonly definitions: readonly LandedFacilityProjectionDefinition[];
    readonly modifierOf: (facilityId: PlanetFacilityId, planetId: PlanetId) => LandedFacilityProjectionModifier;
}

export type LandedFacilityActionKind = LandedFacilityInvestmentAction | 'max';

export interface LandedFacilityActionSnapshot
{
    readonly kind: LandedFacilityActionKind;
    readonly targetLevel: number;
    readonly price: number;
    readonly affordable: boolean;
}

export interface LandedFacilityRowSnapshot
{
    readonly facilityId: PlanetFacilityId;
    readonly label: string;
    readonly level: number;
    readonly maxLevel: number;
    readonly status: PlanetFacilityStatus;
    readonly outputCommodityId: SerotonCommodityId;
    readonly outputPerCycle: number;
    readonly inputsPerCycle: readonly LandedFacilityProjectionInput[];
    readonly modifier: LandedFacilityProjectionModifier;
    readonly action: LandedFacilityActionSnapshot;
}

export interface LandedFacilitiesClockSnapshot
{
    readonly remainingSeconds: number;
    readonly runState: RunState;
}

export interface LandedFacilitiesSnapshot
{
    readonly visible: boolean;
    readonly eligible: boolean;
    readonly planetId: string | null;
    readonly planetName: string | null;
    readonly credits: number;
    readonly cargoUsed: number;
    readonly cargoCapacity: number;
    readonly clock: LandedFacilitiesClockSnapshot;
    readonly facilities: readonly LandedFacilityRowSnapshot[];
}

function investmentAction (
    state: GameStateSnapshot,
    catalogue: LandedFacilityProjectionCatalogue,
    facilityId: PlanetFacilityId,
    action: LandedFacilityInvestmentAction
): LandedFacilityActionSnapshot
{
    const quote = quoteFacilityInvestment(state, catalogue, facilityId, action);
    return Object.freeze({ kind: action, targetLevel: quote.targetLevel, price: quote.price, affordable: quote.failure === null });
}

export function projectLandedFacilities (
    state: GameStateSnapshot,
    catalogue: LandedFacilityProjectionCatalogue
): LandedFacilitiesSnapshot
{
    const planetId = state.planetLifecycle.landedPlanetId;
    const market = planetId === null ? null : state.markets.find(candidate => candidate.planetId === planetId) ?? null;
    if (planetId !== null && !market) throw new Error('Missing market for the landed planet.');
    const cargoUsed = state.cargo.reduce((total, stack) => total + stack.quantity, 0);
    const cargoCapacity = cargoCapacityByLevel[state.shipStatus.cargoLevel] ?? 0;
    const clock: LandedFacilitiesClockSnapshot = {
        remainingSeconds: Math.max(0, Math.ceil((state.clock.budgetMs - state.clock.activeElapsedMs) / 1000)),
        runState: state.clock.pauseReasons.length > 0 ? 'PAUSED' : 'RUNNING'
    };
    if (planetId === null || market === null) {
        return Object.freeze({
            visible: false,
            eligible: false,
            planetId: null,
            planetName: null,
            credits: state.credits,
            cargoUsed,
            cargoCapacity,
            clock: Object.freeze(clock),
            facilities: Object.freeze([])
        });
    }
    const facilities = catalogue.definitions.map(definition => {
        const facility = market.facilities.find(candidate => candidate.facilityId === definition.id);
        if (!facility) throw new Error(`Missing landed facility ${definition.id}.`);
        const modifier = catalogue.modifierOf(definition.id, market.planetId);
        const outputPerCycle = facility.level > 0 ? Math.round(definition.outputByLevel[facility.level - 1] * modifier.outputMultiplier) : 0;
        const inputsPerCycle: LandedFacilityProjectionInput[] = facility.level > 0
            ? definition.inputsPerOutput.map(input => Object.freeze({ commodityId: input.commodityId, quantity: input.quantity * outputPerCycle }))
            : [];
        const action: LandedFacilityActionSnapshot = facility.level === 0
            ? investmentAction(state, catalogue, definition.id, 'build')
            : facility.level >= definition.maxLevel
                ? Object.freeze({ kind: 'max' as const, targetLevel: definition.maxLevel, price: 0, affordable: true })
                : investmentAction(state, catalogue, definition.id, 'upgrade');
        return Object.freeze({
            facilityId: definition.id,
            label: definition.label,
            level: facility.level,
            maxLevel: definition.maxLevel,
            status: facility.status,
            outputCommodityId: definition.outputCommodityId,
            outputPerCycle,
            inputsPerCycle: Object.freeze(inputsPerCycle),
            modifier: Object.freeze({ ...modifier }),
            action
        });
    });
    return Object.freeze({
        visible: true,
        eligible: true,
        planetId,
        planetName: state.planets.find(planet => planet.id === planetId)?.name ?? null,
        credits: state.credits,
        cargoUsed,
        cargoCapacity,
        clock: Object.freeze(clock),
        facilities: Object.freeze(facilities)
    });
}


export interface LandedCommodityFlowSnapshot
{
    readonly productionPerSecond: number;
    readonly consumptionPerSecond: number;
    readonly netPerSecond: number;
}

/** Per-second production, consumption and net flow of one commodity across the landed planet's facilities. */
export function landedCommodityFlow (snapshot: LandedFacilitiesSnapshot, commodityId: SerotonCommodityId): LandedCommodityFlowSnapshot
{
    let productionPerSecond = 0;
    let consumptionPerSecond = 0;
    for (const facility of snapshot.facilities) {
        if (facility.outputCommodityId === commodityId) productionPerSecond += facility.outputPerCycle;
        for (const input of facility.inputsPerCycle) {
            if (input.commodityId === commodityId) consumptionPerSecond += input.quantity;
        }
    }
    return Object.freeze({ productionPerSecond, consumptionPerSecond, netPerSecond: productionPerSecond - consumptionPerSecond });
}