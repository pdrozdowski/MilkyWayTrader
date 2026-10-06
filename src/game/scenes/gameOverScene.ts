import { Scene } from 'phaser';
import type { ResultStorePort } from '../application/results/resultStore';
import { createResultDelivery } from '../application/results/resultDelivery';
import type { TerminalResultState } from '../state/terminalResultState';
import { mainMenuBackgroundTransform } from './mainMenuBackground';

export class GameOver extends Scene
{
    camera: Phaser.Cameras.Scene2D.Camera;
    background: Phaser.GameObjects.Image;

    constructor ()
    {
        super('GameOver');
    }

    create (data: { terminalResult?: TerminalResultState })
    {
        const terminalResult = data.terminalResult;
        if (!terminalResult) throw new Error('GameOver requires a terminal result.');
        this.camera = this.cameras.main;
        this.camera.setBackgroundColor(0x000000);

        this.background = this.add.image(0, 0, 'game-over:destroyed-ship');
        this.layoutBackground();
        this.scale.on('resize', this.layoutBackground, this);
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
}
