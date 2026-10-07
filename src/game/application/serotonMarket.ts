import { serotonCommodityPriceProfiles } from '../domain/serotonMarketCatalog.ts';
import { cargoCapacityByLevel } from '../domain/runBalance.ts';
import { marginalTradeTotal } from '../domain/marketPricing.ts';
import type { GameStateSnapshot } from '../state/gameStateSnapshot.ts';
import type { SerotonCommodityId, SerotonMarketState } from '../state/serotonMarketState.ts';
import { addPaidCommodity, removeCommodityQuantity } from './commodityContainers.ts';

export type LandedTradeFailure = 'not-landed' | 'invalid-quantity' | 'insufficient-stock' | 'insufficient-cargo' | 'insufficient-credits' | 'insufficient-cargo-commodity';

export interface LandedTradeQuote
{
    readonly commodityId: SerotonCommodityId;
    readonly quantity: number;
    readonly total: number;
    readonly failure: LandedTradeFailure | null;
}

export function landedMarketOf (state: GameStateSnapshot): SerotonMarketState | null
{
    const planetId = state.planetLifecycle.landedPlanetId;
    if (planetId === null) return null;
    const market = state.markets.find(candidate => candidate.planetId === planetId);
    if (!market) throw new Error(`Missing market for landed planet ${planetId}.`);
    return market;
}

function currentStock (market: SerotonMarketState, commodityId: SerotonCommodityId): number
{
    const commodity = market.commodityStocks.find(candidate => candidate.commodityId === commodityId);
    if (!commodity) throw new Error(`Missing landed market stock for ${commodityId}.`);
    return commodity.stock;
}

function cargoQuantity (state: GameStateSnapshot, commodityId: SerotonCommodityId): number
{
    return state.cargo.find(stack => stack.commodityId === commodityId)?.quantity ?? 0;
}

function cargoStack (state: GameStateSnapshot, commodityId: SerotonCommodityId)
{
    return state.cargo.find(stack => stack.commodityId === commodityId);
}

export function quoteLandedTrade (state: GameStateSnapshot, commodityId: SerotonCommodityId, quantity: number): LandedTradeQuote
{
    const market = landedMarketOf(state);
    if (market === null) return { commodityId, quantity, total: 0, failure: 'not-landed' };
    if (!Number.isSafeInteger(quantity) || quantity === 0) return { commodityId, quantity, total: 0, failure: 'invalid-quantity' };
    const stock = currentStock(market, commodityId);
    const carried = cargoQuantity(state, commodityId);
    if (quantity > stock) return { commodityId, quantity, total: 0, failure: 'insufficient-stock' };
    if (quantity < 0 && -quantity > carried) return { commodityId, quantity, total: 0, failure: 'insufficient-cargo-commodity' };
    if (quantity > 0) {
        const used = state.cargo.reduce((total, stack) => total + stack.quantity, 0);
        const capacity = cargoCapacityByLevel[state.shipStatus.cargoLevel] ?? 0;
        if (used + quantity > capacity) return { commodityId, quantity, total: 0, failure: 'insufficient-cargo' };
    }
    const total = marginalTradeTotal(stock, quantity, serotonCommodityPriceProfiles[commodityId]);
    if (quantity > 0 && total > state.credits) return { commodityId, quantity, total, failure: 'insufficient-credits' };
    return { commodityId, quantity, total, failure: null };
}

export function applyLandedTrade (state: GameStateSnapshot, commodityId: SerotonCommodityId, quantity: number): GameStateSnapshot
{
    const quote = quoteLandedTrade(state, commodityId, quantity);
    if (quote.failure !== null) return state;
    const market = landedMarketOf(state);
    if (market === null) throw new Error('Missing landed market.');
    const existingCargo = cargoStack(state, commodityId);
    const cargo = state.cargo.filter(stack => stack.commodityId !== commodityId);
    const nextCargo = quantity > 0
        ? [...cargo, addPaidCommodity(existingCargo, commodityId, quantity, quote.total)]
        : (() => {
            if (!existingCargo) throw new Error('Missing cargo to sell.');
            const remaining = removeCommodityQuantity(existingCargo, -quantity).remaining;
            return remaining === null ? cargo : [...cargo, remaining];
        })();
    return {
        ...state,
        credits: quantity > 0 ? state.credits - quote.total : state.credits + quote.total,
        cargo: nextCargo,
        markets: state.markets.map(candidate => candidate.planetId === market.planetId ? {
            ...candidate,
            commodityStocks: candidate.commodityStocks.map(stock => stock.commodityId === commodityId
                ? { ...stock, stock: stock.stock - quantity }
                : stock)
        } : candidate)
    };
}
