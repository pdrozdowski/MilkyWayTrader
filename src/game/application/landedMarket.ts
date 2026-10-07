import { cargoCapacityByLevel } from '../domain/runBalance.ts';
import { commodityUnitPrice } from '../domain/marketPricing.ts';
import type { GameStateSnapshot } from '../state/gameStateSnapshot.ts';
import type { PlanetId } from '../state/planetState.ts';
import type { SerotonCommodityId } from '../state/serotonMarketState.ts';
import { containerAverageCost } from './commodityContainers.ts';

export interface LandedMarketCommodityDefinition
{
    readonly id: SerotonCommodityId;
    readonly basePrice: number;
    readonly lowerStockThreshold: number;
    readonly upperStockThreshold: number;
}

export interface LandedMarketCommodityTuning
{
    readonly productionPerSecond: number;
    readonly consumptionPerSecond: number;
}

export type LandedMarketTuning = Readonly<Record<PlanetId, Readonly<Record<SerotonCommodityId, LandedMarketCommodityTuning>>>>;

export interface LandedMarketCommoditySnapshot
{
    readonly commodityId: SerotonCommodityId;
    readonly stock: number;
    readonly carriedQuantity: number;
    readonly unitPrice: number;
    readonly averageBuyPrice: number;
    readonly productionPerSecond: number;
    readonly consumptionPerSecond: number;
}

export interface LandedMarketQuoteSnapshot
{
    readonly quantity: number;
    readonly total: number;
    readonly failure: string | null;
    readonly postTradeStock: number;
    readonly nextUnitPrice: number;
}

export interface LandedMarketSnapshot
{
    readonly visible: boolean;
    readonly eligible: boolean;
    readonly planetId: string | null;
    readonly planetName: string | null;
    readonly credits: number;
    readonly cargoUsed: number;
    readonly cargoCapacity: number;
    readonly commodities: readonly LandedMarketCommoditySnapshot[];
    readonly selectedCommodityId: SerotonCommodityId;
    readonly tradeQuantity: number;
    readonly quote: LandedMarketQuoteSnapshot;
    readonly selectedCommodity: LandedMarketCommoditySnapshot;
    readonly plannedStockDelta: number;
    readonly plannedCargoDelta: number;
    readonly supplyLevel: 'Low' | 'Medium' | 'High';
}

export interface LandedMarketQuoteInput
{
    readonly quantity: number;
    readonly total: number;
    readonly failure: string | null;
}

export function projectLandedMarket (
    state: GameStateSnapshot,
    definitions: readonly LandedMarketCommodityDefinition[],
    tunings: LandedMarketTuning,
    selectedCommodityId: SerotonCommodityId,
    tradeQuantity: number,
    quote: LandedMarketQuoteInput
): LandedMarketSnapshot
{
    const planetId = state.planetLifecycle.landedPlanetId;
    const market = planetId === null
        ? null
        : state.markets.find(candidate => candidate.planetId === planetId) ?? null;
    if (planetId !== null && !market) throw new Error('Missing market for the landed planet.');
    const tuning = market === null ? null : tunings[market.planetId];
    const cargoUsed = state.cargo.reduce((total, stack) => total + stack.quantity, 0);
    const selectedDefinition = definitions.find(definition => definition.id === selectedCommodityId);
    if (!selectedDefinition) throw new Error(`Missing selected landed commodity ${selectedCommodityId}.`);
    const selectedStock = market === null
        ? undefined
        : market.commodityStocks.find(candidate => candidate.commodityId === selectedCommodityId);
    if (market !== null && !selectedStock) throw new Error(`Missing selected landed commodity ${selectedCommodityId}.`);
    const selectedStockLevel = selectedStock?.stock ?? 0;
    const commodities = definitions.map(definition => {
        const stock = market === null ? undefined : market.commodityStocks.find(candidate => candidate.commodityId === definition.id);
        if (market !== null && !stock) throw new Error(`Missing landed stock for ${definition.id}.`);
        const stockLevel = stock?.stock ?? 0;
        const commodityTuning = tuning === null ? undefined : tuning[definition.id];
        return Object.freeze({
            commodityId: definition.id,
            stock: stockLevel,
            carriedQuantity: state.cargo.find(stack => stack.commodityId === definition.id)?.quantity ?? 0,
            unitPrice: commodityUnitPrice(stockLevel, definition),
            averageBuyPrice: containerAverageCost(state.cargo.find(stack => stack.commodityId === definition.id) ?? { commodityId: definition.id, quantity: 0, totalCost: 0 }),
            productionPerSecond: commodityTuning?.productionPerSecond ?? 0,
            consumptionPerSecond: commodityTuning?.consumptionPerSecond ?? 0
        });
    });
    const selectedCommodity = commodities.find(commodity => commodity.commodityId === selectedCommodityId);
    if (!selectedCommodity) throw new Error(`Missing selected landed commodity ${selectedCommodityId}.`);
    const supplyLevel = selectedStockLevel < selectedDefinition.lowerStockThreshold ? 'Low'
        : selectedStockLevel > selectedDefinition.upperStockThreshold ? 'High'
            : 'Medium';
    return Object.freeze({
        visible: planetId !== null,
        eligible: planetId !== null,
        planetId,
        planetName: state.planets.find(planet => planet.id === planetId)?.name ?? null,
        credits: state.credits,
        cargoUsed,
        cargoCapacity: cargoCapacityByLevel[state.shipStatus.cargoLevel] ?? 0,
        commodities: Object.freeze(commodities),
        selectedCommodityId,
        tradeQuantity,
        selectedCommodity,
        plannedStockDelta: -quote.quantity,
        plannedCargoDelta: quote.quantity,
        supplyLevel,
        quote: Object.freeze({
            ...quote,
            postTradeStock: selectedStockLevel - quote.quantity,
            nextUnitPrice: commodityUnitPrice(selectedStockLevel - quote.quantity, selectedDefinition)
        })
    });
}
