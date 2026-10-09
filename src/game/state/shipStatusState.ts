/**
 * Authoritative ship condition and progression. Every level is bound to a configured table in
 * `src/game/domain/runBalance.ts`; the codec rejects a level the balance catalogue does not support.
 */
export interface ShipStatusState
{
    readonly currentHitPoints: number;
    readonly cargoLevel: number;
    readonly engineLevel: number;
    readonly weaponLevel: number;
    readonly boosterUnlocked: boolean;
}
