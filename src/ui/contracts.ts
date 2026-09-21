export interface UiHandle
{
    destroy(): void;
}

export type { RunStatusSnapshot } from '../game/application/runStatus';
import type { RunStatusSnapshot } from '../game/application/runStatus';

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
