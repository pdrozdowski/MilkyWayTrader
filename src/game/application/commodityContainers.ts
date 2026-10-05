import type { CommodityContainerState } from '../state/commodityContainerState.ts';

export function containerAverageCost (container: CommodityContainerState): number
{
    return container.quantity === 0 ? 0 : container.totalCost / container.quantity;
}

export function addPaidCommodity (container: CommodityContainerState | undefined, commodityId: string, quantity: number, totalCost: number): CommodityContainerState
{
    if (!Number.isSafeInteger(quantity) || quantity <= 0 || !Number.isFinite(totalCost) || totalCost < 0) throw new Error('A paid addition requires a positive quantity and non-negative finite cost.');
    if (container !== undefined && container.commodityId !== commodityId) throw new Error('A container cannot hold multiple commodities.');
    return { commodityId, quantity: (container?.quantity ?? 0) + quantity, totalCost: (container?.totalCost ?? 0) + totalCost };
}

export function addFreeCommodity (container: CommodityContainerState | undefined, commodityId: string, quantity: number): CommodityContainerState
{
    return addPaidCommodity(container, commodityId, quantity, 0);
}

export function removeCommodityQuantity (container: CommodityContainerState, quantity: number): { readonly remaining: CommodityContainerState | null; readonly removed: CommodityContainerState }
{
    if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > container.quantity) throw new Error('Removal quantity exceeds the container.');
    const totalCost = quantity === container.quantity ? container.totalCost : containerAverageCost(container) * quantity;
    const remainingQuantity = container.quantity - quantity;
    return {
        remaining: remainingQuantity === 0 ? null : { ...container, quantity: remainingQuantity, totalCost: container.totalCost - totalCost },
        removed: { commodityId: container.commodityId, quantity, totalCost }
    };
}

export function transferCommodityQuantity (source: CommodityContainerState, destination: CommodityContainerState | undefined, quantity: number): { readonly source: CommodityContainerState | null; readonly destination: CommodityContainerState }
{
    if (destination !== undefined && destination.commodityId !== source.commodityId) throw new Error('A transfer requires matching commodities.');
    const { remaining, removed } = removeCommodityQuantity(source, quantity);
    return { source: remaining, destination: addPaidCommodity(destination, removed.commodityId, removed.quantity, removed.totalCost) };
}
