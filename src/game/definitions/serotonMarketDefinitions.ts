import type { PlanetId } from '../state/planetState';
import type { SerotonCommodityId } from '../state/serotonMarketState';
import { serotonCommodityPriceProfiles } from '../domain/serotonMarketCatalog.ts';

export interface SerotonCommodityDefinition
{
    readonly id: SerotonCommodityId;
    readonly basePrice: number;
    readonly lowerStockThreshold: number;
    readonly upperStockThreshold: number;
}

export const serotonCommodityDefinitions: readonly SerotonCommodityDefinition[] = [
    { id: 'supplies', ...serotonCommodityPriceProfiles.supplies },
    { id: 'alloys', ...serotonCommodityPriceProfiles.alloys },
    { id: 'medicines', ...serotonCommodityPriceProfiles.medicines }
];

export const serotonCommodityDefinitionById: Readonly<Record<SerotonCommodityId, SerotonCommodityDefinition>> = Object.freeze(
    Object.fromEntries(serotonCommodityDefinitions.map(definition => [definition.id, definition])) as Record<SerotonCommodityId, SerotonCommodityDefinition>
);

export interface PlanetMarketCommodityTuning
{
    readonly initialStock: number;
    readonly productionPerSecond: number;
    readonly consumptionPerSecond: number;
}

export type PlanetMarketTuning = Readonly<Record<SerotonCommodityId, PlanetMarketCommodityTuning>>;

/** One independent, statically tuned market profile per configured landable planet. */
export const planetMarketTunings: Readonly<Record<PlanetId, PlanetMarketTuning>> = Object.freeze({
    seroton: {
        supplies: { initialStock: 100, productionPerSecond: 4, consumptionPerSecond: 2 },
        alloys: { initialStock: 60, productionPerSecond: 1, consumptionPerSecond: 2 },
        medicines: { initialStock: 20, productionPerSecond: 0, consumptionPerSecond: 1 }
    },
    'lactozis-7c': {
        supplies: { initialStock: 140, productionPerSecond: 6, consumptionPerSecond: 1 },
        alloys: { initialStock: 40, productionPerSecond: 0, consumptionPerSecond: 1 },
        medicines: { initialStock: 30, productionPerSecond: 2, consumptionPerSecond: 1 }
    },
    'maslo-prime': {
        supplies: { initialStock: 80, productionPerSecond: 2, consumptionPerSecond: 3 },
        alloys: { initialStock: 90, productionPerSecond: 2, consumptionPerSecond: 3 },
        medicines: { initialStock: 15, productionPerSecond: 1, consumptionPerSecond: 2 }
    }
});
