import type { CommodityPriceProfile } from './marketPricing.ts';

export const serotonCommodityIds = ['milk', 'grain', 'cheese', 'bun', 'spaceRation'] as const;

export type SerotonMarketCommodityId = typeof serotonCommodityIds[number];

export const serotonCommodityPriceProfiles: Readonly<Record<SerotonMarketCommodityId, CommodityPriceProfile>> = {
    milk: { basePrice: 100, lowerStockThreshold: 100, upperStockThreshold: 300 },
    grain: { basePrice: 150, lowerStockThreshold: 100, upperStockThreshold: 300 },
    cheese: { basePrice: 300, lowerStockThreshold: 100, upperStockThreshold: 300 },
    bun: { basePrice: 250, lowerStockThreshold: 100, upperStockThreshold: 300 },
    spaceRation: { basePrice: 1_250, lowerStockThreshold: 100, upperStockThreshold: 300 }
};
