import type { Game } from 'phaser';
import { createAudioSettingsPort } from './adapters/audioSettingsAdapter';
import { createDisplayPort } from './adapters/displayAdapter';
import { createGameControlsPort } from './adapters/gameControlsAdapter';
import { createRunStatusPort } from './adapters/runStatusAdapter';
import { createLandingStatusPort } from './adapters/landingStatusAdapter';
import { createCargoTransferPort } from './adapters/cargoTransferAdapter';
import { createPerformanceReadoutPort } from './adapters/performanceReadoutAdapter';
import { createBrowserResultHistoryStore } from './adapters/browserResultHistoryStore';
import { createBrowserGlobalScoreStore } from './adapters/browserGlobalScoreStore';
import { mountAudioControls } from './components/audioControls';
import { mountDisplayControls } from './components/displayControls';
import { mountGameMenu } from './components/gameMenu';
import { mountRunStatus } from './components/runStatus';
import { mountLandingStatus } from './components/landingStatus';
import { mountCargoTransfer } from './components/cargoTransfer';
import { mountPerformanceReadout } from './components/performanceReadout';
import { formatCredits } from './components/formatCredits';
import { mountPlayerAccount } from './components/playerAccount';
import { mountPersonalBest } from './components/personalBest';
import { mountGlobalHighScores } from './components/globalHighScores';
import { mountGameIntro } from './components/gameIntro';
import type { AuthReturnPort, AccountOrigin } from '../game/application/auth/authReturn';
import type { AuthPort } from '../game/application/auth/auth';
import type { TelemetryPort } from '../game/application/telemetry/telemetry';
import { generateDefaultPlayerNickname } from '../game/application/playerProfile';
import type { GameOverReturnPort } from '../game/application/results/gameOverReturn';
import type { TerminalScoreResult } from '../game/application/results/terminalScoreResult';
import { createTerminalScoreResult } from '../game/application/results/terminalScoreResult';
import type { UiHandle } from './contracts';
import { resultLabels } from '../game/application/results/resultLabels';
import { displayLabels } from './components/displayLabels';
import { bindDebugCargoControl } from './components/debugCargoControl';
import { shipServiceDefinitions, shipServiceLevelOf } from '../game/application/planetShipServices';
import type { ShipServiceId } from '../game/application/planetShipServices';
import type { GameStateProvider } from '../game/application/gameStateProvider';
import { setGameClockToThreeSecondsRemaining } from '../game/mechanics/clock/gameClock';

export function setupApplicationUi (root: HTMLElement, game: Game, auth: AuthPort, telemetry: TelemetryPort, gameOverReturn: GameOverReturnPort, authReturn?: AuthReturnPort): UiHandle
{
    const container = root.querySelector<HTMLElement>('#game-container');
    if (!container) throw new Error('Missing game container.');
    game.canvas.tabIndex = 0;
    const audio = mountAudioControls(root, createAudioSettingsPort(game));
    const controlsPort = createGameControlsPort(game);
    const menuControls = mountGameMenu(root, controlsPort);
    const displayPort = createDisplayPort(game, root, container);
    const display = mountDisplayControls(root, displayPort, active => game.events.emit('fullscreen-change', active));
    const toggleFullscreen = (): void => { void displayPort.toggleFullscreen(); };
    game.events.on('toggle-fullscreen', toggleFullscreen);
    const runStatus = mountRunStatus(root, createRunStatusPort(game));
    const gameOverResults = root.querySelector<HTMLElement>('#game-over-results');
    const gameOverScoreRows = gameOverResults ? Array.from(gameOverResults.querySelectorAll<HTMLElement>('dl > div')) : [];
    const gameOverResultsTitle = root.querySelector<HTMLElement>('#game-over-results-title');
    const gameOverSurvivalTimeLabel = root.querySelector<HTMLElement>('#game-over-survival-time-label');
    const gameOverSurvivalTime = root.querySelector<HTMLElement>('#game-over-survival-time');
    const gameOverFinalCashLabel = root.querySelector<HTMLElement>('#game-over-final-cash-label');
    const gameOverFinalCash = root.querySelector<HTMLElement>('#game-over-final-cash');
    const gameOverCargoValueLabel = root.querySelector<HTMLElement>('#game-over-cargo-value-label');
    const gameOverCargoValue = root.querySelector<HTMLElement>('#game-over-cargo-value');
    const gameOverShipUpgradeSpendLabel = root.querySelector<HTMLElement>('#game-over-ship-upgrade-spend-label');
    const gameOverShipUpgradeSpend = root.querySelector<HTMLElement>('#game-over-ship-upgrade-spend');
    const gameOverFacilityUpgradeSpendLabel = root.querySelector<HTMLElement>('#game-over-facility-upgrade-spend-label');
    const gameOverFacilityUpgradeSpend = root.querySelector<HTMLElement>('#game-over-facility-upgrade-spend');
    const gameOverFinalScoreLabel = root.querySelector<HTMLElement>('#game-over-final-score-label');
    const gameOverFinalScore = root.querySelector<HTMLElement>('#game-over-final-score');
    const gameOverPersonalBest = root.querySelector<HTMLButtonElement>('#game-over-personal-best');
    const gameOverGlobalScores = root.querySelector<HTMLButtonElement>('#game-over-global-scores');
    const gameOverMainMenu = root.querySelector<HTMLButtonElement>('#game-over-main-menu');
    const gameOverActionButtons: HTMLButtonElement[] = [gameOverPersonalBest, gameOverGlobalScores, gameOverMainMenu].filter((button): button is HTMLButtonElement => button !== null);
    const gameOverStatus = root.querySelector<HTMLElement>('#game-over-status');
    const gameOverMessage = root.querySelector<HTMLElement>('#game-over-status-message');
    const gameOverRetry = root.querySelector<HTMLButtonElement>('#game-over-status-retry');
    const stateProvider = game.registry.get('gameStateProvider') as GameStateProvider;
    if (!gameOverResults || !gameOverResultsTitle || !gameOverSurvivalTimeLabel || !gameOverSurvivalTime || !gameOverFinalCashLabel || !gameOverFinalCash || !gameOverCargoValueLabel || !gameOverCargoValue || !gameOverShipUpgradeSpendLabel || !gameOverShipUpgradeSpend || !gameOverFacilityUpgradeSpendLabel || !gameOverFacilityUpgradeSpend || !gameOverFinalScoreLabel || !gameOverFinalScore || !gameOverPersonalBest || !gameOverGlobalScores || !gameOverMainMenu || !gameOverStatus || !gameOverMessage || !gameOverRetry || gameOverScoreRows.length === 0) throw new Error('Missing game-over status controls.');
    gameOverMainMenu.textContent = displayLabels.gameOverMainMenu;
    const gameOverRevealTimers: number[] = [];
    let gameOverRevealGeneration = 0;
    const clearGameOverRevealTimers = (): number => {
        gameOverRevealGeneration += 1;
        for (const timer of gameOverRevealTimers) window.clearTimeout(timer);
        gameOverRevealTimers.length = 0;
        return gameOverRevealGeneration;
    };
    const renderGameOverPersistence = (result: { status: 'pending' | 'saved' | 'failed' | 'unsigned'; message: string | null } | null): void => {
        gameOverStatus.hidden = result === null;
        if (!result) return;
        const message = result.status === 'pending' ? resultLabels.saving : result.status === 'saved' ? resultLabels.saved : result.status === 'unsigned' ? resultLabels.unsigned : result.message ?? resultLabels.failed;
        gameOverMessage.textContent = message;
        gameOverRetry.hidden = result.status !== 'failed';
        gameOverRetry.textContent = resultLabels.retry;
    };
    const retryGameOverPersistence = (): void => { game.events.emit('game-over-retry'); };
    const returnToMainMenuFromGameOver = (): void => { game.events.emit('game-over-main-menu'); };
    const showGameOverResults = (terminalResult: TerminalScoreResult): void => {
        gameOverResultsTitle.textContent = resultLabels.title;
        gameOverSurvivalTimeLabel.textContent = resultLabels.survived;
        gameOverSurvivalTime.textContent = `${(terminalResult.activeElapsedMs / 1000).toFixed(1)} seconds`;
        gameOverFinalCashLabel.textContent = resultLabels.finalCash;
        gameOverFinalCash.textContent = formatCredits(terminalResult.finalCredits);
        gameOverCargoValueLabel.textContent = resultLabels.cargoValue;
        gameOverCargoValue.textContent = formatCredits(terminalResult.cargoValue);
        gameOverShipUpgradeSpendLabel.textContent = resultLabels.shipUpgradeSpend;
        gameOverShipUpgradeSpend.textContent = formatCredits(terminalResult.shipUpgradeSpend);
        gameOverFacilityUpgradeSpendLabel.textContent = resultLabels.facilityUpgradeSpend;
        gameOverFacilityUpgradeSpend.textContent = formatCredits(terminalResult.facilityUpgradeSpend);
        gameOverFinalScoreLabel.textContent = resultLabels.finalScore;
        gameOverFinalScore.textContent = formatCredits(terminalResult.finalScore);
        const revealGeneration = clearGameOverRevealTimers();
        gameOverResults.hidden = true;
        for (const row of gameOverScoreRows) row.hidden = true;
        for (const button of gameOverActionButtons) button.hidden = true;
        gameOverScoreRows.forEach((row, index) => {
            gameOverRevealTimers.push(window.setTimeout(() => {
                if (revealGeneration !== gameOverRevealGeneration) return;
                if (index === 0) gameOverResults.hidden = false;
                row.hidden = false;
            }, 1000 + index * 250));
        });
        gameOverRevealTimers.push(window.setTimeout(() => {
            if (revealGeneration !== gameOverRevealGeneration) return;
            for (const button of gameOverActionButtons) button.hidden = false;
        }, 1000 + gameOverScoreRows.length * 250));
    };
    const hideGameOverResults = (): void => {
        clearGameOverRevealTimers();
        gameOverResults.hidden = true;
        for (const row of gameOverScoreRows) row.hidden = true;
        for (const button of gameOverActionButtons) button.hidden = true;
    };
    gameOverRetry.addEventListener('click', retryGameOverPersistence);
    gameOverMainMenu.addEventListener('click', returnToMainMenuFromGameOver);
    game.events.on('game-over-persistence', renderGameOverPersistence);
    game.registry.set('telemetry', telemetry);
    const landingStatus = mountLandingStatus(root, createLandingStatusPort(game));
    const cargoTransfer = mountCargoTransfer(root, createCargoTransferPort(game));
    const performanceReadout = mountPerformanceReadout(root, createPerformanceReadoutPort(game));
    let currentGameOverResult: TerminalScoreResult | null = null;
    const playerAccount = mountPlayerAccount(root, {
        auth,
        profilePort: auth.createPlayerProfilePort?.() ?? null,
        generateDefaultNickname: generateDefaultPlayerNickname,
        prepareSignIn: origin => {
            const snapshot = origin === 'main-menu' ? null : stateProvider.snapshot();
            const terminalResult = currentGameOverResult ?? (snapshot?.terminalResult ? createTerminalScoreResult(snapshot) : null);
            const saved = authReturn?.save({ snapshot, telemetryContext: telemetry.getSessionContext(), origin, terminalResult }) ?? false;
            return origin === 'main-menu' || saved;
        },
        onOpenStateChange: open => {
            if (open && currentGameOverResult) gameOverReturn.save(currentGameOverResult);
        },
        clearSignInContext: () => authReturn?.clear()
    });
    const resultHistoryStore = createBrowserResultHistoryStore();
    const personalBest = mountPersonalBest(root, { store: resultHistoryStore, auth, profilePort: auth.createPlayerProfilePort?.() ?? null, openAccount: (origin, returnFocus) => root.dispatchEvent(new CustomEvent('player-account-open', { detail: { origin, returnFocus } })) });
    const globalHighScores = mountGlobalHighScores(root, { store: createBrowserGlobalScoreStore(), history: resultHistoryStore, auth, profilePort: auth.createPlayerProfilePort?.() ?? null });
    const openReturnedAccount = (origin: AccountOrigin): void => { root.dispatchEvent(new CustomEvent<AccountOrigin>('player-account-open', { detail: origin })); };
    const showAuthReturnError = (message: string): void => {
        const returnStatus = root.querySelector<HTMLElement>('#main-menu-return-status');
        if (!returnStatus) return;
        returnStatus.textContent = message;
        returnStatus.hidden = false;
    };
    game.events.on('auth-return-account-open', openReturnedAccount);
    game.events.on('auth-return-error', showAuthReturnError);
    const mainMenu = root.querySelector<HTMLElement>('#main-menu');
    const mainMenuNewGame = root.querySelector<HTMLButtonElement>('#main-menu-new-game');
    const mainMenuSignIn = root.querySelector<HTMLButtonElement>('#main-menu-sign-in-preview');
    const debugMenu = root.querySelector<HTMLElement>('#debug-menu');
    const debugClose = root.querySelector<HTMLButtonElement>('#debug-menu-close');
    const touchControlsToggle = root.querySelector<HTMLButtonElement>('#debug-touch-controls-toggle');
    const mouseMovementToggle = root.querySelector<HTMLButtonElement>('#debug-mouse-movement-toggle');
    const boosterToggle = root.querySelector<HTMLButtonElement>('#debug-booster-toggle');
    const performanceToggle = root.querySelector<HTMLButtonElement>('#debug-performance-toggle');
    const threeSecondsRemaining = root.querySelector<HTMLButtonElement>('#debug-three-seconds-remaining');
    const addCash = root.querySelector<HTMLButtonElement>('#debug-add-cash');
    const teleportSeroton = root.querySelector<HTMLButtonElement>('#debug-teleport-seroton');
    const teleportLactozis = root.querySelector<HTMLButtonElement>('#debug-teleport-lactozis-7c');
    const teleportMasloPrime = root.querySelector<HTMLButtonElement>('#debug-teleport-maslo-prime');
    const teleportAsteroid = root.querySelector<HTMLButtonElement>('#debug-teleport-asteroid');
    const spawnCargo = root.querySelector<HTMLButtonElement>('#debug-spawn-cargo');
    const upgradeCargoLevel = root.querySelector<HTMLButtonElement>('#debug-upgrade-cargo');
    const upgradeEngineLevel = root.querySelector<HTMLButtonElement>('#debug-upgrade-engine');
    const upgradeWeaponaryLevel = root.querySelector<HTMLButtonElement>('#debug-upgrade-weaponary');
    if (!mainMenu || !mainMenuNewGame || !mainMenuSignIn || !debugMenu || !debugClose || !touchControlsToggle || !mouseMovementToggle || !boosterToggle || !performanceToggle || !threeSecondsRemaining || !addCash || !teleportSeroton || !teleportLactozis || !teleportMasloPrime || !teleportAsteroid || !spawnCargo || !upgradeCargoLevel || !upgradeEngineLevel || !upgradeWeaponaryLevel) throw new Error('Missing game menu controls.');
    const upgradeButtons: Readonly<Record<ShipServiceId, HTMLButtonElement>> = {
        cargo: upgradeCargoLevel,
        engine: upgradeEngineLevel,
        weaponary: upgradeWeaponaryLevel
    };
    const upgradeLabels: Readonly<Record<ShipServiceId, string>> = {
        cargo: displayLabels.debugCargoLevel,
        engine: displayLabels.debugEngineLevel,
        weaponary: displayLabels.debugWeaponaryLevel
    };
    const renderDebugShipServices = (): void => {
        const state = stateProvider.snapshot();
        for (const definition of shipServiceDefinitions) {
            upgradeButtons[definition.id].textContent =
                `${upgradeLabels[definition.id]}: ${shipServiceLevelOf(state, definition.id)} / ${definition.maximumLevel}`;
        }
    };
    const upgradeShipService = (serviceId: ShipServiceId): void => {
        if (terminalDeathTransitionActive) return;
        game.events.emit('debug-upgrade-ship-service', serviceId);
        renderDebugShipServices();
    };
    const upgradeCargo = (): void => upgradeShipService('cargo');
    const upgradeEngine = (): void => upgradeShipService('engine');
    const upgradeWeaponary = (): void => upgradeShipService('weaponary');
    const showMainMenu = (): void => { mainMenu.hidden = false; };
    const hideMainMenu = (): void => { mainMenu.hidden = true; };
    const showGameOverSignIn = (terminalResult: TerminalScoreResult): void => { currentGameOverResult = terminalResult; showGameOverResults(terminalResult); root.append(mainMenuSignIn); };
    const hideGameOverSignIn = (): void => { currentGameOverResult = null; hideGameOverResults(); mainMenu.prepend(mainMenuSignIn); };
    const startNewGame = (): void => { game.events.emit('start-new-game'); };
    const gameIntro = mountGameIntro(root, { startGame: startNewGame });
    game.events.on('main-menu-open', showMainMenu);
    game.events.on('main-menu-close', hideMainMenu);
    game.events.on('game-over-open', showGameOverSignIn);
    game.events.on('game-over-close', hideGameOverSignIn);
    const updateOrientationPause = (): void => controlsPort.setOrientationPaused(displayPort.getSnapshot().mobile && displayPort.getSnapshot().portrait);
    const unsubscribeOrientation = displayPort.subscribe(updateOrientationPause);
    let touchControlsEnabled = false;
    let mouseMovementEnabled = true;
    let boosterEnabled = false;
    let performanceMonitorEnabled = false;
    let terminalDeathTransitionActive = false;
    const renderDebugToggles = (): void => {
        touchControlsToggle.textContent = `Show touch screen controls: ${touchControlsEnabled ? 'ON' : 'OFF'}`;
        touchControlsToggle.setAttribute('aria-pressed', String(touchControlsEnabled));
        mouseMovementToggle.textContent = `Mouse movement: ${mouseMovementEnabled ? 'ON' : 'OFF'}`;
        mouseMovementToggle.setAttribute('aria-pressed', String(mouseMovementEnabled));
        boosterToggle.textContent = `Booster enable: ${boosterEnabled ? 'ON' : 'OFF'}`;
        boosterToggle.setAttribute('aria-pressed', String(boosterEnabled));
        performanceToggle.textContent = `${displayLabels.debugPerformanceMonitor}: ${performanceMonitorEnabled ? 'ON' : 'OFF'}`;
        performanceToggle.setAttribute('aria-pressed', String(performanceMonitorEnabled));
        renderDebugShipServices();
    };
    const closeDebugMenu = (): void => { debugMenu.hidden = true; game.canvas.focus(); };
    threeSecondsRemaining.textContent = displayLabels.debugThreeSecondsRemaining;
    addCash.textContent = displayLabels.debugAddCash;
    const grantDebugCash = (): void => {
        if (terminalDeathTransitionActive) return;
        game.events.emit('debug-add-cash');
        closeDebugMenu();
    };
    const reduceTimeToThreeSeconds = (): void => {
        if (terminalDeathTransitionActive) return;
        stateProvider.update(state => ({ ...state, clock: setGameClockToThreeSecondsRemaining(state.clock) }));
        closeDebugMenu();
    };
    const openDebugMenu = (): void => { if (!terminalDeathTransitionActive) { debugMenu.hidden = false; renderDebugToggles(); debugClose.focus(); } };
    const toggleTouchControls = (): void => { if (!terminalDeathTransitionActive) { touchControlsEnabled = !touchControlsEnabled; game.events.emit('debug-touch-controls', touchControlsEnabled); renderDebugToggles(); } };
    const toggleMouseMovement = (): void => { if (!terminalDeathTransitionActive) { mouseMovementEnabled = !mouseMovementEnabled; game.events.emit('debug-mouse-movement', mouseMovementEnabled); renderDebugToggles(); } };
    const toggleBooster = (): void => { if (!terminalDeathTransitionActive) { boosterEnabled = !boosterEnabled; game.events.emit('debug-booster', boosterEnabled); renderDebugToggles(); } };
    const togglePerformanceMonitor = (): void => { if (!terminalDeathTransitionActive) { performanceMonitorEnabled = !performanceMonitorEnabled; game.events.emit('debug-performance-monitor', performanceMonitorEnabled); renderDebugToggles(); } };
    const teleportTo = (planetId: string): void => { if (!terminalDeathTransitionActive) { game.events.emit('debug-teleport-to-planet', planetId); closeDebugMenu(); } };
    const teleportToSeroton = (): void => { teleportTo('seroton'); };
    const teleportToLactozis = (): void => { teleportTo('lactozis-7c'); };
    const teleportToMasloPrime = (): void => { teleportTo('maslo-prime'); };
    const teleportToAsteroid = (): void => { if (!terminalDeathTransitionActive) { game.events.emit('debug-teleport-to-asteroid'); closeDebugMenu(); } };
    teleportAsteroid.textContent = displayLabels.teleportToAsteroid;
    const destroyDebugCargoControl = bindDebugCargoControl(spawnCargo, game.events, displayLabels.spawnDebugCargo, () => !terminalDeathTransitionActive, closeDebugMenu);
    const resetDebugControls = (): void => {
        touchControlsEnabled = false;
        mouseMovementEnabled = true;
        boosterEnabled = false;
        performanceMonitorEnabled = false;
        debugMenu.hidden = true;
        renderDebugToggles();
    };
    const debugKeyDown = (event: KeyboardEvent): void => {
        if (event.key.toLowerCase() !== 'd' || event.repeat || event.target instanceof Element && event.target.closest('[data-game-input="ignore"]')) return;
        if (debugMenu.hidden) openDebugMenu();
        else closeDebugMenu();
    };
    debugClose.addEventListener('click', closeDebugMenu);
    touchControlsToggle.addEventListener('click', toggleTouchControls);
    mouseMovementToggle.addEventListener('click', toggleMouseMovement);
    boosterToggle.addEventListener('click', toggleBooster);
    performanceToggle.addEventListener('click', togglePerformanceMonitor);
    threeSecondsRemaining.addEventListener('click', reduceTimeToThreeSeconds);
    addCash.addEventListener('click', grantDebugCash);
    teleportSeroton.addEventListener('click', teleportToSeroton);
    teleportLactozis.addEventListener('click', teleportToLactozis);
    teleportMasloPrime.addEventListener('click', teleportToMasloPrime);
    teleportAsteroid.addEventListener('click', teleportToAsteroid);
    upgradeCargoLevel.addEventListener('click', upgradeCargo);
    upgradeEngineLevel.addEventListener('click', upgradeEngine);
    upgradeWeaponaryLevel.addEventListener('click', upgradeWeaponary);
    game.events.on('debug-controls-reset', resetDebugControls);
    const setTerminalDeathTransition = (active: boolean): void => { terminalDeathTransitionActive = active; if (active) closeDebugMenu(); };
    game.events.on('terminal-death-transition', setTerminalDeathTransition);
    window.addEventListener('keydown', debugKeyDown);
    const returnToGame = (): void => {
        const focused = document.activeElement;
        if (focused instanceof HTMLElement && focused.closest('[data-game-input="ignore"]')) focused.blur();
    };
    game.canvas.addEventListener('pointerdown', returnToGame);
    let destroyed = false;
    const handle: UiHandle = {
        destroy: () => {
            if (destroyed) return;
            destroyed = true;
            audio.destroy();
            menuControls.destroy();
            display.destroy();
            runStatus.destroy();
            gameOverRetry.removeEventListener('click', retryGameOverPersistence);
            gameOverMainMenu.removeEventListener('click', returnToMainMenuFromGameOver);
            game.events.off('game-over-persistence', renderGameOverPersistence);
            landingStatus.destroy();
            cargoTransfer.destroy();
            performanceReadout.destroy();
            playerAccount.destroy();
            personalBest.destroy();
            globalHighScores.destroy();
            gameIntro.destroy();
            auth.destroy();
            telemetry.destroy();
            unsubscribeOrientation();
            game.events.off('main-menu-open', showMainMenu);
            game.events.off('main-menu-close', hideMainMenu);
            game.events.off('game-over-open', showGameOverSignIn);
            game.events.off('game-over-close', hideGameOverSignIn);
            game.events.off('auth-return-account-open', openReturnedAccount);
            game.events.off('auth-return-error', showAuthReturnError);
            hideGameOverSignIn();
            debugClose.removeEventListener('click', closeDebugMenu);
            touchControlsToggle.removeEventListener('click', toggleTouchControls);
            mouseMovementToggle.removeEventListener('click', toggleMouseMovement);
            boosterToggle.removeEventListener('click', toggleBooster);
            performanceToggle.removeEventListener('click', togglePerformanceMonitor);
            threeSecondsRemaining.removeEventListener('click', reduceTimeToThreeSeconds);
            addCash.removeEventListener('click', grantDebugCash);
            teleportSeroton.removeEventListener('click', teleportToSeroton);
            teleportLactozis.removeEventListener('click', teleportToLactozis);
            teleportMasloPrime.removeEventListener('click', teleportToMasloPrime);
            teleportAsteroid.removeEventListener('click', teleportToAsteroid);
            upgradeCargoLevel.removeEventListener('click', upgradeCargo);
            upgradeEngineLevel.removeEventListener('click', upgradeEngine);
            upgradeWeaponaryLevel.removeEventListener('click', upgradeWeaponary);
            destroyDebugCargoControl();
            game.events.off('debug-controls-reset', resetDebugControls);
            game.events.off('terminal-death-transition', setTerminalDeathTransition);
            game.events.off('toggle-fullscreen', toggleFullscreen);
            window.removeEventListener('keydown', debugKeyDown);
            game.canvas.removeEventListener('pointerdown', returnToGame);
            game.events.off('destroy', handle.destroy);
        }
    };
    game.events.once('destroy', handle.destroy);
    return handle;
}
