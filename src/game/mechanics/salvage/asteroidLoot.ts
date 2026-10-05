import type { AsteroidState } from '../../state/asteroidState.ts';
import type { LooseItemState } from '../../state/looseItemState.ts';
import type { OrbitalCargoState } from '../../state/orbitalCargoState.ts';
import type { SerotonCommodityId } from '../../state/serotonMarketState.ts';
import { serotonCommodityDefinitions } from '../../definitions/serotonMarketDefinitions.ts';
import { asteroidTuning } from '../../definitions/gameplayTuning.ts';
import { nextRandomInteger } from '../hazards/damage.ts';

export interface AsteroidLootResult
{
    readonly orbitalCargo: OrbitalCargoState | null;
    readonly looseItem: LooseItemState | null;
    readonly nextRandomState: number;
}

/** Rolls exactly one mutually-exclusive loot outcome for a final small-asteroid projectile hit. */
export function spawnAsteroidLoot (asteroid: AsteroidState, activeElapsedMs: number, randomState: number): AsteroidLootResult
{
    const outcome = nextRandomInteger(randomState, 0, 99);
    if (outcome.value >= asteroidTuning.salvage.cargoChancePercent + asteroidTuning.salvage.looseItemChancePercent) return { orbitalCargo: null, looseItem: null, nextRandomState: outcome.nextState };
    const commodity = nextRandomInteger(outcome.nextState, 0, serotonCommodityDefinitions.length - 1);
    const commodityId = serotonCommodityDefinitions[commodity.value].id as SerotonCommodityId;
    if (outcome.value < asteroidTuning.salvage.cargoChancePercent) {
        const quantity = nextRandomInteger(commodity.nextState, asteroidTuning.salvage.cargoMinimumQuantity, asteroidTuning.salvage.cargoMaximumQuantity);
        const radius = Math.hypot(asteroid.position.x, asteroid.position.y);
        return {
            orbitalCargo: {
                id: `${asteroid.id}-cargo`,
                position: { ...asteroid.position },
                orbit: { angleRadians: Math.atan2(-asteroid.position.y, asteroid.position.x), radius, rotationRadians: Math.atan2(asteroid.velocity.y, asteroid.velocity.x) },
                hitPoints: asteroidTuning.salvage.cargoHitPoints,
                container: { commodityId, quantity: quantity.value, totalCost: 0 }
            },
            looseItem: null,
            nextRandomState: quantity.nextState
        };
    }
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
