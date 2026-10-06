import type { GameClockState } from './gameClockState';
import type { CommodityContainerState } from './commodityContainerState';
import type { LooseItemState } from './looseItemState';
import type { OrbitalCargoState } from './orbitalCargoState';
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
    readonly schemaVersion: 15;
    readonly runId: string;
    readonly randomState: number;
    /** Unconsumed entries in a lazily seeded five-kill cargo schedule. */
    readonly cargoSchedule: readonly (0 | 1)[];
    /** True until Moolaris has dealt its one damage hit for the current entry. */
    readonly moolarisDamageArmed: boolean;
    readonly terminalResult: TerminalResultState | null;
    readonly clock: GameClockState;
    readonly credits: number;
    readonly cargo: readonly CommodityContainerState[];
    readonly orbitalCargo: readonly OrbitalCargoState[];
    readonly looseItems: readonly LooseItemState[];
    readonly markets: readonly SerotonMarketState[];
    readonly ship: ShipState;
    readonly shipStatus: ShipStatusState;
    readonly planets: readonly PlanetState[];
    readonly planetLifecycle: PlanetLifecycleState;
    readonly weapon: WeaponState;
    readonly projectiles: readonly ProjectileState[];
    readonly asteroids: readonly AsteroidState[];
}
