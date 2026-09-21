export interface ShipStatusState
{
    readonly currentHitPoints: number;
    readonly cargoLevel: number;
    readonly engineLevel: number;
    readonly weaponLevel: number;
    readonly boosterUnlocked: boolean;
}
