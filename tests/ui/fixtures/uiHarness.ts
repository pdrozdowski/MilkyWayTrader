import { mountAudioControls } from '../../../src/ui/components/audioControls';
import { mountDisplayControls } from '../../../src/ui/components/displayControls';
import { mountRunStatus } from '../../../src/ui/components/runStatus';
import type { AudioSettingsSnapshot, DisplaySnapshot, FullscreenResult, RunStatusSnapshot, UiHandle } from '../../../src/ui/contracts';

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
let runStatusListener: ((snapshot: Readonly<RunStatusSnapshot>) => void) | null = null;
let runStatusState: RunStatusSnapshot = { visible: true, remainingSeconds: 1800, runState: 'RUNNING', credits: 100_000, cargo: [], cargoUsed: 0, cargoCapacity: 20, currentHitPoints: 100, maximumHitPoints: 100, cargoSystem: { level: 1, available: true }, engineSystem: { level: 1, available: true }, weaponSystem: { level: 1, available: true }, boosterAvailable: false };
let refreshes = 0;
let audioHandle: UiHandle | null = null;
let displayHandle: UiHandle | null = null;
let runStatusHandle: UiHandle | null = null;

const runStatusPort = {
    getSnapshot: (): Readonly<RunStatusSnapshot> => runStatusState,
    subscribe: (listener: (snapshot: Readonly<RunStatusSnapshot>) => void): (() => void) => {
        runStatusListener = listener; listener(runStatusState);
        return () => { if (runStatusListener === listener) runStatusListener = null; };
    },
    destroy: (): void => { runStatusListener = null; }
};

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
    runStatusHandle?.destroy();
    audioHandle = mountAudioControls(root, audioPort);
    displayHandle = mountDisplayControls(root, displayPort);
    runStatusHandle = mountRunStatus(root, runStatusPort);
}

mount();

window.uiHarness = {
    audio: () => ({ ...audioState }),
    setAudio: state => { audioState = { ...audioState, ...state }; audioListener?.({ ...audioState }); },
    setDisplay: state => { displayState = { ...displayState, ...state }; displayListener?.({ ...displayState }); },
    setFullscreenResult: result => { fullscreenResult = result; },
    setRunStatus: state => { runStatusState = { ...runStatusState, ...state }; runStatusListener?.(runStatusState); },
    listeners: () => ({ audio: Number(Boolean(audioListener)), display: Number(Boolean(displayListener)), runStatus: Number(Boolean(runStatusListener)) }),
    refreshes: () => refreshes,
    destroy: () => { audioHandle?.destroy(); displayHandle?.destroy(); runStatusHandle?.destroy(); },
    mount
};

declare global {
    interface Window {
        uiHarness: {
            audio(): AudioSettingsSnapshot;
            setAudio(state: Partial<AudioSettingsSnapshot>): void;
            setDisplay(state: Partial<DisplaySnapshot>): void;
            setFullscreenResult(result: FullscreenResult): void;
            setRunStatus(state: Partial<RunStatusSnapshot>): void;
            listeners(): { audio: number; display: number; runStatus: number };
            refreshes(): number;
            destroy(): void;
            mount(): void;
        };
    }
}
