import type { SerotonCommodityId } from '../state/serotonMarketState';
import { serotonCommodityPriceProfiles } from '../domain/serotonMarketCatalog.ts';

export interface SerotonCommodityDefinition
{
    readonly id: SerotonCommodityId;
    readonly basePrice: number;
    readonly initialStock: number;
    readonly productionPerSecond: number;
    readonly consumptionPerSecond: number;
    readonly lowerStockThreshold: number;
    readonly upperStockThreshold: number;
}

export const serotonCommodityDefinitions: readonly SerotonCommodityDefinition[] = [
    { id: 'supplies', ...serotonCommodityPriceProfiles.supplies, initialStock: 100, productionPerSecond: 4, consumptionPerSecond: 2 },
    { id: 'alloys', ...serotonCommodityPriceProfiles.alloys, initialStock: 60, productionPerSecond: 1, consumptionPerSecond: 2 },
    { id: 'medicines', ...serotonCommodityPriceProfiles.medicines, initialStock: 20, productionPerSecond: 0, consumptionPerSecond: 1 }
];

export const serotonCommodityDefinitionById: Readonly<Record<SerotonCommodityId, SerotonCommodityDefinition>> = Object.freeze(
    Object.fromEntries(serotonCommodityDefinitions.map(definition => [definition.id, definition])) as Record<SerotonCommodityId, SerotonCommodityDefinition>
);
