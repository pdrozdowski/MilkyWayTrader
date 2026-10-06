import type { CommodityContainerState } from '../../state/commodityContainerState.ts';
import type { SerotonCommodityId } from '../../state/serotonMarketState.ts';
import { asteroidTuning } from '../../definitions/gameplayTuning.ts';
import { serotonCommodityDefinitions } from '../../definitions/serotonMarketDefinitions.ts';
import { nextRandomInteger } from '../hazards/damage.ts';

export interface RandomCargoManifestResult
{
    readonly manifest: readonly CommodityContainerState[];
    readonly nextRandomState: number;
}

/** Creates a seeded cargo manifest with one, two, or three distinct commodities. */
export function createRandomCargoManifest (randomState: number): RandomCargoManifestResult
{
    const stackCountRoll = nextRandomInteger(randomState, 0, 3);
    const stackCount = stackCountRoll.value < 2 ? 1 : stackCountRoll.value;
    const availableCommodityIds = serotonCommodityDefinitions.map(definition => definition.id as SerotonCommodityId);
    const manifest: CommodityContainerState[] = [];
    let nextRandomState = stackCountRoll.nextState;
    for (let index = 0; index < stackCount; index++) {
        const commodity = nextRandomInteger(nextRandomState, 0, availableCommodityIds.length - 1);
        const [commodityId] = availableCommodityIds.splice(commodity.value, 1);
        const quantity = nextRandomInteger(commodity.nextState, asteroidTuning.salvage.cargoMinimumQuantity, asteroidTuning.salvage.cargoMaximumQuantity);
        manifest.push({ commodityId, quantity: quantity.value, totalCost: 0 });
        nextRandomState = quantity.nextState;
    }
    return { manifest, nextRandomState };
}
