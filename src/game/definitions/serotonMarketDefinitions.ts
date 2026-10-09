import type { PlanetId } from '../state/planetState';
import type { SerotonCommodityId } from '../state/serotonMarketState';
import { serotonCommodityIds, serotonCommodityPriceProfiles } from '../domain/serotonMarketCatalog.ts';

export interface SerotonCommodityDefinition
{
    readonly id: SerotonCommodityId;
    readonly basePrice: number;
    readonly lowerStockThreshold: number;
    readonly upperStockThreshold: number;
}

export const serotonCommodityDefinitions: readonly SerotonCommodityDefinition[] = serotonCommodityIds.map(id => ({
    id,
    ...serotonCommodityPriceProfiles[id]
}));

export const serotonCommodityDefinitionById: Readonly<Record<SerotonCommodityId, SerotonCommodityDefinition>> = Object.freeze(
    Object.fromEntries(serotonCommodityDefinitions.map(definition => [definition.id, definition])) as Record<SerotonCommodityId, SerotonCommodityDefinition>
);

export interface PlanetMarketCommodityTuning
{
    readonly initialStock: number;
}

export type PlanetMarketTuning = Readonly<Record<SerotonCommodityId, PlanetMarketCommodityTuning>>;

/** One independent, statically tuned market profile per configured landable planet. */
export const planetMarketTunings: Readonly<Record<PlanetId, PlanetMarketTuning>> = Object.freeze({
    seroton: {
        milk: { initialStock: 4 },
        grain: { initialStock: 100 },
        cheese: { initialStock: 60 },
        bun: { initialStock: 50 },
        spaceRation: { initialStock: 20 }
    },
    'lactozis-7c': {
        milk: { initialStock: 100 },
        grain: { initialStock: 120 },
        cheese: { initialStock: 50 },
        bun: { initialStock: 2 },
        spaceRation: { initialStock: 20 }
    },
    'maslo-prime': {
        milk: { initialStock: 120 },
        grain: { initialStock: 100 },
        cheese: { initialStock: 2 },
        bun: { initialStock: 50 },
        spaceRation: { initialStock: 20 }
    }
});
