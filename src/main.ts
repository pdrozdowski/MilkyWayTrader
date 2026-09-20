import StartGame from './game/main';
import { setupApplicationUi } from './ui/setupUi';

document.addEventListener('DOMContentLoaded', () => {

    const root = document.getElementById('app');
    if (!root) throw new Error('Missing application root.');
    StartGame('game-container', { onReady: game => setupApplicationUi(root, game) });

});
