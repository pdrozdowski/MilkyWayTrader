import type { CommodityPriceProfile } from './marketPricing.ts';

export const serotonCommodityIds = ['supplies', 'alloys', 'medicines'] as const;

export type SerotonMarketCommodityId = typeof serotonCommodityIds[number];

export const serotonCommodityPriceProfiles: Readonly<Record<SerotonMarketCommodityId, CommodityPriceProfile>> = {
    supplies: { basePrice: 1_000, lowerStockThreshold: 50, upperStockThreshold: 150 },
    alloys: { basePrice: 5_000, lowerStockThreshold: 30, upperStockThreshold: 100 },
    medicines: { basePrice: 15_000, lowerStockThreshold: 10, upperStockThreshold: 40 }
};
