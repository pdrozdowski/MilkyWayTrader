import { Scene, GameObjects, Input, Math as PhaserMath } from 'phaser';
import type { GameStateProvider } from '../application/gameStateProvider';
import { initialGameState } from '../definitions/initialGameState';

export class MainMenu extends Scene
{
    background: GameObjects.Image;
    logo: GameObjects.Image;
    title: GameObjects.Text;
    private cow: GameObjects.Image;
    private fullscreenMode: GameObjects.Text;

    constructor ()
    {
        super('MainMenu');
    }

    create ()
    {
        this.background = this.add.image(512, 384, 'background').setDepth(0);

        this.cow = this.add.image(0, 0, 'cow').setDepth(1).setVisible(false);

        this.logo = this.add.image(512, 350, 'logo').setDepth(2);

        this.title = this.add.text(512, 460, 'New Game', {
            fontFamily: 'Arial Black', fontSize: 38, color: '#ffffff',
            stroke: '#000000', strokeThickness: 8,
            align: 'center'
        }).setOrigin(0.5).setDepth(2);
        this.add.text(512, 520, 'Continue Game', {
            fontFamily: 'Arial Black', fontSize: 38, color: '#777777',
            stroke: '#000000', strokeThickness: 8,
            align: 'center'
        }).setOrigin(0.5).setDepth(2);
        this.fullscreenMode = this.add.text(512, 580, '', {
            fontFamily: 'Arial Black', fontSize: 38, color: '#ffffff',
            stroke: '#000000', strokeThickness: 8,
            align: 'center'
        }).setOrigin(0.5).setDepth(2).setInteractive({ useHandCursor: true });
        this.updateFullscreenMode(Boolean(document.fullscreenElement));
        this.fullscreenMode.on('pointerdown', (_pointer: Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
            event.stopPropagation();
            this.game.events.emit('toggle-fullscreen');
        });
        this.game.events.on('fullscreen-change', this.updateFullscreenMode, this);
        this.events.once('shutdown', () => this.game.events.off('fullscreen-change', this.updateFullscreenMode, this));

        this.flyCow(true);

        const startGame = () => {
            const stateProvider = this.registry.get('gameStateProvider') as GameStateProvider;
            stateProvider.reset(initialGameState);
            this.scene.start('Game');
        };
        this.input.once('pointerdown', startGame);
        this.input.once('pointerup', startGame);
    }

    private updateFullscreenMode (active: boolean): void
    {
        this.fullscreenMode.setText(`Fullscreen Mode: ${active ? 'ON' : 'OFF'}`);
    }

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
