import type { PlanetId } from './planetState';

export type SerotonCommodityId = 'supplies' | 'alloys' | 'medicines';

export interface SerotonCommodityStockState
{
    readonly commodityId: SerotonCommodityId;
    readonly stock: number;
}

export interface SerotonMarketState
{
    readonly planetId: PlanetId;
    readonly commodityStocks: readonly SerotonCommodityStockState[];
}
