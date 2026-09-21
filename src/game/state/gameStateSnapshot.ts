import type { GameClockState } from './gameClockState';
import type { PlanetState } from './planetState';
import type { ProjectileState } from './projectileState';
import type { ShipState } from './shipState';
import type { WeaponState } from './weaponState';

export interface GameStateSnapshot
{
    readonly schemaVersion: 2;
    readonly clock: GameClockState;
    readonly ship: ShipState;
    readonly planets: readonly PlanetState[];
    readonly weapon: WeaponState;
    readonly projectiles: readonly ProjectileState[];
}
