import { serotonCommodityPriceProfiles } from '../domain/serotonMarketCatalog.ts';
import { cargoCapacityByLevel } from '../domain/runBalance.ts';
import { marginalTradeTotal } from '../domain/marketPricing.ts';
import type { GameStateSnapshot } from '../state/gameStateSnapshot.ts';
import type { SerotonCommodityId } from '../state/serotonMarketState.ts';

export type SerotonTradeFailure = 'not-landed-on-seroton' | 'invalid-quantity' | 'insufficient-stock' | 'insufficient-cargo' | 'insufficient-credits' | 'insufficient-cargo-commodity';

export interface SerotonTradeQuote
{
    readonly commodityId: SerotonCommodityId;
    readonly quantity: number;
    readonly total: number;
    readonly failure: SerotonTradeFailure | null;
}

function currentStock (state: GameStateSnapshot, commodityId: SerotonCommodityId): number
{
    const market = state.markets.find(candidate => candidate.planetId === 'seroton');
    const commodity = market?.commodityStocks.find(candidate => candidate.commodityId === commodityId);
    if (!commodity) throw new Error(`Missing Seroton stock for ${commodityId}.`);
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

export function quoteSerotonTrade (state: GameStateSnapshot, commodityId: SerotonCommodityId, quantity: number): SerotonTradeQuote
{
    if (state.planetLifecycle.landedPlanetId !== 'seroton') return { commodityId, quantity, total: 0, failure: 'not-landed-on-seroton' };
    if (!Number.isSafeInteger(quantity) || quantity === 0) return { commodityId, quantity, total: 0, failure: 'invalid-quantity' };
    const stock = currentStock(state, commodityId);
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

export function applySerotonTrade (state: GameStateSnapshot, commodityId: SerotonCommodityId, quantity: number): GameStateSnapshot
{
    const quote = quoteSerotonTrade(state, commodityId, quantity);
    if (quote.failure !== null) return state;
    const market = state.markets.find(candidate => candidate.planetId === 'seroton');
    if (!market) throw new Error('Missing Seroton market.');
    const existingCargo = cargoStack(state, commodityId);
    const cargoBefore = existingCargo?.quantity ?? 0;
    const cargoAfter = cargoBefore + quantity;
    const cargo = state.cargo.filter(stack => stack.commodityId !== commodityId);
    const averageBuyPrice = quantity > 0
        ? ((cargoBefore * (existingCargo?.averageBuyPrice ?? 0)) + quote.total) / cargoAfter
        : existingCargo?.averageBuyPrice ?? 0;
    const nextCargo = cargoAfter === 0 ? cargo : [...cargo, { commodityId, quantity: cargoAfter, averageBuyPrice }];
    return {
        ...state,
        credits: quantity > 0 ? state.credits - quote.total : state.credits + quote.total,
        cargo: nextCargo,
        markets: state.markets.map(candidate => candidate.planetId === 'seroton' ? {
            ...candidate,
            commodityStocks: candidate.commodityStocks.map(stock => stock.commodityId === commodityId
                ? { ...stock, stock: stock.stock - quantity }
                : stock)
        } : candidate)
    };
}
