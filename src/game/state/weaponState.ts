export interface WeaponState
{
    readonly nextShotAtMs: number | null;
    readonly lastShotAtMs: number | null;
    readonly projectileSequence: number;
}
