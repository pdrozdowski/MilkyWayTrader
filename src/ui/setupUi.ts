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
import type { PlayerProfilePort } from '../game/application/playerProfile';
import type { PlayerEligibilityPort } from '../game/application/auth/playerEligibility';
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
import type { GameStateSnapshot } from '../game/state/gameStateSnapshot.ts';
import { setGameClockToThreeSecondsRemaining } from '../game/mechanics/clock/gameClock';

export function setupApplicationUi (root: HTMLElement, game: Game, auth: AuthPort, telemetry: TelemetryPort, gameOverReturn: GameOverReturnPort, authReturn: AuthReturnPort | undefined, profilePort: PlayerProfilePort | null, eligibility: PlayerEligibilityPort): UiHandle
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
    const runSaveNotice = root.querySelector<HTMLElement>('#run-save-notice');
    const mainMenuRunSaveNotice = root.querySelector<HTMLElement>('#main-menu-run-save-notice');
    const mainMenuSaveContainer = root.querySelector<HTMLElement>('#main-menu');
    if (!runSaveNotice || !mainMenuRunSaveNotice || !mainMenuSaveContainer) throw new Error('Missing run-save notice.');
    let latestRunSaveNotice: { status: string; message: string | null } = { status: 'idle', message: null };
    let mainMenuProfileStatus = '';
    const renderRunSaveNotice = (notice: { status: string; message: string | null }): void => {
        latestRunSaveNotice = notice;
        const text = notice.status === 'saved' ? displayLabels.runSaveSucceeded
            : notice.status === 'temporary-problem' ? displayLabels.runSaveTemporaryProblem
                : notice.status === 'failed' || notice.status === 'conflict' ? displayLabels.runSaveFailed
                    : '';
        runSaveNotice.textContent = text;
        const mainMenuVisible = !mainMenuSaveContainer.hidden;
        runSaveNotice.hidden = text.length === 0 || mainMenuVisible;
        const mainMenuText = mainMenuProfileStatus || text;
        mainMenuRunSaveNotice.textContent = mainMenuText;
        mainMenuRunSaveNotice.hidden = mainMenuText.length === 0 || !mainMenuVisible;
    };
    const renderMainMenuStatus = (status: string): void => {
        mainMenuProfileStatus = status;
        renderRunSaveNotice(latestRunSaveNotice);
    };
    game.events.on('run-save-status', renderRunSaveNotice);
    game.events.on('main-menu-status', renderMainMenuStatus);
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
    const renderTerminalDelivery = (result: { status: 'pending' | 'saved' | 'failed' | 'unsigned'; message: string | null }): void => {
        renderGameOverPersistence(result);
    };
    const retryGameOverPersistence = (): void => { game.events.emit('game-over-retry'); };
    const returnToMainMenuFromGameOver = (): void => { game.events.emit('game-over-main-menu'); };
    const showGameOverResults = (terminalResult: TerminalScoreResult): void => {
        gameOverResultsTitle.textContent = terminalResult.outcome === 'abandonment' ? resultLabels.abandonedTitle : resultLabels.title;
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
    game.events.on('terminal-delivery-status', renderTerminalDelivery);
    game.registry.set('telemetry', telemetry);
    const landingStatus = mountLandingStatus(root, createLandingStatusPort(game));
    const cargoTransfer = mountCargoTransfer(root, createCargoTransferPort(game));
    const performanceReadout = mountPerformanceReadout(root, createPerformanceReadoutPort(game));
    let currentGameOverResult: TerminalScoreResult | null = null;
    const playerAccount = mountPlayerAccount(root, {
        auth,
        profilePort,
        eligibility,
        returnContext: (game.registry.get('authReturnContext') as { origin?: import('../game/application/auth/authReturn').AccountOrigin } | null)?.origin ?? null,
        generateDefaultNickname: generateDefaultPlayerNickname,
        prepareSignIn: origin => {
            const snapshot = origin === 'main-menu' ? null : stateProvider.snapshot();
            const terminalResult = currentGameOverResult ?? (snapshot?.terminalResult ? createTerminalScoreResult(snapshot) : null);
            const currentEligibility = eligibility.getSnapshot();
            const saved = authReturn?.save({ snapshot, telemetryContext: telemetry.getSessionContext(), origin, terminalResult, snapshotOwnerId: currentEligibility.status === 'ready' ? currentEligibility.ownerId : null }) ?? false;
            return origin === 'main-menu' || saved;
        },
        onOpenStateChange: open => {
            if (open && currentGameOverResult) gameOverReturn.save(currentGameOverResult);
        },
        clearSignInContext: () => authReturn?.clear()
    });
    const resultHistoryStore = createBrowserResultHistoryStore();
    const personalBest = mountPersonalBest(root, { store: resultHistoryStore, auth, profilePort, openAccount: (origin, returnFocus) => root.dispatchEvent(new CustomEvent('player-account-open', { detail: { origin, returnFocus } })) });
    const globalHighScores = mountGlobalHighScores(root, { store: createBrowserGlobalScoreStore(), history: resultHistoryStore, auth, profilePort });
    let authCollisionPending = false;
    let authCollisionResolving = false;
    const runSaveDialogError = root.querySelector<HTMLElement>('#run-save-dialog-error');
    if (!runSaveDialogError) throw new Error('Missing run-save dialog error element.');
    const resolveAuthCollision = async (): Promise<void> => {
        if (!authCollisionPending || authCollisionResolving || eligibility.getSnapshot().status !== 'ready') return;
        const activeRunStore = game.registry.get('activeRunStore') as import('../game/application/saves/activeRunStore').ActiveRunStorePort | undefined;
        const reload = game.registry.get('reloadAuthoritativeSave') as (() => Promise<boolean>) | undefined;
        const abandon = game.registry.get('abandonAccountRun') as ((snapshot: GameStateSnapshot, revision: number) => Promise<boolean>) | undefined;
        if (!activeRunStore || !reload || !abandon) return;
        authCollisionResolving = true;
        controlsPort.openMenu();
        try {
            let loaded = await activeRunStore.load();
            if (!authCollisionPending) return;
            if (loaded.status === 'empty' || loaded.status === 'ineligible') {
                const resumeReturnedRun = authCollisionPending && loaded.status === 'empty';
                authCollisionPending = false;
                controlsPort.closeMenu();
                root.dispatchEvent(new CustomEvent('player-account-close'));
                if (resumeReturnedRun && !game.scene.isActive('Game')) game.scene.getScene('MainMenu').scene.start('Game');
                return;
            }
            if (loaded.status === 'terminal-pending') {
                controlsPort.closeMenu();
                routeTerminalPending(loaded.snapshot);
                root.dispatchEvent(new CustomEvent('player-account-close'));
                return;
            }
            if (loaded.status === 'incompatible' && loaded.runId) {
                const discarded = await askRunSavePrompt(displayLabels.runSaveInvalidTitle, displayLabels.runSaveInvalidMessage, displayLabels.runSaveDiscard, async () => {
                    loaded = await activeRunStore.load();
                    if (loaded.status !== 'incompatible' || !loaded.runId) return false;
                    const result = await activeRunStore.discard(loaded.runId, loaded.revision, crypto.randomUUID(), true);
                    if (!result.success) return false;
                    await reload();
                    return true;
                }, displayLabels.runSaveDiscardFailed);
                if (discarded) {
                    authCollisionPending = false;
                    controlsPort.closeMenu();
                    root.dispatchEvent(new CustomEvent('player-account-close'));
                }
                return;
            }
            if (loaded.status === 'unavailable' || loaded.status === 'incompatible') {
                await askRunSavePrompt(displayLabels.runSaveCollisionTitle, loaded.status === 'unavailable' ? loaded.message : displayLabels.runSaveInvalidMessage, displayLabels.runSaveRetry, async () => {
                    loaded = await activeRunStore.load();
                    return loaded.status === 'empty' || loaded.status === 'ineligible';
                }, displayLabels.runSaveCollisionFailed);
                authCollisionPending = false;
                controlsPort.closeMenu();
                root.dispatchEvent(new CustomEvent('player-account-close'));
                return;
            }
            if (loaded.status !== 'active' || loaded.snapshot.runId === stateProvider.snapshot().runId) {
                if (loaded.status === 'active') {
                    authCollisionPending = false;
                    if (await reload()) {
                        const gameScene = game.scene.getScene('Game');
                        gameScene.scene.restart();
                    }
                    root.dispatchEvent(new CustomEvent('player-account-close'));
                }
                controlsPort.closeMenu();
                return;
            }
            const accountSave = loaded;
            const collisionOwnerId = eligibility.getSnapshot().ownerId;
            while (authCollisionPending) {
                const currentEligibility = eligibility.getSnapshot();
                if (currentEligibility.status !== 'ready' || currentEligibility.ownerId !== collisionOwnerId) {
                    authCollisionPending = false;
                    controlsPort.closeMenu();
                    root.dispatchEvent(new CustomEvent('player-account-close'));
                    return;
                }
                const choice = await askRunCollisionChoice();
                if (choice === 'cancel') {
                    authCollisionPending = false;
                    controlsPort.closeMenu();
                    root.dispatchEvent(new CustomEvent('player-account-close'));
                    return;
                }
                if (choice === 'account') {
                    if (await reload()) {
                        authCollisionPending = false;
                        root.dispatchEvent(new CustomEvent('player-account-close'));
                        game.scene.getScene('Game').scene.restart();
                        return;
                    }
                    continue;
                }
                const confirmed = await askRunSavePrompt(displayLabels.runSaveCollisionTitle, displayLabels.runSaveConfirmAccountAbandon, displayLabels.runSaveConfirm, () => abandon(accountSave.snapshot, accountSave.revision), displayLabels.runSaveCollisionFailed);
                if (confirmed) {
                    authCollisionPending = false;
                    controlsPort.closeMenu();
                    root.dispatchEvent(new CustomEvent('player-account-close'));
                    return;
                }
            }
        } catch {
            runSaveDialogError.textContent = displayLabels.runSaveCollisionFailed;
            runSaveDialogError.hidden = false;
        } finally { authCollisionResolving = false; }
    };
    const openReturnedAccount = (origin: AccountOrigin): void => {
        root.dispatchEvent(new CustomEvent<AccountOrigin>('player-account-open', { detail: origin }));
        if (origin === 'game-menu') { authCollisionPending = true; void resolveAuthCollision(); }
    };
    const unsubscribeAuthCollision = eligibility.subscribe(() => { if (authCollisionPending) void resolveAuthCollision(); });
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
    const showMainMenu = (): void => { mainMenu.hidden = false; renderRunSaveNotice(latestRunSaveNotice); if (authCollisionPending) void resolveAuthCollision(); };
    const hideMainMenu = (): void => { mainMenu.hidden = true; renderRunSaveNotice(latestRunSaveNotice); };
    const showGameOverSignIn = (terminalResult: TerminalScoreResult): void => {
        currentGameOverResult = terminalResult;
        showGameOverResults(terminalResult);
        const delivery = game.registry.get('terminalDeliveryStatus') as { status: 'pending' | 'saved' | 'failed' | 'unsigned'; message: string | null } | undefined;
        renderGameOverPersistence(delivery ?? null);
        root.append(mainMenuSignIn);
    };
    const hideGameOverSignIn = (): void => { currentGameOverResult = null; hideGameOverResults(); mainMenu.prepend(mainMenuSignIn); };
    const startNewGame = (): void => { game.events.emit('start-new-game'); };
    const runSaveDialog = root.querySelector<HTMLElement>('#run-save-dialog');
    const runSaveDialogTitle = root.querySelector<HTMLElement>('#run-save-dialog-title');
    const runSaveDialogMessage = root.querySelector<HTMLElement>('#run-save-dialog-message');
    const runSaveDialogCancel = root.querySelector<HTMLButtonElement>('#run-save-dialog-cancel');
    const runSaveDialogSecondary = root.querySelector<HTMLButtonElement>('#run-save-dialog-secondary');
    const runSaveDialogConfirm = root.querySelector<HTMLButtonElement>('#run-save-dialog-confirm');
    const runSaveDialogRetry = root.querySelector<HTMLButtonElement>('#run-save-dialog-retry');
    if (!runSaveDialog || !runSaveDialogTitle || !runSaveDialogMessage || !runSaveDialogError || !runSaveDialogCancel || !runSaveDialogSecondary || !runSaveDialogConfirm || !runSaveDialogRetry) throw new Error('Missing run-save confirmation controls.');
    let finishRunSavePrompt: ((confirmed: boolean) => void) | null = null;
    let promptReturnFocus: HTMLElement | null = null;
    const runSavePromptKeydown = (event: KeyboardEvent): void => {
        if (runSaveDialog.hidden) return;
        if (runSaveDialogConfirm.disabled && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); return; }
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeRunSavePrompt(false); }
        else if (event.key === 'Tab') {
            const available = [runSaveDialogCancel, runSaveDialogSecondary, runSaveDialogRetry, runSaveDialogConfirm].filter(button => !button.hidden && !button.disabled);
            const first = available[0]; const last = available[available.length - 1];
            if (event.shiftKey && (document.activeElement === first || !runSaveDialog.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && (document.activeElement === last || !runSaveDialog.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
        }
    };
    const closeRunSavePrompt = (confirmed: boolean): void => {
        if (!finishRunSavePrompt) return;
        const finish = finishRunSavePrompt;
        finishRunSavePrompt = null;
        runSaveDialog.hidden = true;
        runSaveDialogSecondary.hidden = true;
        window.removeEventListener('keydown', runSavePromptKeydown, true);
        promptReturnFocus?.focus();
        promptReturnFocus = null;
        finish(confirmed);
    };
    const askRunSavePrompt = (title: string, message: string, confirmLabel: string, action: () => Promise<boolean>, errorMessage: string): Promise<boolean> => new Promise(resolve => {
        promptReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        runSaveDialogTitle.textContent = title;
        runSaveDialogMessage.textContent = message;
        runSaveDialogError.textContent = '';
        runSaveDialogError.hidden = true;
        runSaveDialogCancel.textContent = displayLabels.runSaveCancel;
        runSaveDialogConfirm.textContent = confirmLabel;
        runSaveDialogConfirm.hidden = false;
        runSaveDialogConfirm.disabled = false;
        runSaveDialogCancel.disabled = false;
        runSaveDialogSecondary.hidden = true;
        runSaveDialogRetry.textContent = displayLabels.runSaveRetry;
        runSaveDialogRetry.hidden = true;
        finishRunSavePrompt = resolve;
        const confirm = async (): Promise<void> => {
            runSaveDialogConfirm.disabled = true;
            runSaveDialogCancel.disabled = true;
            const success = await action().catch(() => false);
            if (success) closeRunSavePrompt(true);
            else {
                runSaveDialogError.textContent = errorMessage;
                runSaveDialogError.hidden = false;
                runSaveDialogRetry.hidden = false;
                runSaveDialogConfirm.disabled = false;
                runSaveDialogCancel.disabled = false;
            }
        };
        const retry = (): void => { runSaveDialogError.hidden = true; void confirm(); };
        const cancel = (): void => closeRunSavePrompt(false);
        runSaveDialogConfirm.addEventListener('click', confirm);
        runSaveDialogRetry.addEventListener('click', retry);
        runSaveDialogCancel.addEventListener('click', cancel);
        runSaveDialog.hidden = false;
        window.addEventListener('keydown', runSavePromptKeydown, true);
        runSaveDialogConfirm.focus();
        const finish = finishRunSavePrompt;
        finishRunSavePrompt = confirmed => {
            runSaveDialogConfirm.removeEventListener('click', confirm);
            runSaveDialogRetry.removeEventListener('click', retry);
            runSaveDialogCancel.removeEventListener('click', cancel);
            finish?.(confirmed);
        };
    });
    const askRunCollisionChoice = (): Promise<'account' | 'current' | 'cancel'> => new Promise(resolve => {
        promptReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        runSaveDialogTitle.textContent = displayLabels.runSaveCollisionTitle;
        runSaveDialogMessage.textContent = displayLabels.runSaveCollisionMessage;
        runSaveDialogError.hidden = true;
        runSaveDialogCancel.textContent = displayLabels.runSaveCancel;
        runSaveDialogConfirm.textContent = displayLabels.runSaveLoadAccount;
        runSaveDialogConfirm.hidden = false;
        runSaveDialogSecondary.textContent = displayLabels.runSaveKeepCurrent;
        runSaveDialogSecondary.hidden = false;
        runSaveDialogRetry.hidden = true;
        const finish = (choice: 'account' | 'current' | 'cancel'): void => {
            finishRunSavePrompt = null;
            runSaveDialogConfirm.removeEventListener('click', account);
            runSaveDialogSecondary.removeEventListener('click', current);
            runSaveDialogCancel.removeEventListener('click', cancel);
            runSaveDialog.hidden = true;
            runSaveDialogSecondary.hidden = true;
            window.removeEventListener('keydown', runSavePromptKeydown, true);
            promptReturnFocus?.focus();
            promptReturnFocus = null;
            resolve(choice);
        };
        const account = (): void => finish('account');
        const current = (): void => finish('current');
        const cancel = (): void => finish('cancel');
        finishRunSavePrompt = confirmed => finish(confirmed ? 'account' : 'cancel');
        runSaveDialogConfirm.addEventListener('click', account);
        runSaveDialogSecondary.addEventListener('click', current);
        runSaveDialogCancel.addEventListener('click', cancel);
        runSaveDialog.hidden = false;
        window.addEventListener('keydown', runSavePromptKeydown, true);
        runSaveDialogConfirm.focus();
    });
    const routeTerminalPending = (snapshot: GameStateSnapshot): void => {
        const gameScene = game.scene.getScene('Game');
        gameScene.scene.start('GameOver', { terminalResult: createTerminalScoreResult(snapshot) });
    };
    game.events.on('show-terminal-pending', routeTerminalPending);
    const prepareNewGame = async (): Promise<boolean> => {
        const activeRunStore = game.registry.get('activeRunStore') as import('../game/application/saves/activeRunStore').ActiveRunStorePort | undefined;
        const eligibilitySnapshot = eligibility.getSnapshot();
        if (eligibilitySnapshot.status === 'unsigned' || eligibilitySnapshot.anonymous) return true;
        if (!activeRunStore || eligibilitySnapshot.status !== 'ready') return false;
        let loaded = await activeRunStore.load();
        if (loaded.status === 'empty') return true;
        if (loaded.status === 'terminal-pending') {
            game.events.emit('show-terminal-pending', loaded.snapshot);
            return false;
        }
        if (loaded.status === 'active') {
            const activeRunId = loaded.snapshot.runId;
            const abandon = game.registry.get('abandonAccountRun') as ((snapshot: GameStateSnapshot, revision: number, attachCurrent?: boolean) => Promise<boolean>) | undefined;
            const reload = game.registry.get('reloadAuthoritativeSave') as (() => Promise<boolean>) | undefined;
            if (!abandon || !reload) return false;
            return askRunSavePrompt(displayLabels.runSaveNewGameTitle, displayLabels.runSaveNewGameMessage, displayLabels.runSaveConfirm, async () => {
                const current = await activeRunStore.load();
                if (current.status === 'terminal-pending' && current.snapshot.runId === activeRunId && current.snapshot.terminalResult?.outcome === 'abandonment') return abandon(current.snapshot, current.revision, false);
                if (current.status !== 'active' || current.snapshot.runId !== activeRunId || !await reload()) return false;
                const refreshed = await activeRunStore.load();
                return refreshed.status === 'active' && refreshed.snapshot.runId === activeRunId
                    ? abandon(refreshed.snapshot, refreshed.revision, false)
                    : false;
            }, displayLabels.runSaveAbandonFailed);
        }
        if (loaded.status === 'incompatible' && loaded.runId) {
            const discard = async (): Promise<boolean> => {
                loaded = await activeRunStore.load();
                if (loaded.status !== 'incompatible' || !loaded.runId) return false;
                const result = await activeRunStore.discard(loaded.runId, loaded.revision, crypto.randomUUID(), true);
                if (!result.success) return false;
                const reload = game.registry.get('reloadAuthoritativeSave') as (() => Promise<boolean>) | undefined;
                if (reload) await reload();
                return true;
            };
            return askRunSavePrompt(displayLabels.runSaveInvalidTitle, displayLabels.runSaveInvalidMessage, displayLabels.runSaveDiscard, discard, displayLabels.runSaveDiscardFailed);
        }
        if (loaded.status === 'unavailable' || loaded.status === 'incompatible') {
            return askRunSavePrompt(displayLabels.runSaveInvalidTitle, loaded.status === 'unavailable' ? loaded.message : displayLabels.runSaveInvalidMessage, displayLabels.runSaveRetry, async () => {
                loaded = await activeRunStore.load();
                return loaded.status === 'empty' || loaded.status === 'ineligible';
            }, displayLabels.runSaveLoadFailed);
        }
        return false;
    };
    const gameIntro = mountGameIntro(root, { startGame: startNewGame, prepareNewGame });
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
            if (finishRunSavePrompt) closeRunSavePrompt(false);
            audio.destroy();
            menuControls.destroy();
            display.destroy();
            runStatus.destroy();
            game.events.off('run-save-status', renderRunSaveNotice);
            game.events.off('main-menu-status', renderMainMenuStatus);
            gameOverRetry.removeEventListener('click', retryGameOverPersistence);
            gameOverMainMenu.removeEventListener('click', returnToMainMenuFromGameOver);
            game.events.off('game-over-persistence', renderGameOverPersistence);
            game.events.off('terminal-delivery-status', renderTerminalDelivery);
            game.events.off('show-terminal-pending', routeTerminalPending);
            landingStatus.destroy();
            cargoTransfer.destroy();
            performanceReadout.destroy();
            playerAccount.destroy();
            eligibility.destroy();
            personalBest.destroy();
            globalHighScores.destroy();
            gameIntro.destroy();
            auth.destroy();
            telemetry.destroy();
            unsubscribeOrientation();
            unsubscribeAuthCollision();
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
