import { GameObjects, Scene } from 'phaser';
import { loadObjectAssets, registerObjectAnimations } from '../objects/_shared/registry';
import { loadSoundAssets } from '../audio/registry';
import type { GameOverReturnPort } from '../application/results/gameOverReturn';
import type { AuthReturnContext } from '../application/auth/authReturn';
import { mainMenuBackgroundTransform } from './mainMenuBackground';

const preloaderInspectionFlag = 'inspect-preloader';
const progressBarWidth = 702;
const progressBarHeight = 64;
const progressBarInset = 4;

export class Preloader extends Scene
{
    private background: GameObjects.Image;
    private progressOutline: GameObjects.Rectangle;
    private progressBar: GameObjects.Rectangle;
    private readonly holdAtHalfProgress = new URLSearchParams(window.location.search).has(preloaderInspectionFlag);

    constructor ()
    {
        super('Preloader');
    }

    init ()
    {
        this.background = this.add.image(0, 0, 'preloader-background');
        this.progressOutline = this.add.rectangle(0, 0, progressBarWidth, progressBarHeight).setStrokeStyle(1, 0xffffff);
        this.progressBar = this.add.rectangle(0, 0, progressBarInset, progressBarHeight - (progressBarInset * 2), 0xffffff).setOrigin(0, 0.5);
        this.layout();
        this.scale.on('resize', this.layout, this);

        this.load.on('progress', (progress: number) => {
            this.setProgress(this.holdAtHalfProgress ? Math.min(progress, 0.5) : progress);
        });
    }

    preload ()
    {
        //  Load the assets for the game - Replace with your own assets
        this.load.setPath('assets');

        this.load.image('cow', 'cow_big.png');
        this.load.image('asteroid:rock', 'asteroid_rock.png');
        this.load.image('asteroid:ice', 'asteroid_ice.png');
        this.load.image('asteroid:metal', 'asteroid_metal.png');
        this.load.image('asteroid:dirt', 'asteroid_dirt.png');
        this.load.image('control:fire', 'button_fire.png');
        this.load.image('control:boost', 'button_boost.png');
        this.load.image('game-over:destroyed-ship', 'the_end_ship_destroyed.png');
        this.load.image('game-over:debt-paid', 'the_end_debt_payed.png');
        this.load.image('game-over:debt-due', 'the_end_debt_due.png');
        this.load.image('background:nebula', 'nebula_tile.png');
        this.load.image('background:starfield', 'starfield_tile.png');
        this.load.image('intro:story:1', 'story_art1.png');
        this.load.image('intro:story:2', 'story_art2.png');
        this.load.image('intro:story:3', 'story_art3.png');
        this.load.image('intro:story:4:desktop', 'story_art4_desktop.png');
        this.load.image('intro:story:4:mobile', 'story_art4_mobile.png.png');
        loadObjectAssets(this);
        loadSoundAssets(this);
    }

    create ()
    {
        registerObjectAnimations(this);
        if (this.holdAtHalfProgress) {
            this.setProgress(0.5);
            return;
        }

        this.scale.off('resize', this.layout, this);
        //  When all the assets have loaded, it's often worth creating global objects here that the rest of the game can use.
        //  For example, you can define global animations here, so we can use them in other scenes.

        const terminalResult = (this.registry.get('gameOverReturn') as GameOverReturnPort | undefined)?.take() ?? null;
        const authReturn = this.registry.get('authReturnContext') as Readonly<AuthReturnContext> | null;
        if (authReturn?.origin === 'game-menu') {
            this.scene.start('Game');
            this.game.events.emit('auth-return-account-open', 'game-menu');
        } else if (authReturn?.origin === 'game-over' && authReturn.terminalResult) {
            this.scene.start('GameOver', { terminalResult: authReturn.terminalResult });
            this.game.events.emit('auth-return-account-open', 'game-over');
        } else if (terminalResult) this.scene.start('GameOver', { terminalResult });
        else {
            this.scene.start('MainMenu');
            if (authReturn?.origin === 'main-menu') this.game.events.emit('auth-return-account-open', 'main-menu');
        }
        const authReturnError = this.registry.get('authReturnError') as string | null;
        if (authReturnError) this.game.events.emit('auth-return-error', authReturnError);
    }

    private readonly layout = (): void =>
    {
        const transform = mainMenuBackgroundTransform(this.scale, this.background.height);
        const x = this.scale.width / 2;
        const y = this.scale.height * 0.8;

        this.background.setPosition(transform.x, transform.y).setScale(transform.scale);
        this.progressOutline.setPosition(x, y);
        this.progressBar.setPosition(x - (progressBarWidth / 2) + progressBarInset, y);
    };

    private setProgress (progress: number): void
    {
        this.progressBar.width = progressBarInset + ((progressBarWidth - (progressBarInset * 2)) * progress);
    }
}
