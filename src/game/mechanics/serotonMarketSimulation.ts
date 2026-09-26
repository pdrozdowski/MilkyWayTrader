import { serotonCommodityDefinitionById } from '../definitions/serotonMarketDefinitions.ts';
import type { SerotonMarketState } from '../state/serotonMarketState.ts';

export function advanceSerotonMarket (market: SerotonMarketState, elapsedSeconds: number): SerotonMarketState
{
    if (!Number.isSafeInteger(elapsedSeconds) || elapsedSeconds < 0) throw new Error('Market elapsed seconds must be a non-negative safe integer.');
    if (elapsedSeconds === 0) return market;
    return {
        ...market,
        commodityStocks: market.commodityStocks.map(commodity => {
            const definition = serotonCommodityDefinitionById[commodity.commodityId];
            return {
                ...commodity,
                stock: Math.max(0, commodity.stock + (definition.productionPerSecond - definition.consumptionPerSecond) * elapsedSeconds)
            };
        })
    };
}
