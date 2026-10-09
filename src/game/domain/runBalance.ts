export const initialCredits = 100_000;
export const maximumShipHitPoints = 100;
export const orbitalCargoCapacity = 20;

/** Ship cargo capacity per cargo-capacity level; level one is BR-001's 40-unit starting capacity. */
export const cargoCapacityByLevel: Readonly<Record<number, number>> = {
    1: 40,
    2: 50,
    3: 65,
    4: 85,
    5: 110
};

/** Normal controlled-flight speed expressed as a percentage of the level-one base speed (BR-074). */
export const engineNormalSpeedPercentByLevel: Readonly<Record<number, number>> = {
    1: 100,
    2: 110,
    3: 120,
    4: 135,
    5: 150
};

/** Simultaneous projectiles in one firing-cadence volley (BR-044, BR-075). */
export const weaponProjectileCountByLevel: Readonly<Record<number, number>> = {
    1: 1,
    2: 2,
    3: 3,
    4: 4,
    5: 5,
    6: 6,
    7: 7,
    8: 8,
    9: 9,
    10: 10
};

/** Price paid to reach each level above one; the first entry buys level two (BR-077). */
export const cargoUpgradePrices: readonly number[] = [15_000, 30_000, 60_000, 120_000];
export const engineUpgradePrices: readonly number[] = [20_000, 40_000, 80_000, 160_000];
export const weaponUpgradePrices: readonly number[] = [20_000, 30_000, 40_000, 50_000, 60_000, 70_000, 80_000, 90_000, 100_000];

/** Fixed price and effect of one repair purchase (BR-071, BR-072). */
export const shipRepairCost = 1_000;
export const shipRepairHitPointPercent = 10;

/** The booster is a separate one-time purchase at the Lactozis-7C shipyard (BR-036). */
export const shipBoosterCost = 75_000;
