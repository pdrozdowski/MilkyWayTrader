import { Boot } from './scenes/bootScene';
import { GameOver } from './scenes/gameOverScene';
import { Game as MainGame } from './scenes/gameScene';
import { MainMenu } from './scenes/mainMenuScene';
import { AUTO, Game, Scale } from 'phaser';
import { Preloader } from './scenes/preloaderScene';
import { initializeGameAudio } from './audio/gameAudio';
import { GameStateProvider } from './application/gameStateProvider';
import { initialGameState } from './definitions/initialGameState';

export interface GameBootstrapHooks
{
    onReady?(game: Game): void;
}

//  Find out more information about the Game Config at:
//  https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
const config: Phaser.Types.Core.GameConfig = {
    type: AUTO,
    width: 1024,
    height: 768,
    parent: 'game-container',
    scale: {
        mode: Scale.FIT,
        autoCenter: Scale.CENTER_BOTH,
        fullscreenTarget: 'app'
    },
    backgroundColor: '#028af8',
    // Canvas touch-action:none handles gesture capture, including non-cancelable touchcancel.
    input: { touch: { capture: false } },
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
                hooks.onReady?.(game);
            }
        }
    });

}

export default StartGame;
