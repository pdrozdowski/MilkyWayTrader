import type { AsteroidState } from '../../state/asteroidState.ts';
import type { LooseItemState } from '../../state/looseItemState.ts';
import type { OrbitalCargoState } from '../../state/orbitalCargoState.ts';
import type { SerotonCommodityId } from '../../state/serotonMarketState.ts';
import { asteroidTuning } from '../../definitions/gameplayTuning.ts';
import { moolarisDefinition } from '../../definitions/moolarisDefinition.ts';
import { serotonCommodityDefinitions } from '../../definitions/serotonMarketDefinitions.ts';
import { nextRandomInteger } from '../hazards/damage.ts';
import { createRandomCargoManifest } from './cargoManifest.ts';
import { cargoOrbitPeriodMs } from './salvageSimulation.ts';

export interface AsteroidLootResult
{
    readonly orbitalCargo: OrbitalCargoState | null;
    readonly looseItem: LooseItemState | null;
    readonly nextRandomState: number;
}

export interface CargoScheduleResult
{
    readonly schedule: readonly (0 | 1)[];
    readonly nextRandomState: number;
}

/** Creates one seeded five-kill cycle with exactly one cargo marker. */
export function createCargoSchedule (randomState: number): CargoScheduleResult
{
    const schedule: (0 | 1)[] = [0, 0, 0, 0, 0];
    const markerIndex = nextRandomInteger(randomState, 0, schedule.length - 1);
    schedule[markerIndex.value] = 1;
    return { schedule, nextRandomState: markerIndex.nextState };
}

/** Resolves the final small-asteroid projectile loot outcome for one consumed schedule marker. */
export function spawnAsteroidLoot (asteroid: AsteroidState, activeElapsedMs: number, randomState: number, cargoGuaranteed: boolean): AsteroidLootResult
{
    if (!cargoGuaranteed) {
        const outcome = nextRandomInteger(randomState, 0, 99);
        if (outcome.value >= asteroidTuning.salvage.looseItemChancePercent) return { orbitalCargo: null, looseItem: null, nextRandomState: outcome.nextState };
        return spawnLooseItem(asteroid, activeElapsedMs, outcome.nextState);
    }
    const cargoManifest = createRandomCargoManifest(randomState);
    const offset = {
        x: asteroid.position.x - moolarisDefinition.position.x,
        y: asteroid.position.y - moolarisDefinition.position.y
    };
    const radius = Math.hypot(offset.x, offset.y);
    const orbitPeriodMs = cargoOrbitPeriodMs(radius);
    return {
        orbitalCargo: {
            id: `${asteroid.id}-cargo`,
            position: { ...asteroid.position },
            orbit: {
                angleRadians: Math.atan2(-offset.y, offset.x) - (activeElapsedMs % orbitPeriodMs) / orbitPeriodMs * Math.PI * 2,
                radius,
                rotationRadians: Math.atan2(asteroid.velocity.y, asteroid.velocity.x)
            },
            hitPoints: asteroidTuning.salvage.cargoHitPoints,
            manifest: cargoManifest.manifest
        },
        looseItem: null,
        nextRandomState: cargoManifest.nextRandomState
    };
}

function spawnLooseItem (asteroid: AsteroidState, activeElapsedMs: number, randomState: number): AsteroidLootResult
{
    const commodity = nextRandomInteger(randomState, 0, serotonCommodityDefinitions.length - 1);
    const commodityId = serotonCommodityDefinitions[commodity.value].id as SerotonCommodityId;
    const directionLength = Math.hypot(asteroid.velocity.x, asteroid.velocity.y) || 1;
    const towardSunLength = Math.hypot(asteroid.position.x, asteroid.position.y) || 1;
    return {
        orbitalCargo: null,
        looseItem: {
            id: `${asteroid.id}-item`,
            position: { ...asteroid.position },
            motion: {
                ejectionVelocity: { x: asteroid.velocity.x / directionLength * asteroidTuning.salvage.looseItemEjectionSpeed, y: asteroid.velocity.y / directionLength * asteroidTuning.salvage.looseItemEjectionSpeed },
                sunVelocity: { x: -asteroid.position.x / towardSunLength * asteroidTuning.salvage.looseItemSunSpeed, y: -asteroid.position.y / towardSunLength * asteroidTuning.salvage.looseItemSunSpeed },
                createdAtActiveMs: activeElapsedMs
            },
            container: { commodityId, quantity: 1, totalCost: 0 }
        },
        nextRandomState: commodity.nextState
    };
}
