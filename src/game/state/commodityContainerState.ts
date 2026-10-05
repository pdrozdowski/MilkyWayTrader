/** A commodity holder with an independent weighted cost basis. */
export interface CommodityContainerState
{
    readonly commodityId: string;
    readonly quantity: number;
    readonly totalCost: number;
}
