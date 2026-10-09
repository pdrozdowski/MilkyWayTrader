export interface WeaponState
{
    readonly nextShotAtMs: number | null;
    readonly lastShotAtMs: number | null;
    /** Firing-cadence beat count; one beat is one volley number (BR-044). */
    readonly projectileSequence: number;
}
