import StartGame from './game/main';
import { setupApplicationUi } from './ui/setupUi';
import { createBrowserAuthPort } from './ui/adapters/browserAuth';
import { createBrowserTelemetryPort } from './ui/adapters/browserTelemetry';
import { createBrowserResultStore } from './ui/adapters/browserResultStore';
import { createBrowserGameOverReturnPort } from './ui/adapters/browserGameOverReturn';

document.addEventListener('DOMContentLoaded', () => {

    const root = document.getElementById('app');
    if (!root) throw new Error('Missing application root.');
    const auth = createBrowserAuthPort();
    const telemetry = createBrowserTelemetryPort(auth);
    const resultStore = createBrowserResultStore();
    const gameOverReturn = createBrowserGameOverReturnPort();
    StartGame('game-container', { resultStore, gameOverReturn, onReady: game => setupApplicationUi(root, game, auth, telemetry, gameOverReturn) });

});
