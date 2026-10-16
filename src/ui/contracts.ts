export interface UiHandle
{
    destroy(): void;
}

export interface GameIntroPort
{
    startGame(): void;
}

export type { RunStatusSnapshot } from '../game/application/runStatus';
export type { LandedMarketSnapshot as LandingStatusSnapshot } from '../game/application/landedMarket';
export type { LandedFacilitiesSnapshot } from '../game/application/landedFacilities';
export type { LandedShipyardSnapshot } from '../game/application/landedShipyard';
export type { AuthPort, AuthSnapshot } from '../game/application/auth/auth';
export type { PlayerProfile, PlayerProfilePort } from '../game/application/playerProfile';
export type { AccountOrigin } from '../game/application/auth/authReturn';
export type { PerformanceDurationSummary, PerformanceStepId, PerformanceStepSummary, PerformanceSnapshot } from '../game/application/performanceMonitor';
export type { ResultHistoryRecord, ResultHistoryStorePort } from '../game/application/results/resultHistoryStore';
export { resultHistoryPageSize } from '../game/application/results/resultHistoryStore';

export interface GlobalScoreRecord
{
    readonly rank: number;
    readonly nickname: string;
    readonly achievedAt: string;
    readonly score: number;
}

export interface GlobalScoreStorePort
{
    submit(score: number): Promise<{ readonly error: string | null }>;
    getTop(): Promise<{ readonly data: readonly GlobalScoreRecord[] | null; readonly error: string | null }>;
    getPersonalBestRank(score: number): Promise<{ readonly data: number | null; readonly error: string | null }>;
}
import type { LandedMarketSnapshot as LandingStatusSnapshot } from '../game/application/landedMarket';
import type { LandedFacilitiesSnapshot } from '../game/application/landedFacilities';
import type { LandedShipyardSnapshot } from '../game/application/landedShipyard';
import type { PerformanceSnapshot } from '../game/application/performanceMonitor';
import type { ShipServiceId } from '../game/application/planetShipServices';
import type { PlanetFacilityId, SerotonCommodityId } from '../game/state/serotonMarketState';
import type { RunStatusSnapshot } from '../game/application/runStatus';

export type LandingCommodityId = LandingStatusSnapshot['selectedCommodityId'];
export type LandingFacilityId = PlanetFacilityId;
export type LandingShipServiceId = ShipServiceId;

export interface RunStatusPort extends UiHandle
{
    getSnapshot(): Readonly<RunStatusSnapshot>;
    subscribe(listener: (snapshot: Readonly<RunStatusSnapshot>) => void): () => void;
}

export interface PerformanceReadoutPort extends UiHandle
{
    getSnapshot(): Readonly<PerformanceSnapshot>;
    subscribe(listener: (snapshot: Readonly<PerformanceSnapshot>) => void): () => void;
}

export interface AudioSettingsSnapshot
{
    muted: boolean;
    masterVolume: number;
}

export interface AudioSettingsPort
{
    getSettings(): Readonly<AudioSettingsSnapshot>;
    subscribe(listener: (settings: Readonly<AudioSettingsSnapshot>) => void): () => void;
    setMuted(muted: boolean): void;
    setMasterVolume(volume: number): void;
}

export interface DisplaySnapshot
{
    mobile: boolean;
    portrait: boolean;
    fullscreenAvailable: boolean;
    fullscreenActive: boolean;
}

export type FullscreenResult = 'success' | 'manual-rotation' | 'failed';

export interface DisplayPort extends UiHandle
{
    getSnapshot(): Readonly<DisplaySnapshot>;
    subscribe(listener: (snapshot: Readonly<DisplaySnapshot>) => void): () => void;
    toggleFullscreen(): Promise<FullscreenResult>;
    refreshScale(): void;
}

export interface GameControlsPort extends UiHandle
{
    openMenu(): void;
    closeMenu(): void;
    exitToMainMenu(): void;
    setOrientationPaused(paused: boolean): void;
    isMenuOpen(): boolean;
}

export interface LandingStatusPort extends UiHandle
{
    getSnapshot(): Readonly<LandingStatusSnapshot>;
    subscribe(listener: (snapshot: Readonly<LandingStatusSnapshot>) => void): () => void;
    getFacilitiesSnapshot(): Readonly<LandedFacilitiesSnapshot>;
    subscribeFacilities(listener: (snapshot: Readonly<LandedFacilitiesSnapshot>) => void): () => void;
    getShipyardSnapshot(): Readonly<LandedShipyardSnapshot>;
    subscribeShipyard(listener: (snapshot: Readonly<LandedShipyardSnapshot>) => void): () => void;
    selectCommodity(commodityId: SerotonCommodityId): void;
    setTradeQuantity(quantity: number): void;
    confirmTrade(): void;
    buildFacility(facilityId: LandingFacilityId): void;
    upgradeFacility(facilityId: LandingFacilityId): void;
    downgradeFacility(facilityId: LandingFacilityId): void;
    repairShip(): void;
    upgradeShipService(serviceId: LandingShipServiceId): void;
    purchaseBooster(): void;
    togglePlayerPause(): void;
    launch(): void;
}

export interface CargoTransferRow
{
    readonly commodityId: string;
    readonly cargoQuantity: number;
    readonly shipQuantity: number;
}

export type CargoTransferDirection = 'to-ship' | 'to-orbit';
export type CargoTransferAmount = 'one' | 'max';

export interface CargoTransferSnapshot
{
    readonly visible: boolean;
    readonly cargoId: string | null;
    readonly rows: readonly CargoTransferRow[];
    readonly cargoUsed: number;
    readonly cargoCapacity: number;
    readonly shipUsed: number;
    readonly shipCapacity: number;
    readonly warning: string | null;
}

export interface CargoTransferPort extends UiHandle
{
    getSnapshot(): Readonly<CargoTransferSnapshot>;
    subscribe(listener: (snapshot: Readonly<CargoTransferSnapshot>) => void): () => void;
    transfer(commodityId: string, direction: CargoTransferDirection, amount: CargoTransferAmount): void;
    close(): void;
}
