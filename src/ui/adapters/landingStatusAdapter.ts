import type { Game } from 'phaser';
import type { GameStateProvider } from '../../game/application/gameStateProvider.ts';
import { projectLandedMarket } from '../../game/application/landedMarket.ts';
import { serotonCommodityDefinitions } from '../../game/definitions/serotonMarketDefinitions.ts';
import { cargoCapacityByLevel } from '../../game/domain/runBalance.ts';
import { applySerotonTrade, quoteSerotonTrade, type SerotonTradeQuote } from '../../game/application/serotonMarket.ts';
import { launchFromPlanet } from '../../game/mechanics/planet/landing.ts';
import type { LandingStatusPort, LandingStatusSnapshot } from '../contracts.ts';
import type { SerotonCommodityId } from '../../game/state/serotonMarketState.ts';

export function createLandingStatusPort (game: Game): LandingStatusPort
{
    const provider = game.registry.get('gameStateProvider') as GameStateProvider;
    const listeners = new Set<(snapshot: Readonly<LandingStatusSnapshot>) => void>();
    let destroyed = false;
    let selectedCommodityId: SerotonCommodityId = 'supplies';
    let tradeQuantity = 0;
    let wasEligible = false;
    let refreshSuppressed = false;
    let priceLadder = new Map<SerotonCommodityId, ReadonlyMap<number, SerotonTradeQuote>>();
    const tradeBounds = (commodityId: SerotonCommodityId): Readonly<{ minimum: number; maximum: number }> => {
        const state = provider.snapshot();
        const stock = state.markets[0].commodityStocks.find(candidate => candidate.commodityId === commodityId)?.stock;
        if (stock === undefined) throw new Error(`Missing Seroton stock for ${commodityId}.`);
        const carried = state.cargo.find(stack => stack.commodityId === commodityId)?.quantity ?? 0;
        const used = state.cargo.reduce((total, stack) => total + stack.quantity, 0);
        return { minimum: -carried, maximum: Math.min(stock, (cargoCapacityByLevel[state.shipStatus.cargoLevel] ?? 0) - used) };
    };
    const rebuildPriceLadder = (): void => {
        const next = new Map<SerotonCommodityId, ReadonlyMap<number, SerotonTradeQuote>>();
        for (const definition of serotonCommodityDefinitions) {
            const ladder = new Map<number, SerotonTradeQuote>();
            const bounds = tradeBounds(definition.id);
            for (let quantity = bounds.minimum; quantity <= bounds.maximum; quantity++) ladder.set(quantity, quoteSerotonTrade(provider.snapshot(), definition.id, quantity));
            next.set(definition.id, ladder);
        }
        priceLadder = next;
    };
    const selectedQuote = (): SerotonTradeQuote => priceLadder.get(selectedCommodityId)?.get(tradeQuantity)
        ?? quoteSerotonTrade(provider.snapshot(), selectedCommodityId, tradeQuantity);
    const project = (): LandingStatusSnapshot => {
        const state = provider.snapshot();
        return projectLandedMarket(state, serotonCommodityDefinitions, selectedCommodityId, tradeQuantity, selectedQuote());
    };
    let snapshot = project();
    const refresh = (): void => {
        if (destroyed || refreshSuppressed) return;
        const state = provider.snapshot();
        const eligible = state.planetLifecycle.landedPlanetId === 'seroton';
        if (eligible && !wasEligible) {
            selectedCommodityId = 'supplies';
            tradeQuantity = 0;
            rebuildPriceLadder();
        }
        if (!eligible) tradeQuantity = 0;
        wasEligible = eligible;
        snapshot = project();
        for (const listener of listeners) listener(snapshot);
    };
    if (provider.snapshot().planetLifecycle.landedPlanetId === 'seroton') {
        wasEligible = true;
        rebuildPriceLadder();
    }
    const unsubscribe = provider.subscribe(refresh);
    return {
        getSnapshot: () => snapshot,
        subscribe: listener => {
            if (destroyed) return () => {};
            listeners.add(listener);
            listener(snapshot);
            return () => { listeners.delete(listener); };
        },
        selectCommodity: commodityId => {
            if (destroyed || !serotonCommodityDefinitions.some(definition => definition.id === commodityId)) return;
            selectedCommodityId = commodityId;
            tradeQuantity = 0;
            refresh();
        },
        setTradeQuantity: quantity => {
            if (destroyed || !Number.isSafeInteger(quantity) || !wasEligible) return;
            const bounds = tradeBounds(selectedCommodityId);
            tradeQuantity = Math.max(bounds.minimum, Math.min(bounds.maximum, quantity));
            refresh();
        },
        confirmTrade: () => {
            if (destroyed || !wasEligible) return;
            const quote = selectedQuote();
            if (quote.failure !== null) return;
            refreshSuppressed = true;
            provider.update(state => applySerotonTrade(state, selectedCommodityId, tradeQuantity));
            refreshSuppressed = false;
            rebuildPriceLadder();
            tradeQuantity = 0;
            refresh();
        },
        launch: () => {
            if (destroyed) return;
            provider.update(launchFromPlanet);
            game.events.emit('landing-modal-transition');
        },
        destroy: () => {
            if (destroyed) return;
            destroyed = true;
            unsubscribe();
            listeners.clear();
        }
    };
}
