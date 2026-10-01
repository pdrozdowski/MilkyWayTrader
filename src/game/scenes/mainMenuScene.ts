import { Scene, GameObjects, Math as PhaserMath } from 'phaser';
import type { GameStateProvider } from '../application/gameStateProvider';
import { initialGameState } from '../definitions/initialGameState';
import type { TelemetryPort } from '../application/telemetry/telemetry';
import { mainMenuBackgroundTransform } from './mainMenuBackground';

export class MainMenu extends Scene
{
    background: GameObjects.Image;
    private cow: GameObjects.Image;

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

        const startGame = () => {
            const stateProvider = this.registry.get('gameStateProvider') as GameStateProvider;
            stateProvider.reset(initialGameState);
            (this.registry.get('telemetry') as TelemetryPort).startSession(initialGameState.credits);
            this.scene.start('Game');
        };
        this.game.events.on('start-new-game', startGame);
        this.game.events.emit('main-menu-open');
        this.events.once('shutdown', () => {
            this.game.events.off('start-new-game', startGame);
            this.scale.off('resize', this.layoutBackground, this);
            this.game.events.emit('main-menu-close');
        });
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
