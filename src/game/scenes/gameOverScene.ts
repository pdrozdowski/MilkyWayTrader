import { Scene, Math as PhaserMath } from 'phaser';
import type { ResultStorePort } from '../application/results/resultStore';
import { createResultDelivery } from '../application/results/resultDelivery';
import type { TerminalScoreResult } from '../application/results/terminalScoreResult';
import { mainMenuBackgroundTransform } from './mainMenuBackground';

export class GameOver extends Scene
{
    camera: Phaser.Cameras.Scene2D.Camera;
    background: Phaser.GameObjects.Image;
    private asteroids: Phaser.GameObjects.Image[] = [];

    constructor ()
    {
        super('GameOver');
    }

    create (data: { terminalResult?: TerminalScoreResult })
    {
        const terminalResult = data.terminalResult;
        if (!terminalResult) throw new Error('GameOver requires a terminal result.');
        this.camera = this.cameras.main;
        this.camera.setBackgroundColor(0x000000);

        this.background = this.add.image(0, 0, 'game-over:destroyed-ship');
        this.layoutBackground();
        this.scale.on('resize', this.layoutBackground, this);
        this.asteroids = [this.createAsteroid(), this.createAsteroid()];
        this.flyAsteroid(this.asteroids[0], true);
        this.flyAsteroid(this.asteroids[1], false);
        this.game.events.emit('game-over-open', terminalResult);
        const store = this.registry.get('resultStore') as ResultStorePort | undefined;
        const delivery = createResultDelivery(store, terminalResult, result => {
            if (this.sys.isActive()) this.game.events.emit('game-over-persistence', result);
        });
        const retryPersistence = (): void => { delivery.retry(); };
        this.game.events.on('game-over-retry', retryPersistence);
        this.events.once('shutdown', () => {
            this.game.events.off('game-over-retry', retryPersistence);
            this.scale.off('resize', this.layoutBackground, this);
            this.asteroids = [];
            this.game.events.emit('game-over-persistence', null);
            this.game.events.emit('game-over-close');
        });
        delivery.start();
        this.input.on('pointerdown', (_pointer: Phaser.Input.Pointer, _x: number, _y: number) => {
            this.scene.start('MainMenu');
        });
    }

    private readonly layoutBackground = (): void =>
    {
        const transform = mainMenuBackgroundTransform(this.scale, this.background.height);
        this.background.setPosition(transform.x, transform.y).setScale(transform.scale);
    };

    private createAsteroid (): Phaser.GameObjects.Image
    {
        return this.add.image(0, 0, 'asteroid:rock').setDepth(1);
    }

    private flyAsteroid (asteroid: Phaser.GameObjects.Image, upwards: boolean): void
    {
        const { width, height } = this.scale;
        const baseAngle = upwards ? 0 : 180;
        const variant = ['rock', 'ice', 'metal', 'dirt'][PhaserMath.Between(0, 3)];
        asteroid.setTexture(`asteroid:${variant}`)
            .setScale(0.16 * PhaserMath.FloatBetween(0.8, 1.4))
            .setAngle(baseAngle + PhaserMath.FloatBetween(-12, 12));
        const padding = Math.hypot(asteroid.displayWidth, asteroid.displayHeight) / 2 + 2;
        const xMargin = Math.min(padding, width / 2);
        const randomX = (): number => PhaserMath.FloatBetween(xMargin, width - xMargin);

        asteroid.setPosition(randomX(), upwards ? height + padding : -padding).setVisible(true);
        this.tweens.add({
            targets: asteroid,
            x: randomX(),
            y: upwards ? -padding : height + padding,
            angle: baseAngle + PhaserMath.FloatBetween(-12, 12),
            duration: PhaserMath.Between(7000, 11000),
            ease: 'Linear',
            onComplete: () => {
                asteroid.setVisible(false);
                this.time.delayedCall(PhaserMath.Between(1000, 3000), () => this.flyAsteroid(asteroid, !upwards));
            }
        });
    }
}
