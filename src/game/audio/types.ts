export interface SoundDefinition
{
    id: string;
    key: `audio:${string}`;
    paths: readonly string[];
    category: 'music' | 'sfx';
    mode: 'one-shot' | 'loop';
    gain: number;
    maxVoices: number;
    credit: { source: string; author: string; license: string; attribution?: string };
}

export interface AudioSettings { muted: boolean; masterVolume: number }
export interface LoopOptions { rate?: number; volume?: number }

/** Small adapter keeps playback/lifecycle testable without a browser or another AudioContext. */
export interface AudioVoice
{
    readonly isPlaying: boolean;
    play(config: { loop: boolean; volume: number; rate: number }): boolean;
    stop(): unknown;
    setVolume(volume: number): unknown;
    setRate(rate: number): unknown;
}

export interface AudioBackend
{
    canPlay(): boolean;
    add(key: string): AudioVoice | null;
    remove(voice: AudioVoice): void;
    applySettings(settings: AudioSettings): void;
}

export interface AudioOwner
{
    events: {
        on(event: string, callback: () => void): unknown;
        off(event: string, callback: () => void): unknown;
    };
}

export interface SettingsStorage
{
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
}
