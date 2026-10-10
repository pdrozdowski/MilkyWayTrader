import type { Game } from 'phaser';
import type { GameStateProvider } from '../../game/application/gameStateProvider.ts';
import { projectLandedMarket } from '../../game/application/landedMarket.ts';
import { landedCommodityFlow, projectLandedFacilities, type LandedFacilitiesSnapshot, type LandedFacilityProjectionCatalogue } from '../../game/application/landedFacilities.ts';
import { applyFacilityBuild, applyFacilityDowngrade, applyFacilityUpgrade } from '../../game/application/planetFacilities.ts';
import { projectLandedShipyard, type LandedShipyardSnapshot } from '../../game/application/landedShipyard.ts';
import { applyShipBooster, applyShipRepair, applyShipUpgrade } from '../../game/application/planetShipServices.ts';
import { serotonCommodityDefinitions } from '../../game/definitions/serotonMarketDefinitions.ts';
import { planetFacilityCatalogue, planetFacilityDefinitions, planetFacilityModifierOf, planetFacilityOutputCommodityIds } from '../../game/definitions/planetFacilityDefinitions.ts';
import { cargoCapacityByLevel } from '../../game/domain/runBalance.ts';
import { applyLandedTrade, landedMarketOf, quoteLandedTrade, type LandedTradeQuote } from '../../game/application/serotonMarket.ts';
import { launchFromPlanet } from '../../game/mechanics/planet/landing.ts';
import type { LandingStatusPort, LandingStatusSnapshot } from '../contracts.ts';
import type { GameStateSnapshot } from '../../game/state/gameStateSnapshot.ts';
import type { SerotonCommodityId, SerotonMarketState } from '../../game/state/serotonMarketState.ts';
import type { TelemetryPort } from '../../game/application/telemetry/telemetry.ts';

export function createLandingStatusPort (game: Game): LandingStatusPort
{
    const provider = game.registry.get('gameStateProvider') as GameStateProvider;
    const registeredTelemetry = game.registry.get('telemetry') as Partial<TelemetryPort> | undefined;
    const telemetry: Pick<TelemetryPort, 'emit'> = typeof registeredTelemetry?.emit === 'function'
        ? registeredTelemetry as Pick<TelemetryPort, 'emit'>
        : { emit: () => {} };
    const listeners = new Set<(snapshot: Readonly<LandingStatusSnapshot>) => void>();
    const facilityListeners = new Set<(snapshot: Readonly<LandedFacilitiesSnapshot>) => void>();
    const shipyardListeners = new Set<(snapshot: Readonly<LandedShipyardSnapshot>) => void>();
    const facilityCatalogue: LandedFacilityProjectionCatalogue = {
        definitions: planetFacilityDefinitions.map(definition => ({ ...definition, outputCommodityId: planetFacilityOutputCommodityIds[definition.id] })),
        modifierOf: planetFacilityModifierOf
    };
    let destroyed = false;
    let selectedCommodityId: SerotonCommodityId = 'milk';
    let tradeQuantity = 0;
    let wasEligible = false;
    let refreshSuppressed = false;
    let priceLadder = new Map<SerotonCommodityId, ReadonlyMap<number, LandedTradeQuote>>();
    const landedMarketOrThrow = (state: GameStateSnapshot): SerotonMarketState => {
        const market = landedMarketOf(state);
        if (market === null) throw new Error('Missing landed market.');
        return market;
    };
    const tradeBounds = (state: GameStateSnapshot, market: SerotonMarketState, commodityId: SerotonCommodityId): Readonly<{ minimum: number; maximum: number }> => {
        const stock = market.commodityStocks.find(candidate => candidate.commodityId === commodityId)?.stock;
        if (stock === undefined) throw new Error(`Missing landed stock for ${commodityId}.`);
        const carried = state.cargo.find(stack => stack.commodityId === commodityId)?.quantity ?? 0;
        const used = state.cargo.reduce((total, stack) => total + stack.quantity, 0);
        return { minimum: -carried, maximum: Math.min(stock, (cargoCapacityByLevel[state.shipStatus.cargoLevel] ?? 0) - used) };
    };
    const rebuildPriceLadder = (): void => {
        const state = provider.snapshot();
        const market = landedMarketOrThrow(state);
        const next = new Map<SerotonCommodityId, ReadonlyMap<number, LandedTradeQuote>>();
        for (const definition of serotonCommodityDefinitions) {
            const ladder = new Map<number, LandedTradeQuote>();
            const bounds = tradeBounds(state, market, definition.id);
            for (let quantity = bounds.minimum; quantity <= bounds.maximum; quantity++) ladder.set(quantity, quoteLandedTrade(state, definition.id, quantity));
            next.set(definition.id, ladder);
        }
        priceLadder = next;
    };
    const selectedQuote = (): LandedTradeQuote => priceLadder.get(selectedCommodityId)?.get(tradeQuantity)
        ?? quoteLandedTrade(provider.snapshot(), selectedCommodityId, tradeQuantity);
    const project = (facilities: LandedFacilitiesSnapshot): LandingStatusSnapshot => {
        const state = provider.snapshot();
        const commodityFlows = Object.fromEntries(serotonCommodityDefinitions.map(definition => [definition.id, landedCommodityFlow(facilities, definition.id)]));
        return projectLandedMarket(state, serotonCommodityDefinitions, selectedCommodityId, tradeQuantity, selectedQuote(), landedCommodityFlow(facilities, selectedCommodityId), facilities.clock, commodityFlows);
    };
    const projectFacilities = (): LandedFacilitiesSnapshot => projectLandedFacilities(provider.snapshot(), facilityCatalogue);
    const projectShipyard = (): LandedShipyardSnapshot => projectLandedShipyard(provider.snapshot());
    let facilitiesSnapshot = projectFacilities();
    let shipyardSnapshot = projectShipyard();
    let snapshot = project(facilitiesSnapshot);
    const refresh = (): void => {
        if (destroyed || refreshSuppressed) return;
        const state = provider.snapshot();
        const eligible = state.planetLifecycle.landedPlanetId !== null;
        // While the ship is flying and already was flying, nothing the landing views show can have
        // changed, so the three projections below would be built and thrown away every frame. The
        // transition out of a landing still projects once, which is what hides the panel again.
        if (!eligible && !wasEligible) return;
        if (eligible && !wasEligible) {
            selectedCommodityId = 'milk';
            tradeQuantity = 0;
            rebuildPriceLadder();
        }
        if (!eligible) tradeQuantity = 0;
        wasEligible = eligible;
        facilitiesSnapshot = projectFacilities();
        shipyardSnapshot = projectShipyard();
        snapshot = project(facilitiesSnapshot);
        for (const listener of listeners) listener(snapshot);
        for (const listener of facilityListeners) listener(facilitiesSnapshot);
        for (const listener of shipyardListeners) listener(shipyardSnapshot);
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
        getFacilitiesSnapshot: () => facilitiesSnapshot,
        subscribeFacilities: listener => {
            if (destroyed) return () => {};
            facilityListeners.add(listener);
            listener(facilitiesSnapshot);
            return () => { facilityListeners.delete(listener); };
        },
        getShipyardSnapshot: () => shipyardSnapshot,
        subscribeShipyard: listener => {
            if (destroyed) return () => {};
            shipyardListeners.add(listener);
            listener(shipyardSnapshot);
            return () => { shipyardListeners.delete(listener); };
        },
        selectCommodity: commodityId => {
            if (destroyed || !serotonCommodityDefinitions.some(definition => definition.id === commodityId)) return;
            selectedCommodityId = commodityId;
            tradeQuantity = 0;
            refresh();
        },
        setTradeQuantity: quantity => {
            if (destroyed || !Number.isSafeInteger(quantity) || !wasEligible) return;
            const state = provider.snapshot();
            const bounds = tradeBounds(state, landedMarketOrThrow(state), selectedCommodityId);
            tradeQuantity = Math.max(bounds.minimum, Math.min(bounds.maximum, quantity));
            refresh();
        },
        confirmTrade: () => {
            if (destroyed || !wasEligible) return;
            const quote = selectedQuote();
            if (quote.failure !== null) return;
            refreshSuppressed = true;
            provider.update(state => applyLandedTrade(state, selectedCommodityId, tradeQuantity));
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
        buildFacility: facilityId => {
            if (destroyed || !wasEligible) return;
            provider.update(state => applyFacilityBuild(state, planetFacilityCatalogue, facilityId));
        },
        upgradeFacility: facilityId => {
            if (destroyed || !wasEligible) return;
            provider.update(state => applyFacilityUpgrade(state, planetFacilityCatalogue, facilityId));
        },
        downgradeFacility: facilityId => {
            if (destroyed || !wasEligible) return;
            provider.update(state => applyFacilityDowngrade(state, planetFacilityCatalogue, facilityId));
        },
        repairShip: () => {
            if (destroyed || !wasEligible) return;
            provider.update(applyShipRepair);
        },
        upgradeShipService: serviceId => {
            if (destroyed || !wasEligible) return;
            provider.update(state => applyShipUpgrade(state, serviceId));
        },
        purchaseBooster: () => {
            if (destroyed || !wasEligible) return;
            provider.update(applyShipBooster);
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
            facilityListeners.clear();
            shipyardListeners.clear();
        }
    };
}
