import type { PlanetId } from '../state/planetState';
import type { PlanetFacilityId, SerotonCommodityId } from '../state/serotonMarketState';

export interface PlanetFacilityInput
{
    readonly commodityId: SerotonCommodityId;
    readonly quantity: number;
}

export interface PlanetFacilityModifier
{
    readonly upgradePriceMultiplier: number;
    readonly outputMultiplier: number;
}

export interface PlanetFacilityDefinition
{
    readonly id: PlanetFacilityId;
    readonly label: string;
    readonly initialLevel: number;
    readonly maxLevel: number;
    readonly outputByLevel: readonly number[];
    readonly inputsPerOutput: readonly PlanetFacilityInput[];
    readonly upgradePrices: readonly [number, number];
}

/** A facility attempts its recipe once per active second in this fixed order. */
export const planetFacilityDefinitions: readonly PlanetFacilityDefinition[] = [
    { id: 'dairyFarm', label: 'Dairy Farm', initialLevel: 1, maxLevel: 3, outputByLevel: [10, 20, 40], inputsPerOutput: [], upgradePrices: [25_000, 75_000] },
    { id: 'grainFarm', label: 'Grain Farm', initialLevel: 1, maxLevel: 3, outputByLevel: [10, 20, 40], inputsPerOutput: [], upgradePrices: [25_000, 75_000] },
    { id: 'cheeseFactory', label: 'Cheese Factory', initialLevel: 1, maxLevel: 3, outputByLevel: [5, 10, 20], inputsPerOutput: [{ commodityId: 'milk', quantity: 2 }], upgradePrices: [35_000, 100_000] },
    { id: 'bakery', label: 'Bakery', initialLevel: 0, maxLevel: 3, outputByLevel: [5, 10, 20], inputsPerOutput: [{ commodityId: 'grain', quantity: 2 }], upgradePrices: [35_000, 100_000] },
    {
        id: 'foodProcessor', label: 'Food Processor', initialLevel: 0, maxLevel: 3, outputByLevel: [5, 10, 20],
        inputsPerOutput: [{ commodityId: 'cheese', quantity: 2 }, { commodityId: 'bun', quantity: 1 }, { commodityId: 'milk', quantity: 1 }],
        upgradePrices: [50_000, 150_000]
    }
];

export const planetFacilityDefinitionById: Readonly<Record<PlanetFacilityId, PlanetFacilityDefinition>> = Object.freeze(
    Object.fromEntries(planetFacilityDefinitions.map(definition => [definition.id, definition])) as Record<PlanetFacilityId, PlanetFacilityDefinition>
);

/** The commodity a facility produces; a farm ignores its input recipe. */
export const planetFacilityOutputCommodityIds: Readonly<Record<PlanetFacilityId, SerotonCommodityId>> = Object.freeze({
    dairyFarm: 'milk',
    grainFarm: 'grain',
    cheeseFactory: 'cheese',
    bakery: 'bun',
    foodProcessor: 'spaceRation'
});

export const neutralPlanetFacilityModifier: PlanetFacilityModifier = Object.freeze({ upgradePriceMultiplier: 1, outputMultiplier: 1 });

/** Specializations: a 20% upgrade discount and +20% output for one facility on one planet. */
export const planetFacilityModifiers: Readonly<Record<PlanetFacilityId, Readonly<Partial<Record<PlanetId, PlanetFacilityModifier>>>>> = Object.freeze({
    dairyFarm: Object.freeze({ 'maslo-prime': Object.freeze({ upgradePriceMultiplier: 0.8, outputMultiplier: 1.2 }) }),
    grainFarm: Object.freeze({ 'lactozis-7c': Object.freeze({ upgradePriceMultiplier: 0.8, outputMultiplier: 1.2 }) }),
    cheeseFactory: Object.freeze({ seroton: Object.freeze({ upgradePriceMultiplier: 0.8, outputMultiplier: 1.2 }) }),
    bakery: Object.freeze({}),
    foodProcessor: Object.freeze({})
});

export function planetFacilityModifierOf (facilityId: PlanetFacilityId, planetId: PlanetId): PlanetFacilityModifier
{
    return planetFacilityModifiers[facilityId][planetId] ?? neutralPlanetFacilityModifier;
}

export interface PlanetFacilityCatalogue
{
    readonly definitions: readonly PlanetFacilityDefinition[];
    readonly modifierOf: (facilityId: PlanetFacilityId, planetId: PlanetId) => PlanetFacilityModifier;
}

/** The single wiring point that binds the facility catalogue to its planet modifiers. */
export const planetFacilityCatalogue: PlanetFacilityCatalogue = Object.freeze({
    definitions: planetFacilityDefinitions,
    modifierOf: planetFacilityModifierOf
});
