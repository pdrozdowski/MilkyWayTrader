import type { PlanetFacilityId, PlanetFacilityStatus, SerotonMarketState } from '../state/serotonMarketState';
import {
    planetFacilityDefinitions,
    planetFacilityModifierOf,
    planetFacilityOutputCommodityIds,
    type PlanetFacilityDefinition
} from '../definitions/planetFacilityDefinitions.ts';

function applyFacilityOnce (
    economy: SerotonMarketState,
    definition: PlanetFacilityDefinition,
    level: number,
    stockById: Map<string, number>
): PlanetFacilityStatus
{
    if (level <= 0) return 'notBuilt';
    const outputMultiplier = planetFacilityModifierOf(definition.id, economy.planetId).outputMultiplier;
    const output = Math.round((definition.outputByLevel[Math.min(level, definition.maxLevel) - 1] ?? 0) * outputMultiplier);
    const requiredByCommodity = new Map<string, number>();
    for (const input of definition.inputsPerOutput) {
        requiredByCommodity.set(input.commodityId, (requiredByCommodity.get(input.commodityId) ?? 0) + input.quantity * output);
    }
    if (![...requiredByCommodity].every(([commodityId, quantity]) => (stockById.get(commodityId) ?? 0) >= quantity)) return 'insufficientResources';
    for (const [commodityId, quantity] of requiredByCommodity) stockById.set(commodityId, (stockById.get(commodityId) ?? 0) - quantity);
    const outputCommodityId = planetFacilityOutputCommodityIds[definition.id];
    if (!stockById.has(outputCommodityId)) throw new Error(`Missing output commodity ${outputCommodityId} on planet ${economy.planetId}.`);
    stockById.set(outputCommodityId, (stockById.get(outputCommodityId) ?? 0) + output);
    return 'working';
}

function advanceFacilityCycle (economy: SerotonMarketState): SerotonMarketState
{
    const stockById = new Map(economy.commodityStocks.map(entry => [entry.commodityId, entry.stock]));
    const statusByFacilityId = new Map<PlanetFacilityId, PlanetFacilityStatus>();
    for (const definition of planetFacilityDefinitions) {
        const facility = economy.facilities.find(candidate => candidate.facilityId === definition.id);
        if (!facility) throw new Error(`Missing facility ${definition.id} on planet ${economy.planetId}.`);
        statusByFacilityId.set(definition.id, applyFacilityOnce(economy, definition, facility.level, stockById));
    }
    return {
        ...economy,
        commodityStocks: economy.commodityStocks.map(entry => ({ commodityId: entry.commodityId, stock: stockById.get(entry.commodityId) ?? entry.stock })),
        facilities: economy.facilities.map(facility => ({ ...facility, status: statusByFacilityId.get(facility.facilityId) ?? facility.status }))
    };
}

/** Runs one sequential, all-or-nothing recipe pass per crossed active second over the five fixed facilities. */
export function advancePlanetFacilities (economy: SerotonMarketState, cycles: number): SerotonMarketState
{
    let next = economy;
    for (let cycle = 0; cycle < cycles; cycle++) next = advanceFacilityCycle(next);
    return next;
}
