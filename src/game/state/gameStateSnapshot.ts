import type { GameClockState } from './gameClockState';
import type { CargoState } from './cargoState';
import type { PlanetState } from './planetState';
import type { ProjectileState } from './projectileState';
import type { ShipState } from './shipState';
import type { ShipStatusState } from './shipStatusState';
import type { WeaponState } from './weaponState';
import type { PlanetLifecycleState } from './planetLifecycleState';
import type { SerotonMarketState } from './serotonMarketState';
import type { AsteroidState } from './asteroidState';
import type { TerminalResultState } from './terminalResultState';

export interface GameStateSnapshot
{
    readonly schemaVersion: 11;
    readonly runId: string;
    readonly randomState: number;
    /** True until Moolaris has dealt its one damage hit for the current entry. */
    readonly moolarisDamageArmed: boolean;
    readonly terminalResult: TerminalResultState | null;
    readonly clock: GameClockState;
    readonly credits: number;
    readonly cargo: readonly CargoState[];
    readonly markets: readonly SerotonMarketState[];
    readonly ship: ShipState;
    readonly shipStatus: ShipStatusState;
    readonly planets: readonly PlanetState[];
    readonly planetLifecycle: PlanetLifecycleState;
    readonly weapon: WeaponState;
    readonly projectiles: readonly ProjectileState[];
    readonly asteroids: readonly AsteroidState[];
}
