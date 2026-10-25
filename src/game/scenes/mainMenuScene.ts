import { Scene, GameObjects, Math as PhaserMath } from 'phaser';
import type { GameStateProvider } from '../application/gameStateProvider';
import { createInitialGameState } from '../definitions/initialGameState';
import type { TelemetryPort } from '../application/telemetry/telemetry';
import { mainMenuBackgroundTransform } from './mainMenuBackground';
import type { ActiveRunStorePort } from '../application/saves/activeRunStore.ts';
import type { PlayerEligibilityPort } from '../application/auth/playerEligibility.ts';
import { mainMenuSaveLabels } from './mainMenuLabels';
import { createTerminalScoreResult } from '../application/results/terminalScoreResult.ts';
import type { GameStateSnapshot } from '../state/gameStateSnapshot';

const testGameStateStorageKey = 'milky-way-trader:playwright-game-state';

export class MainMenu extends Scene
{
    background: GameObjects.Image;
    private cow: GameObjects.Image;
    private fullscreenControl?: HTMLButtonElement;
    private destroyFullscreenControlListeners?: () => void;

    constructor ()
    {
        super('MainMenu');
    }

    create ()
    {
        this.cameras.main.setBackgroundColor('#000000');
        this.background = this.add.image(0, 0, 'background').setDepth(0);
        this.layoutBackground();
        this.scale.on('resize', this.layoutBackground, this);

        this.cow = this.add.image(0, 0, 'cow').setDepth(1).setVisible(false);

        this.flyCow(true);
        this.createFullscreenControl();

        const startGame = () => {
            const stateProvider = this.registry.get('gameStateProvider') as GameStateProvider;
            const seedBytes = new Uint32Array(1);
            crypto.getRandomValues(seedBytes);
            let initialGameState = createInitialGameState({ runId: crypto.randomUUID(), randomSeed: seedBytes[0] });
            if (import.meta.env.MODE === 'test') {
                const fixture = localStorage.getItem(testGameStateStorageKey);
                if (fixture !== null) {
                    localStorage.removeItem(testGameStateStorageKey);
                    try {
                        const candidate = JSON.parse(fixture) as Partial<GameStateSnapshot>;
                        initialGameState = {
                            ...initialGameState,
                            ...(typeof candidate.runId === 'string' ? { runId: candidate.runId } : {}),
                            ...(typeof candidate.credits === 'number' ? { credits: candidate.credits } : {}),
                            ...(Array.isArray(candidate.cargo) ? { cargo: candidate.cargo } : {}),
                            ...(candidate.clock && typeof candidate.clock === 'object' ? { clock: candidate.clock } : {}),
                            ...(Array.isArray(candidate.markets) ? { markets: candidate.markets } : {}),
                            ...(candidate.ship && typeof candidate.ship === 'object' ? { ship: { ...initialGameState.ship, ...candidate.ship } } : {}),
                            ...(candidate.planetLifecycle && typeof candidate.planetLifecycle === 'object' ? { planetLifecycle: candidate.planetLifecycle } : {})
                        };
                    } catch {
                        throw new Error('Invalid Playwright game-state fixture.');
                    }
                }
            }
            stateProvider.reset(initialGameState);
            (this.registry.get('telemetry') as TelemetryPort).startSession(initialGameState.credits);
            this.scene.start('Game');
        };
        const continueGame = () => {
            const reload = this.registry.get('reloadAuthoritativeSave') as (() => Promise<boolean>) | undefined;
            if (!reload) return;
            const control = document.querySelector<HTMLButtonElement>('#main-menu-continue');
            if (control) control.disabled = true;
            void reload().then(async restored => {
                if (restored && this.scene.isActive()) this.scene.start('Game');
                else {
                    if (control) control.disabled = false;
                    const loaded = await activeRunStore?.load();
                    if (loaded?.status === 'terminal-pending') showTerminalPending(loaded.snapshot);
                }
            }).catch(() => {
                if (control) control.disabled = false;
            });
        };
        const continueControl = document.querySelector<HTMLButtonElement>('#main-menu-continue');
        const newGameControl = document.querySelector<HTMLButtonElement>('#main-menu-new-game');
        newGameControl?.setAttribute('aria-label', mainMenuSaveLabels.newGameButton);
        continueControl?.setAttribute('aria-label', mainMenuSaveLabels.continueButton);
        const activeRunStore = this.registry.get('activeRunStore') as ActiveRunStorePort | undefined;
        const eligibility = this.registry.get('playerEligibility') as PlayerEligibilityPort | undefined;
        let menuGeneration = 0;
        let terminalRouting = false;
        const publishMainMenuStatus = (text: string): void => { this.game.events.emit('main-menu-status', text); };
        const showTerminalPending = (snapshot: GameStateSnapshot): void => {
            if (terminalRouting || !this.scene.isActive()) return;
            terminalRouting = true;
            this.scene.start('GameOver', { terminalResult: createTerminalScoreResult(snapshot) });
        };
        const refreshContinue = async (): Promise<void> => {
            const generation = ++menuGeneration;
            const eligibilitySnapshot = eligibility?.getSnapshot();
            if (!continueControl || !activeRunStore) {
                if (continueControl) continueControl.disabled = true;
                publishMainMenuStatus('');
                return;
            }
            if (eligibilitySnapshot?.status !== 'ready') {
                continueControl.disabled = true;
                publishMainMenuStatus(eligibilitySnapshot?.status === 'loading' ? mainMenuSaveLabels.checkingAccount
                    : eligibilitySnapshot?.status === 'failed' ? mainMenuSaveLabels.unavailableProfile
                        : mainMenuSaveLabels.continueRequiresProfile);
                return;
            }
            continueControl.disabled = true;
            publishMainMenuStatus(mainMenuSaveLabels.checkingSave);
            const loaded = await activeRunStore.load();
            if (generation !== menuGeneration || !this.scene.isActive()) return;
            if (loaded.status === 'active') {
                continueControl.disabled = false;
                publishMainMenuStatus('');
            } else if (loaded.status === 'terminal-pending') {
                publishMainMenuStatus(mainMenuSaveLabels.pendingResults);
                showTerminalPending(loaded.snapshot);
            } else if (loaded.status === 'incompatible') {
                publishMainMenuStatus(mainMenuSaveLabels.incompatibleSave);
            } else if (loaded.status === 'unavailable' || loaded.status === 'ineligible') {
                publishMainMenuStatus(mainMenuSaveLabels.unavailableSave);
            } else publishMainMenuStatus('');
        };
        void refreshContinue();
        const unsubscribeEligibility = eligibility?.subscribe(() => { void refreshContinue(); });
        continueControl?.addEventListener('click', continueGame);
        this.game.events.on('start-new-game', startGame);
        this.game.events.emit('main-menu-open');
        this.events.once('shutdown', () => {
            this.game.events.off('start-new-game', startGame);
            menuGeneration++;
            unsubscribeEligibility?.();
            continueControl?.removeEventListener('click', continueGame);
            this.scale.off('resize', this.layoutBackground, this);
            this.destroyFullscreenControl();
            this.game.events.emit('main-menu-close');
        });
    }

    private createFullscreenControl (): void
    {
        const mainMenu = document.querySelector<HTMLElement>('#main-menu');
        if (!mainMenu) throw new Error('Missing main menu container.');

        const control = document.createElement('button');
        const icon = document.createElement('span');
        const label = document.createElement('span');
        const updateLabel = (active: boolean): void => {
            label.textContent = `Fullscreen:\n${active ? 'ON' : 'OFF'}`;
            control.setAttribute('aria-pressed', String(active));
        };
        const toggleFullscreen = (): void => { this.game.events.emit('toggle-fullscreen'); };

        control.id = 'main-menu-fullscreen-preview';
        control.type = 'button';
        control.setAttribute('aria-label', 'Toggle fullscreen');
        icon.className = 'main-menu-fullscreen-preview-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = '\u26F6';
        label.className = 'main-menu-fullscreen-preview-label';
        updateLabel(Boolean(document.fullscreenElement));
        control.append(icon, label);
        control.addEventListener('click', toggleFullscreen);
        mainMenu.append(control);
        this.fullscreenControl = control;
        this.destroyFullscreenControlListeners = () => {
            control.removeEventListener('click', toggleFullscreen);
            this.game.events.off('fullscreen-change', updateLabel);
        };
        this.game.events.on('fullscreen-change', updateLabel);
    }

    private destroyFullscreenControl (): void
    {
        this.destroyFullscreenControlListeners?.();
        this.destroyFullscreenControlListeners = undefined;
        this.fullscreenControl?.remove();
        this.fullscreenControl = undefined;
    }

    private readonly layoutBackground = (): void =>
    {
        const transform = mainMenuBackgroundTransform(this.scale, this.background.height);
        this.background.setPosition(transform.x, transform.y).setScale(transform.scale);
    };

    private flyCow (upwards: boolean)
    {
        const { width, height } = this.scale;
        const baseAngle = upwards ? 0 : 180;

        this.cow.setScale(0.25 * PhaserMath.FloatBetween(0.75, 1.25));

        // Half the diagonal keeps the whole cow offscreen at any rotation.
        const padding = Math.hypot(this.cow.displayWidth, this.cow.displayHeight) / 2 + 2;
        const xMargin = Math.min(padding, width / 2);
        const randomX = () => PhaserMath.FloatBetween(xMargin, width - xMargin);

        this.cow
            .setPosition(randomX(), upwards ? height + padding : -padding)
            .setAngle(baseAngle + PhaserMath.FloatBetween(-12, 12))
            .setVisible(true);

        this.tweens.add({
            targets: this.cow,
            x: randomX(),
            y: upwards ? -padding : height + padding,
            angle: baseAngle + PhaserMath.FloatBetween(-12, 12),
            duration: PhaserMath.Between(5000, 7000),
            ease: 'Linear',
            onComplete: () => {
                this.cow.setVisible(false);
                this.time.delayedCall(PhaserMath.Between(2000, 4000), () => {
                    this.flyCow(!upwards);
                });
            }
        });
    }
}
