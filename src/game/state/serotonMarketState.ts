import type { PlanetId } from './planetState';

export type SerotonCommodityId = 'milk' | 'grain' | 'cheese' | 'bun' | 'spaceRation';

export interface SerotonCommodityStockState
{
    readonly commodityId: SerotonCommodityId;
    readonly stock: number;
}

export type PlanetFacilityId = 'dairyFarm' | 'grainFarm' | 'cheeseFactory' | 'bakery' | 'foodProcessor';

export type PlanetFacilityStatus = 'notBuilt' | 'working' | 'insufficientResources';

export interface PlanetFacilityState
{
    readonly facilityId: PlanetFacilityId;
    readonly level: number;
    readonly status: PlanetFacilityStatus;
}

export interface SerotonMarketState
{
    readonly planetId: PlanetId;
    readonly commodityStocks: readonly SerotonCommodityStockState[];
    readonly facilities: readonly PlanetFacilityState[];
}
