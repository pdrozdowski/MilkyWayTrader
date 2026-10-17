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

export interface GameBootstrapHooks
{
    onReady?(game: Game): void;
    resultStore?: ResultStorePort;
    activeRunStore?: ActiveRunStorePort;
    gameOverReturn?: GameOverReturnPort;
    authReturn?: AuthReturnPort;
    telemetry?: TelemetryPort;
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
                game.registry.set('performanceMonitor', createPerformanceMonitor({ now: () => performance.now(), windowMs: 5000 }));
                game.registry.set('resultStore', hooks.resultStore);
                game.registry.set('activeRunStore', hooks.activeRunStore);
                game.registry.set('gameOverReturn', hooks.gameOverReturn);
                game.registry.set('telemetry', hooks.telemetry);
                let authReturnContext = hooks.authReturn?.take() ?? null;
                let authReturnError = hooks.authReturn?.getError() ?? null;
                if (authReturnContext?.snapshot) {
                    try { (game.registry.get('gameStateProvider') as GameStateProvider).restore(authReturnContext.snapshot); }
                    catch {
                        authReturnContext = null;
                        authReturnError = 'The previous run could not be restored. Start a new run from the Main Menu.';
                    }
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
