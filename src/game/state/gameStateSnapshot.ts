import type { GameClockState } from './gameClockState';
import type { CargoState } from './cargoState';
import type { PlanetState } from './planetState';
import type { ProjectileState } from './projectileState';
import type { ShipState } from './shipState';
import type { ShipStatusState } from './shipStatusState';
import type { WeaponState } from './weaponState';
import type { PlanetLifecycleState } from './planetLifecycleState';

export interface GameStateSnapshot
{
    readonly schemaVersion: 4;
    readonly clock: GameClockState;
    readonly credits: number;
    readonly cargo: readonly CargoState[];
    readonly ship: ShipState;
    readonly shipStatus: ShipStatusState;
    readonly planets: readonly PlanetState[];
    readonly planetLifecycle: PlanetLifecycleState;
    readonly weapon: WeaponState;
    readonly projectiles: readonly ProjectileState[];
}
