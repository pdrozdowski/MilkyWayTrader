import type { GameStateSnapshot } from '../state/gameStateSnapshot.ts';
import type { PlanetId } from '../state/planetState.ts';
import type { PlanetFacilityId, PlanetFacilityState, SerotonMarketState } from '../state/serotonMarketState.ts';
import { landedMarketOf } from './serotonMarket.ts';

export type LandedFacilityInvestmentAction = 'build' | 'upgrade';

export type LandedFacilityInvestmentFailure = 'not-landed' | 'unknown-facility' | 'unavailable' | 'insufficient-credits';

export interface LandedFacilityInvestmentDefinition
{
    readonly id: PlanetFacilityId;
    readonly maxLevel: number;
    readonly upgradePrices: readonly [number, number];
}

export interface LandedFacilityInvestmentModifier
{
    readonly upgradePriceMultiplier: number;
}

export interface LandedFacilityCatalogue
{
    readonly definitions: readonly LandedFacilityInvestmentDefinition[];
    readonly modifierOf: (facilityId: PlanetFacilityId, planetId: PlanetId) => LandedFacilityInvestmentModifier;
}

export interface LandedFacilityInvestmentQuote
{
    readonly facilityId: PlanetFacilityId;
    readonly action: LandedFacilityInvestmentAction;
    readonly level: number;
    readonly targetLevel: number;
    readonly price: number;
    readonly failure: LandedFacilityInvestmentFailure | null;
}

function facilityStateOf (market: SerotonMarketState, facilityId: PlanetFacilityId): PlanetFacilityState
{
    const facility = market.facilities.find(candidate => candidate.facilityId === facilityId);
    if (!facility) throw new Error(`Missing landed facility ${facilityId}.`);
    return facility;
}

function investmentStep (level: number, action: LandedFacilityInvestmentAction, maxLevel: number, priceCount: number): Readonly<{ targetLevel: number; priceIndex: number }> | null
{
    if (action === 'build') return level === 0 && priceCount >= 1 ? { targetLevel: 1, priceIndex: 0 } : null;
    return level < 1 || level >= maxLevel || level - 1 >= priceCount ? null : { targetLevel: level + 1, priceIndex: level - 1 };
}

export function quoteFacilityInvestment (
    state: GameStateSnapshot,
    catalogue: LandedFacilityCatalogue,
    facilityId: PlanetFacilityId,
    action: LandedFacilityInvestmentAction
): LandedFacilityInvestmentQuote
{
    const market = landedMarketOf(state);
    if (market === null) return { facilityId, action, level: 0, targetLevel: 0, price: 0, failure: 'not-landed' };
    const definition = catalogue.definitions.find(candidate => candidate.id === facilityId);
    if (!definition) return { facilityId, action, level: 0, targetLevel: 0, price: 0, failure: 'unknown-facility' };
    const level = facilityStateOf(market, facilityId).level;
    const step = investmentStep(level, action, definition.maxLevel, definition.upgradePrices.length);
    if (step === null) return { facilityId, action, level, targetLevel: level, price: 0, failure: 'unavailable' };
    const price = Math.round(definition.upgradePrices[step.priceIndex] * catalogue.modifierOf(facilityId, market.planetId).upgradePriceMultiplier);
    return { facilityId, action, level, targetLevel: step.targetLevel, price, failure: price > state.credits ? 'insufficient-credits' : null };
}

function applyFacilityInvestment (
    state: GameStateSnapshot,
    catalogue: LandedFacilityCatalogue,
    facilityId: PlanetFacilityId,
    action: LandedFacilityInvestmentAction
): GameStateSnapshot
{
    const quote = quoteFacilityInvestment(state, catalogue, facilityId, action);
    if (quote.failure !== null) return state;
    const market = landedMarketOf(state);
    if (market === null) throw new Error('Missing landed market.');
    return {
        ...state,
        credits: state.credits - quote.price,
        markets: state.markets.map(candidate => candidate.planetId === market.planetId ? {
            ...candidate,
            facilities: candidate.facilities.map(facility => facility.facilityId === facilityId
                ? { ...facility, level: quote.targetLevel, status: 'working' }
                : facility)
        } : candidate)
    };
}

export function applyFacilityBuild (state: GameStateSnapshot, catalogue: LandedFacilityCatalogue, facilityId: PlanetFacilityId): GameStateSnapshot
{
    return applyFacilityInvestment(state, catalogue, facilityId, 'build');
}

export function applyFacilityUpgrade (state: GameStateSnapshot, catalogue: LandedFacilityCatalogue, facilityId: PlanetFacilityId): GameStateSnapshot
{
    return applyFacilityInvestment(state, catalogue, facilityId, 'upgrade');
}
