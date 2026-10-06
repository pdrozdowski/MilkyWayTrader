import type { GameStateSnapshot } from '../../state/gameStateSnapshot.ts';
import type { LooseItemState } from '../../state/looseItemState.ts';
import type { OrbitalCargoState } from '../../state/orbitalCargoState.ts';
import { asteroidTuning } from '../../definitions/gameplayTuning.ts';
import { cargoCapacityByLevel } from '../../definitions/cargoDefinitions.ts';

const fullTurn = Math.PI * 2;

function spillSpreadRadius (totalQuantity: number): number
{
    return Math.max(24, Math.min(80, totalQuantity * 4));
}

function cargoSeed (cargoId: string): number
{
    let hash = 0;
    for (let index = 0; index < cargoId.length; index++) {
        hash = (Math.imul(31, hash) + cargoId.charCodeAt(index)) | 0;
    }
    return hash >>> 0;
}

/** Deterministic per-unit value in [0, 1) so replays and restored runs agree. */
function pseudoRandom (cargoId: string, unitIndex: number, salt: number): number
{
    const value = Math.sin((unitIndex + cargoSeed(cargoId)) * 91.345 + salt * 47.853) * 43758.5453;
    return value - Math.floor(value);
}

function sunVelocity (position: Readonly<{ x: number; y: number }>): { x: number; y: number }
{
    const length = Math.hypot(position.x, position.y) || 1;
    return { x: -position.x / length * asteroidTuning.salvage.looseItemSunSpeed, y: -position.y / length * asteroidTuning.salvage.looseItemSunSpeed };
}

/** Builds one deterministic, spatially distinct loose item per manifest unit. */
export function spillOrbitalCargo (cargo: OrbitalCargoState, activeElapsedMs: number): readonly LooseItemState[]
{
    const totalQuantity = cargo.manifest.reduce((total, stack) => total + stack.quantity, 0);
    if (totalQuantity === 0) return [];
    const baseSpeed = asteroidTuning.salvage.looseItemEjectionSpeed;
    const spreadRadius = spillSpreadRadius(totalQuantity);
    const basePhase = cargo.orbit.rotationRadians;
    const items: LooseItemState[] = [];
    let unitIndex = 0;
    for (const stack of cargo.manifest) {
        const unitCost = stack.totalCost / stack.quantity;
        for (let localIndex = 0; localIndex < stack.quantity; localIndex++) {
            const angle = (unitIndex / totalQuantity) * fullTurn + basePhase;
            const position = {
                x: cargo.position.x + Math.cos(angle) * spreadRadius,
                y: cargo.position.y + Math.sin(angle) * spreadRadius
            };
            const speedScale = 0.7 + pseudoRandom(cargo.id, unitIndex, 31) * 0.6;
            const speed = baseSpeed * speedScale;
            const totalCost = localIndex + 1 === stack.quantity ? stack.totalCost - unitCost * localIndex : unitCost;
            items.push({
                id: `${cargo.id}-spill-${unitIndex + 1}`,
                position,
                motion: {
                    ejectionVelocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
                    sunVelocity: sunVelocity(position),
                    createdAtActiveMs: activeElapsedMs
                },
                container: { commodityId: stack.commodityId, quantity: 1, totalCost }
            });
            unitIndex++;
        }
    }
    return items;
}

/** Applies projectile-only orbital-cargo damage and emits its loose-item spill. */
export function damageOrbitalCargo (state: GameStateSnapshot, cargoId: string): GameStateSnapshot
{
    const cargo = state.orbitalCargo.find(candidate => candidate.id === cargoId);
    if (!cargo) return state;
    if (cargo.hitPoints > 1) {
        return {
            ...state,
            orbitalCargo: state.orbitalCargo.map(candidate => candidate.id === cargoId
                ? { ...candidate, hitPoints: candidate.hitPoints - 1 }
                : candidate)
        };
    }
    return {
        ...state,
        orbitalCargo: state.orbitalCargo.filter(candidate => candidate.id !== cargoId),
        looseItems: [...state.looseItems, ...spillOrbitalCargo(cargo, state.clock.activeElapsedMs)]
    };
}

/** Collects a loose item when capacity allows; otherwise preserves authoritative state. */
export function collectLooseItem (state: GameStateSnapshot, itemId: string): GameStateSnapshot
{
    const item = state.looseItems.find(candidate => candidate.id === itemId);
    const cargoUsed = state.cargo.reduce((total, container) => total + container.quantity, 0);
    const capacity = cargoCapacityByLevel[state.shipStatus.cargoLevel] ?? 0;
    if (!item || cargoUsed + item.container.quantity > capacity) return state;
    const existing = state.cargo.find(candidate => candidate.commodityId === item.container.commodityId);
    const nextContainer = existing === undefined
        ? item.container
        : {
            commodityId: existing.commodityId,
            quantity: existing.quantity + item.container.quantity,
            totalCost: existing.totalCost + item.container.totalCost
        };
    return {
        ...state,
        cargo: [...state.cargo.filter(candidate => candidate.commodityId !== item.container.commodityId), nextContainer],
        looseItems: state.looseItems.filter(candidate => candidate.id !== itemId)
    };
}
