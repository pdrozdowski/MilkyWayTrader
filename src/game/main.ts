import { Boot } from './scenes/bootScene';
import { GameOver } from './scenes/gameOverScene';
import { Game as MainGame } from './scenes/gameScene';
import { MainMenu } from './scenes/mainMenuScene';
import { AUTO, Game, Scale } from 'phaser';
import { Preloader } from './scenes/preloaderScene';
import { initializeGameAudio } from './audio/gameAudio';
import { GameStateProvider } from './application/gameStateProvider';
import { createPerformanceMonitor } from './application/performanceMonitor';
import type { ResultStorePort } from './application/results/resultStore';
import type { ActiveRunStorePort } from './application/saves/activeRunStore';
import type { GameOverReturnPort } from './application/results/gameOverReturn';
import type { AuthReturnPort } from './application/auth/authReturn';
import type { TelemetryPort } from './application/telemetry/telemetry';
import { initialGameState } from './definitions/initialGameState';
import type { PlayerEligibilityPort } from './application/auth/playerEligibility.ts';
import type { SaveSchedulerPort } from './application/saves/runSaveCoordinator.ts';
import { createRunSaveCoordinator } from './application/saves/runSaveCoordinator.ts';
import type { PendingRunResultPort } from './application/results/pendingRunResult.ts';

export interface GameBootstrapHooks
{
    onReady?(game: Game): void;
    resultStore?: ResultStorePort;
    activeRunStore?: ActiveRunStorePort;
    gameOverReturn?: GameOverReturnPort;
    authReturn?: AuthReturnPort;
    telemetry?: TelemetryPort;
    eligibility?: PlayerEligibilityPort;
    saveScheduler?: SaveSchedulerPort;
    pendingRunResult?: PendingRunResultPort;
}

//  Find out more information about the Game Config at:
//  https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
const config: Phaser.Types.Core.GameConfig = {
    type: AUTO,
    width: 1024,
    height: 768,
    parent: 'game-container',
    scale: {
        mode: Scale.RESIZE,
        autoCenter: Scale.CENTER_BOTH,
        fullscreenTarget: 'app'
    },
    backgroundColor: '#028af8',
    // Canvas touch-action:none handles gesture capture, including non-cancelable touchcancel.
    input: { activePointers: 4, touch: { capture: false } },
    physics: {
        default: 'arcade',
        arcade: { gravity: { x: 0, y: 0 }, debug: false }
    },
    scene: [
        Boot,
        Preloader,
        MainMenu,
        MainGame,
        GameOver
    ]
};

const StartGame = (parent: string, hooks: GameBootstrapHooks = {}) => {

    return new Game({
        ...config,
        parent,
        callbacks: {
            postBoot: game => {
                initializeGameAudio(game);
                game.registry.set('gameStateProvider', new GameStateProvider(initialGameState));
                const provider = game.registry.get('gameStateProvider') as GameStateProvider;
                let runSaveCoordinator: ReturnType<typeof createRunSaveCoordinator> | null = null;
                if (hooks.activeRunStore && hooks.eligibility && hooks.saveScheduler && hooks.pendingRunResult) {
                    runSaveCoordinator = createRunSaveCoordinator({
                        provider,
                        store: hooks.activeRunStore,
                        resultStore: hooks.resultStore,
                        pendingResult: hooks.pendingRunResult,
                        eligibility: hooks.eligibility,
                        scheduler: hooks.saveScheduler,
                        createMutationId: () => crypto.randomUUID(),
                        publish: notice => game.events.emit('run-save-status', notice),
                        publishResult: notice => {
                            game.registry.set('terminalDeliveryStatus', notice);
                            game.events.emit('terminal-delivery-status', notice);
                        }
                    });
                    game.events.on('active-run-ready', runSaveCoordinator.startRun);
                    game.events.on('menu-save-request', runSaveCoordinator.requestSave);
                    game.events.on('game-over-retry', runSaveCoordinator.retryTerminal);
                    const reloadAuthoritativeSave = (complete?: (restored: boolean) => void): void => {
                        void runSaveCoordinator!.reloadAuthoritative().then(complete);
                    };
                    game.events.on('reload-authoritative-save', reloadAuthoritativeSave);
                    game.registry.set('reloadAuthoritativeSave', (): Promise<boolean> => new Promise(resolve => {
                        game.events.emit('reload-authoritative-save', resolve);
                    }));
                    game.registry.set('abandonAccountRun', runSaveCoordinator.abandonAccountRun);
                    game.registry.set('setRestoredRunOwner', runSaveCoordinator.setRestoredRunOwner);
                    game.events.once('destroy', () => {
                        game.events.off('active-run-ready', runSaveCoordinator?.startRun);
                        game.events.off('menu-save-request', runSaveCoordinator?.requestSave);
                        game.events.off('game-over-retry', runSaveCoordinator?.retryTerminal);
                        game.events.off('reload-authoritative-save', reloadAuthoritativeSave);
                        game.registry.remove('reloadAuthoritativeSave');
                        game.registry.remove('abandonAccountRun');
                        game.registry.remove('setRestoredRunOwner');
                        runSaveCoordinator?.destroy();
                    });
                }
                game.registry.set('performanceMonitor', createPerformanceMonitor({ now: () => performance.now(), windowMs: 5000 }));
                game.registry.set('resultStore', hooks.resultStore);
                game.registry.set('activeRunStore', hooks.activeRunStore);
                game.registry.set('playerEligibility', hooks.eligibility);
                game.registry.set('gameOverReturn', hooks.gameOverReturn);
                game.registry.set('telemetry', hooks.telemetry);
                let authReturnContext = hooks.authReturn?.take() ?? null;
                let authReturnError = hooks.authReturn?.getError() ?? null;
                if (authReturnContext?.snapshot) {
                    try { provider.restore(authReturnContext.snapshot); }
                    catch {
                        authReturnContext = null;
                        authReturnError = 'The previous run could not be restored. Start a new run from the Main Menu.';
                    }
                }
                if (runSaveCoordinator) {
                    const setRestoredRunOwner = game.registry.get('setRestoredRunOwner') as ((ownerId: string | null) => void) | undefined;
                    setRestoredRunOwner?.(authReturnContext?.snapshot ? authReturnContext.snapshotOwnerId ?? null : null);
                }
                if (authReturnContext?.telemetryContext) hooks.telemetry?.restoreSessionContext(authReturnContext.telemetryContext);
                game.registry.set('authReturnError', authReturnError);
                game.registry.set('authReturnContext', authReturnContext);
                hooks.onReady?.(game);
            }
        }
    });

}

export default StartGame;
