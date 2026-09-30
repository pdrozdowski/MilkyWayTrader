import { mountAudioControls } from '../../../src/ui/components/audioControls';
import { mountDisplayControls } from '../../../src/ui/components/displayControls';
import { mountRunStatus } from '../../../src/ui/components/runStatus';
import { mountGameMenu } from '../../../src/ui/components/gameMenu';
import { mountLandingStatus } from '../../../src/ui/components/landingStatus';
import { mountAuthControls } from '../../../src/ui/components/authControls';
import type { AuthPort, AuthSnapshot } from '../../../src/game/application/auth/auth';
import type { AudioSettingsSnapshot, DisplaySnapshot, FullscreenResult, LandingStatusSnapshot, RunStatusSnapshot, UiHandle } from '../../../src/ui/contracts';
import type { SerotonCommodityId } from '../../../src/game/state/serotonMarketState';

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
let gameMenuHandle: UiHandle | null = null;
let landingStatusHandle: UiHandle | null = null;
let authHandle: UiHandle | null = null;
let menuOpen = false;
let orientationPaused = false;
let exits = 0;
let launches = 0;
let selectedCommodities: string[] = [];
let tradeQuantities: number[] = [];
let confirmations = 0;
let landingStatusState: LandingStatusSnapshot = {
    visible: false,
    eligible: false,
    planetId: null,
    planetName: null,
    credits: 100_000,
    cargoUsed: 0,
    cargoCapacity: 20,
    commodities: [],
    selectedCommodityId: 'supplies',
    tradeQuantity: 0,
    selectedCommodity: { commodityId: 'supplies', stock: 0, carriedQuantity: 0, unitPrice: 0, averageBuyPrice: 0, productionPerSecond: 0, consumptionPerSecond: 0 },
    plannedStockDelta: 0,
    plannedCargoDelta: 0,
    supplyLevel: 'Medium',
    quote: { quantity: 0, total: 0, failure: 'invalid-quantity', postTradeStock: 0, nextUnitPrice: 0 }
};
let landingStatusListener: ((snapshot: Readonly<LandingStatusSnapshot>) => void) | null = null;
let authState: AuthSnapshot = { status: 'unsigned', email: null, message: null };
const authListeners = new Set<(snapshot: Readonly<AuthSnapshot>) => void>();
let signInAttempts = 0;
let signOutAttempts = 0;

const authPort: AuthPort = {
    getSnapshot: (): Readonly<AuthSnapshot> => authState,
    subscribe: listener => { authListeners.add(listener); return () => authListeners.delete(listener); },
    signInWithGoogle: async (): Promise<void> => { signInAttempts += 1; },
    signOut: async (): Promise<void> => { signOutAttempts += 1; },
    destroy: (): void => { authListeners.clear(); }
};

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

const gameControlsPort = {
    openMenu: (): void => { menuOpen = true; },
    closeMenu: (): void => { menuOpen = false; },
    exitToMainMenu: (): void => { menuOpen = false; exits += 1; },
    setOrientationPaused: (paused: boolean): void => { orientationPaused = paused; },
    isMenuOpen: (): boolean => menuOpen,
    destroy: (): void => {}
};

const landingStatusPort = {
    getSnapshot: (): Readonly<LandingStatusSnapshot> => landingStatusState,
    subscribe: (listener: (snapshot: Readonly<LandingStatusSnapshot>) => void): (() => void) => {
        landingStatusListener = listener;
        listener(landingStatusState);
        return () => { if (landingStatusListener === listener) landingStatusListener = null; };
    },
    selectCommodity: (commodityId: SerotonCommodityId): void => { selectedCommodities.push(commodityId); },
    setTradeQuantity: (quantity: number): void => { tradeQuantities.push(quantity); },
    confirmTrade: (): void => { confirmations += 1; },
    launch: (): void => { launches += 1; },
    destroy: (): void => { landingStatusListener = null; }
};

function mount (): void
{
    audioHandle?.destroy();
    displayHandle?.destroy();
    runStatusHandle?.destroy();
    gameMenuHandle?.destroy();
    landingStatusHandle?.destroy();
    authHandle?.destroy();
    audioHandle = mountAudioControls(root, audioPort);
    displayHandle = mountDisplayControls(root, displayPort, () => {});
    runStatusHandle = mountRunStatus(root, runStatusPort);
    gameMenuHandle = mountGameMenu(root, gameControlsPort, authPort);
    landingStatusHandle = mountLandingStatus(root, landingStatusPort);
    authHandle = mountAuthControls(root, authPort);
}

mount();

window.uiHarness = {
    audio: () => ({ ...audioState }),
    setAudio: state => { audioState = { ...audioState, ...state }; audioListener?.({ ...audioState }); },
    setDisplay: state => { displayState = { ...displayState, ...state }; displayListener?.({ ...displayState }); },
    setFullscreenResult: result => { fullscreenResult = result; },
    setRunStatus: state => { runStatusState = { ...runStatusState, ...state }; runStatusListener?.(runStatusState); },
    setLandingStatus: state => { landingStatusState = { ...landingStatusState, ...state }; landingStatusListener?.(landingStatusState); },
    setAuth: state => { authState = { ...authState, ...state }; for (const listener of authListeners) listener(authState); },
    authActions: () => ({ signInAttempts, signOutAttempts }),
    listeners: () => ({ audio: Number(Boolean(audioListener)), display: Number(Boolean(displayListener)), runStatus: Number(Boolean(runStatusListener)), landingStatus: Number(Boolean(landingStatusListener)), auth: authListeners.size }),
    gameControls: () => ({ menuOpen, orientationPaused, exits }),
    setOrientationPaused: paused => { gameControlsPort.setOrientationPaused(paused); },
    refreshes: () => refreshes,
    launches: () => launches,
    marketActions: () => ({ selectedCommodities: [...selectedCommodities], tradeQuantities: [...tradeQuantities], confirmations }),
    destroy: () => { audioHandle?.destroy(); displayHandle?.destroy(); runStatusHandle?.destroy(); gameMenuHandle?.destroy(); landingStatusHandle?.destroy(); authHandle?.destroy(); },
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
            setLandingStatus(state: Partial<LandingStatusSnapshot>): void;
            setAuth(state: Partial<AuthSnapshot>): void;
            authActions(): { signInAttempts: number; signOutAttempts: number };
            listeners(): { audio: number; display: number; runStatus: number; landingStatus: number; auth: number };
            refreshes(): number;
            gameControls(): { menuOpen: boolean; orientationPaused: boolean; exits: number };
            setOrientationPaused(paused: boolean): void;
            launches(): number;
            marketActions(): { selectedCommodities: string[]; tradeQuantities: number[]; confirmations: number };
            destroy(): void;
            mount(): void;
        };
    }
}
