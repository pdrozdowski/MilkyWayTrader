import { cargoCapacityByLevel } from '../domain/runBalance.ts';
import { commodityUnitPrice } from '../domain/marketPricing.ts';
import type { GameStateSnapshot } from '../state/gameStateSnapshot.ts';
import type { SerotonCommodityId } from '../state/serotonMarketState.ts';
import { containerAverageCost } from './commodityContainers.ts';

export interface LandedMarketCommodityDefinition
{
    readonly id: SerotonCommodityId;
    readonly basePrice: number;
    readonly lowerStockThreshold: number;
    readonly upperStockThreshold: number;
    readonly productionPerSecond: number;
    readonly consumptionPerSecond: number;
}

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
    selectedCommodityId: SerotonCommodityId,
    tradeQuantity: number,
    quote: LandedMarketQuoteInput
): LandedMarketSnapshot
{
    const planetId = state.planetLifecycle.landedPlanetId;
    const market = state.markets.find(candidate => candidate.planetId === 'seroton');
    if (!market) throw new Error('Missing Seroton market.');
    const cargoUsed = state.cargo.reduce((total, stack) => total + stack.quantity, 0);
    const selectedDefinition = definitions.find(definition => definition.id === selectedCommodityId);
    const selectedStock = market.commodityStocks.find(candidate => candidate.commodityId === selectedCommodityId);
    if (!selectedDefinition || !selectedStock) throw new Error(`Missing selected Seroton commodity ${selectedCommodityId}.`);
    const commodities = definitions.map(definition => {
        const stock = market.commodityStocks.find(candidate => candidate.commodityId === definition.id);
        if (!stock) throw new Error(`Missing Seroton stock for ${definition.id}.`);
        return Object.freeze({
            commodityId: definition.id,
            stock: stock.stock,
            carriedQuantity: state.cargo.find(stack => stack.commodityId === definition.id)?.quantity ?? 0,
            unitPrice: commodityUnitPrice(stock.stock, definition),
            averageBuyPrice: containerAverageCost(state.cargo.find(stack => stack.commodityId === definition.id) ?? { commodityId: definition.id, quantity: 0, totalCost: 0 }),
            productionPerSecond: definition.productionPerSecond,
            consumptionPerSecond: definition.consumptionPerSecond
        });
    });
    const selectedCommodity = commodities.find(commodity => commodity.commodityId === selectedCommodityId);
    if (!selectedCommodity) throw new Error(`Missing selected Seroton commodity ${selectedCommodityId}.`);
    const supplyLevel = selectedStock.stock < selectedDefinition.lowerStockThreshold ? 'Low'
        : selectedStock.stock > selectedDefinition.upperStockThreshold ? 'High'
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
            postTradeStock: selectedStock.stock - quote.quantity,
            nextUnitPrice: commodityUnitPrice(selectedStock.stock - quote.quantity, selectedDefinition)
        })
    });
}
