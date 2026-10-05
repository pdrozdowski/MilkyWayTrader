export interface UiHandle
{
    destroy(): void;
}

export type { RunStatusSnapshot } from '../game/application/runStatus';
export type { LandedMarketSnapshot as LandingStatusSnapshot } from '../game/application/landedMarket';
export type { AuthPort, AuthSnapshot } from '../game/application/auth/auth';
import type { LandedMarketSnapshot as LandingStatusSnapshot } from '../game/application/landedMarket';
import type { SerotonCommodityId } from '../game/state/serotonMarketState';
import type { RunStatusSnapshot } from '../game/application/runStatus';
import type { CommodityContainerState } from '../game/state/commodityContainerState';

export type LandingCommodityId = LandingStatusSnapshot['selectedCommodityId'];

export interface RunStatusPort extends UiHandle
{
    getSnapshot(): Readonly<RunStatusSnapshot>;
    subscribe(listener: (snapshot: Readonly<RunStatusSnapshot>) => void): () => void;
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
    selectCommodity(commodityId: SerotonCommodityId): void;
    setTradeQuantity(quantity: number): void;
    confirmTrade(): void;
    launch(): void;
}

export interface CargoTransferSnapshot
{
    readonly visible: boolean;
    readonly cargoId: string | null;
    readonly cargo: CommodityContainerState | null;
    readonly ship: CommodityContainerState | null;
    readonly cargoUsed: number;
    readonly cargoCapacity: number;
    readonly warning: string | null;
}

export interface CargoTransferPort extends UiHandle
{
    getSnapshot(): Readonly<CargoTransferSnapshot>;
    subscribe(listener: (snapshot: Readonly<CargoTransferSnapshot>) => void): () => void;
    transferToShip(): void;
    transferToCargo(): void;
    close(): void;
}
