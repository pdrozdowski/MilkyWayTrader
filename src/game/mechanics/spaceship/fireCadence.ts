import type { WeaponState } from '../../state/weaponState';

export interface FireCadenceResult
{
    readonly weapon: WeaponState;
    readonly fired: boolean;
}

// Keep held fire on a fixed active-time beat without replaying missed shots.
export function advanceFireCadence (weapon: WeaponState, activeTimeMs: number, enabled: boolean, intervalMs: number): FireCadenceResult
{
    if (!enabled) return { weapon: { ...weapon, nextShotAtMs: null }, fired: false };
    const nextShotAtMs = weapon.nextShotAtMs ?? Math.max(activeTimeMs, (weapon.lastShotAtMs ?? activeTimeMs - intervalMs) + intervalMs);
    if (activeTimeMs < nextShotAtMs) return { weapon: { ...weapon, nextShotAtMs }, fired: false };
    let followingShotAtMs = nextShotAtMs + intervalMs;
    if (followingShotAtMs - activeTimeMs < intervalMs / 2) followingShotAtMs = activeTimeMs + intervalMs;
    return {
        weapon: { ...weapon, nextShotAtMs: followingShotAtMs, lastShotAtMs: activeTimeMs },
        fired: true
    };
}
