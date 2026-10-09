/**
 * Runtime list of the configured facility ids. It mirrors the canonical `PlanetFacilityId` union in
 * `src/game/state/serotonMarketState.ts` and the configured `planetFacilityDefinitions`; tests and the
 * codec's exact-set rule keep the type, this list, and the facility definitions bound together.
 */
export const planetFacilityIds = ['dairyFarm', 'grainFarm', 'cheeseFactory', 'bakery', 'foodProcessor'] as const;

export const planetFacilityMaximumLevel = 3;
