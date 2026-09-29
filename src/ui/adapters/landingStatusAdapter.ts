import type { Game } from 'phaser';
import type { GameStateProvider } from '../../game/application/gameStateProvider.ts';
import { projectLandedMarket } from '../../game/application/landedMarket.ts';
import { serotonCommodityDefinitions } from '../../game/definitions/serotonMarketDefinitions.ts';
import { cargoCapacityByLevel } from '../../game/domain/runBalance.ts';
import { applySerotonTrade, quoteSerotonTrade, type SerotonTradeQuote } from '../../game/application/serotonMarket.ts';
import { launchFromPlanet } from '../../game/mechanics/planet/landing.ts';
import type { LandingStatusPort, LandingStatusSnapshot } from '../contracts.ts';
import type { SerotonCommodityId } from '../../game/state/serotonMarketState.ts';
import type { TelemetryPort } from '../../game/application/telemetry/telemetry.ts';

export function createLandingStatusPort (game: Game): LandingStatusPort
{
    const provider = game.registry.get('gameStateProvider') as GameStateProvider;
    const registeredTelemetry = game.registry.get('telemetry') as Partial<TelemetryPort> | undefined;
    const telemetry: Pick<TelemetryPort, 'emit'> = typeof registeredTelemetry?.emit === 'function'
        ? registeredTelemetry as Pick<TelemetryPort, 'emit'>
        : { emit: () => {} };
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
        const eligible = state.planetLifecycle.landedPlanetId !== null;
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
    if (provider.snapshot().planetLifecycle.landedPlanetId !== null) {
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
            const updated = provider.snapshot();
            telemetry.emit(tradeQuantity > 0 ? 'commodity_bought' : 'commodity_sold', {
                planet: updated.planetLifecycle.landedPlanetId,
                commodity: selectedCommodityId,
                quantity: Math.abs(tradeQuantity),
                total: quote.total,
                credits_after: updated.credits
            });
            refreshSuppressed = false;
            rebuildPriceLadder();
            tradeQuantity = 0;
            refresh();
        },
        launch: () => {
            if (destroyed) return;
            const before = provider.snapshot();
            provider.update(launchFromPlanet);
            const updated = provider.snapshot();
            if (before.planetLifecycle.landedPlanetId !== null && updated.planetLifecycle.landedPlanetId === null) telemetry.emit('planet_launched', { planet: before.planetLifecycle.landedPlanetId, credits_after: updated.credits });
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
