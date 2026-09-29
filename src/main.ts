import StartGame from './game/main';
import { setupApplicationUi } from './ui/setupUi';
import { createBrowserAuthPort } from './game/application/auth/auth';

document.addEventListener('DOMContentLoaded', () => {

    const root = document.getElementById('app');
    if (!root) throw new Error('Missing application root.');
    const auth = createBrowserAuthPort();
    StartGame('game-container', { onReady: game => setupApplicationUi(root, game, auth) });

});
