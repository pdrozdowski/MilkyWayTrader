import type { SerotonCommodityId } from '../state/serotonMarketState';

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
    { id: 'supplies', basePrice: 1_000, initialStock: 100, productionPerSecond: 4, consumptionPerSecond: 2, lowerStockThreshold: 50, upperStockThreshold: 150 },
    { id: 'alloys', basePrice: 5_000, initialStock: 60, productionPerSecond: 1, consumptionPerSecond: 2, lowerStockThreshold: 30, upperStockThreshold: 100 },
    { id: 'medicines', basePrice: 15_000, initialStock: 20, productionPerSecond: 0, consumptionPerSecond: 1, lowerStockThreshold: 10, upperStockThreshold: 40 }
];

export const serotonCommodityDefinitionById: Readonly<Record<SerotonCommodityId, SerotonCommodityDefinition>> = Object.freeze(
    Object.fromEntries(serotonCommodityDefinitions.map(definition => [definition.id, definition])) as Record<SerotonCommodityId, SerotonCommodityDefinition>
);
