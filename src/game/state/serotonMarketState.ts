export type SerotonCommodityId = 'supplies' | 'alloys' | 'medicines';

export interface SerotonCommodityStockState
{
    readonly commodityId: SerotonCommodityId;
    readonly stock: number;
}

export interface SerotonMarketState
{
    readonly planetId: 'seroton';
    readonly commodityStocks: readonly SerotonCommodityStockState[];
}
