import { cargoCapacityByLevel } from '../domain/runBalance.ts';
import { commodityUnitPrice } from '../domain/marketPricing.ts';
import type { GameStateSnapshot } from '../state/gameStateSnapshot.ts';
import type { SerotonCommodityId } from '../state/serotonMarketState.ts';
import { containerAverageCost } from './commodityContainers.ts';
import type { LandedCommodityFlowSnapshot, LandedFacilitiesClockSnapshot } from './landedFacilities.ts';

export interface LandedMarketCommodityDefinition
{
    readonly id: SerotonCommodityId;
    readonly basePrice: number;
    readonly lowerStockThreshold: number;
    readonly upperStockThreshold: number;
}

export interface LandedMarketCommoditySnapshot
{
    readonly commodityId: SerotonCommodityId;
    readonly stock: number;
    readonly stockCapacity: number;
    readonly lowerStockThreshold: number;
    readonly upperStockThreshold: number;
    readonly supplyLevel: 'Low' | 'Medium' | 'High';
    readonly carriedQuantity: number;
    readonly unitPrice: number;
    readonly averageBuyPrice: number;
    readonly netPerSecond: number;
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
    readonly commodityFlow: LandedCommodityFlowSnapshot;
    readonly clock: LandedFacilitiesClockSnapshot;
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
    selectedCommodityId: SerotonCommodityId,
    tradeQuantity: number,
    quote: LandedMarketQuoteInput,
    commodityFlow: LandedCommodityFlowSnapshot,
    clock: LandedFacilitiesClockSnapshot,
    commodityFlows: Readonly<Partial<Record<SerotonCommodityId, LandedCommodityFlowSnapshot>>> = {}
): LandedMarketSnapshot
{
    const planetId = state.planetLifecycle.landedPlanetId;
    const market = planetId === null
        ? null
        : state.markets.find(candidate => candidate.planetId === planetId) ?? null;
    if (planetId !== null && !market) throw new Error('Missing market for the landed planet.');
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
        const supplyLevel = stockLevel < definition.lowerStockThreshold ? 'Low'
            : stockLevel > definition.upperStockThreshold ? 'High'
                : 'Medium';
        return Object.freeze({
            commodityId: definition.id,
            stock: stockLevel,
            stockCapacity: definition.lowerStockThreshold + definition.upperStockThreshold,
            lowerStockThreshold: definition.lowerStockThreshold,
            upperStockThreshold: definition.upperStockThreshold,
            supplyLevel,
            carriedQuantity: state.cargo.find(stack => stack.commodityId === definition.id)?.quantity ?? 0,
            unitPrice: commodityUnitPrice(stockLevel, definition),
            averageBuyPrice: containerAverageCost(state.cargo.find(stack => stack.commodityId === definition.id) ?? { commodityId: definition.id, quantity: 0, totalCost: 0 }),
            netPerSecond: commodityFlows[definition.id]?.netPerSecond ?? (definition.id === selectedCommodityId ? commodityFlow.netPerSecond : 0)
        });
    });
    const selectedCommodity = commodities.find(commodity => commodity.commodityId === selectedCommodityId);
    if (!selectedCommodity) throw new Error(`Missing selected landed commodity ${selectedCommodityId}.`);
    const supplyLevel = selectedCommodity.supplyLevel;
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
        commodityFlow,
        clock,
        quote: Object.freeze({
            ...quote,
            postTradeStock: selectedStockLevel - quote.quantity,
            nextUnitPrice: commodityUnitPrice(selectedStockLevel - quote.quantity, selectedDefinition)
        })
    });
}
