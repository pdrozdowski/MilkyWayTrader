import { mountAudioControls } from '../../../src/ui/components/audioControls';
import { mountDisplayControls } from '../../../src/ui/components/displayControls';
import type { AudioSettingsSnapshot, DisplaySnapshot, FullscreenResult, UiHandle } from '../../../src/ui/contracts';

function harnessRoot (): HTMLElement
{
    const element = document.getElementById('app');
    if (!element) throw new Error('Harness root missing.');
    return element;
}

const root = harnessRoot();

let audioState: AudioSettingsSnapshot = { muted: false, masterVolume: 0.5 };
let displayState: DisplaySnapshot = { mobile: true, portrait: false, fullscreenAvailable: true, fullscreenActive: false };
let fullscreenResult: FullscreenResult = 'success';
let audioListener: ((settings: Readonly<AudioSettingsSnapshot>) => void) | null = null;
let displayListener: ((settings: Readonly<DisplaySnapshot>) => void) | null = null;
let refreshes = 0;
let audioHandle: UiHandle | null = null;
let displayHandle: UiHandle | null = null;

const audioPort = {
    getSettings: (): Readonly<AudioSettingsSnapshot> => ({ ...audioState }),
    subscribe: (listener: (settings: Readonly<AudioSettingsSnapshot>) => void): (() => void) => {
        audioListener = listener;
        listener({ ...audioState });
        return () => { if (audioListener === listener) audioListener = null; };
    },
    setMuted: (muted: boolean): void => { audioState = { ...audioState, muted }; audioListener?.({ ...audioState }); },
    setMasterVolume: (masterVolume: number): void => { audioState = { ...audioState, masterVolume }; audioListener?.({ ...audioState }); }
};

const displayPort = {
    getSnapshot: (): Readonly<DisplaySnapshot> => ({ ...displayState }),
    subscribe: (listener: (snapshot: Readonly<DisplaySnapshot>) => void): (() => void) => {
        displayListener = listener;
        listener({ ...displayState });
        return () => { if (displayListener === listener) displayListener = null; };
    },
    toggleFullscreen: async (): Promise<FullscreenResult> => fullscreenResult,
    refreshScale: (): void => { refreshes += 1; },
    destroy: (): void => { displayListener = null; }
};

function mount (): void
{
    audioHandle?.destroy();
    displayHandle?.destroy();
    audioHandle = mountAudioControls(root, audioPort);
    displayHandle = mountDisplayControls(root, displayPort);
}

mount();

window.uiHarness = {
    audio: () => ({ ...audioState }),
    setAudio: state => { audioState = { ...audioState, ...state }; audioListener?.({ ...audioState }); },
    setDisplay: state => { displayState = { ...displayState, ...state }; displayListener?.({ ...displayState }); },
    setFullscreenResult: result => { fullscreenResult = result; },
    listeners: () => ({ audio: Number(Boolean(audioListener)), display: Number(Boolean(displayListener)) }),
    refreshes: () => refreshes,
    destroy: () => { audioHandle?.destroy(); displayHandle?.destroy(); },
    mount
};

declare global {
    interface Window {
        uiHarness: {
            audio(): AudioSettingsSnapshot;
            setAudio(state: Partial<AudioSettingsSnapshot>): void;
            setDisplay(state: Partial<DisplaySnapshot>): void;
            setFullscreenResult(result: FullscreenResult): void;
            listeners(): { audio: number; display: number };
            refreshes(): number;
            destroy(): void;
            mount(): void;
        };
    }
}
