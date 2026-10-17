import StartGame from './game/main';
import { setupApplicationUi } from './ui/setupUi';
import { createBrowserAuthPort } from './ui/adapters/browserAuth';
import { createBrowserTelemetryPort } from './ui/adapters/browserTelemetry';
import { createBrowserResultStore } from './ui/adapters/browserResultStore';
import { createBrowserActiveRunStore } from './ui/adapters/browserActiveRunStore';
import { createBrowserGameOverReturnPort } from './ui/adapters/browserGameOverReturn';
import { createBrowserAuthReturnPort } from './ui/adapters/browserAuthReturn';
import { createPlayerEligibility } from './game/application/auth/playerEligibility';
import { generateDefaultPlayerNickname } from './game/application/playerProfile';
import { createBrowserSaveScheduler } from './ui/adapters/browserSaveScheduler';
import { createBrowserPendingRunResult } from './ui/adapters/browserPendingRunResult';

document.addEventListener('DOMContentLoaded', () => {

    const root = document.getElementById('app');
    if (!root) throw new Error('Missing application root.');
    const auth = createBrowserAuthPort();
    const profilePort = auth.createPlayerProfilePort?.() ?? null;
    const eligibility = createPlayerEligibility(auth, profilePort, generateDefaultPlayerNickname);
    const telemetry = createBrowserTelemetryPort(auth);
    const resultStore = createBrowserResultStore();
    const activeRunStore = createBrowserActiveRunStore();
    const gameOverReturn = createBrowserGameOverReturnPort();
    const authReturn = createBrowserAuthReturnPort();
    StartGame('game-container', { resultStore, activeRunStore, gameOverReturn, authReturn, telemetry, eligibility, saveScheduler: createBrowserSaveScheduler(), pendingRunResult: createBrowserPendingRunResult(), onReady: game => setupApplicationUi(root, game, auth, telemetry, gameOverReturn, authReturn, profilePort, eligibility) });

});
