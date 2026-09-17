import StartGame from './game/main';
import { setupDisplay } from './display';

document.addEventListener('DOMContentLoaded', () => {

    const game = StartGame('game-container');
    setupDisplay(game);

});
