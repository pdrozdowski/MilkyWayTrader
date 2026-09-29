import StartGame from './game/main';
import { setupApplicationUi } from './ui/setupUi';
import { createBrowserAuthPort } from './game/application/auth/auth';
import { createBrowserTelemetryPort } from './game/application/telemetry/browserTelemetry';

document.addEventListener('DOMContentLoaded', () => {

    const root = document.getElementById('app');
    if (!root) throw new Error('Missing application root.');
    const auth = createBrowserAuthPort();
    const telemetry = createBrowserTelemetryPort(auth);
    StartGame('game-container', { onReady: game => setupApplicationUi(root, game, auth, telemetry) });

});
