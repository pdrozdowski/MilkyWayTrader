import { planetMarketTunings } from '../definitions/serotonMarketDefinitions.ts';
import type { SerotonMarketState } from '../state/serotonMarketState.ts';

export function advanceMarket (market: SerotonMarketState, elapsedSeconds: number): SerotonMarketState
{
    if (!Number.isSafeInteger(elapsedSeconds) || elapsedSeconds < 0) throw new Error('Market elapsed seconds must be a non-negative safe integer.');
    if (elapsedSeconds === 0) return market;
    const tuning = planetMarketTunings[market.planetId];
    if (!tuning) throw new Error(`Unknown market planet id: ${market.planetId}.`);
    return {
        ...market,
        commodityStocks: market.commodityStocks.map(commodity => {
            const definition = tuning[commodity.commodityId];
            return {
                ...commodity,
                stock: Math.max(0, commodity.stock + (definition.productionPerSecond - definition.consumptionPerSecond) * elapsedSeconds)
            };
        })
    };
}
