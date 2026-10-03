import { Scene, GameObjects, Math as PhaserMath } from 'phaser';
import type { GameStateProvider } from '../application/gameStateProvider';
import { createInitialGameState } from '../definitions/initialGameState';
import type { TelemetryPort } from '../application/telemetry/telemetry';
import { mainMenuBackgroundTransform } from './mainMenuBackground';

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
            const initialGameState = createInitialGameState({ runId: crypto.randomUUID(), randomSeed: seedBytes[0] });
            stateProvider.reset(initialGameState);
            (this.registry.get('telemetry') as TelemetryPort).startSession(initialGameState.credits);
            this.scene.start('Game');
        };
        this.game.events.on('start-new-game', startGame);
        this.game.events.emit('main-menu-open');
        this.events.once('shutdown', () => {
            this.game.events.off('start-new-game', startGame);
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
