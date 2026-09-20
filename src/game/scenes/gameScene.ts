import { GameObjects, Input, Math as PhaserMath, Physics, Scene } from 'phaser';
import { ObjectDepth } from '../visual/layers';
import { Spaceship } from '../objects/spaceship/spaceship';
import { ShipWeapon } from '../objects/spaceship/shipWeapon';
import { shipBoostTuning, shipTuning } from '../objects/spaceship/definition';
import { Planet } from '../objects/planet/planet';
import type { PlanetWorldState } from '../world/planetWorldState';
import type { CircleObstacle } from '../world/geometry';
import { Starfield } from '../effects/starfield';
import { gameObjectLayout, gameWorldBounds } from './gameObjects';
import { getAudioService } from '../audio/gameAudio';
import type { AudioScope } from '../audio/audioScope';
import { updateShipAudio } from '../audio/shipAudio';
import { Sun } from '../objects/sun/sun';

export class Game extends Scene
{
    camera: Phaser.Cameras.Scene2D.Camera;
    background: Starfield;
    sun: Sun;
    ship: Spaceship;
    planets: Planet[];
    planetModels: PlanetWorldState[];
    weapon: ShipWeapon;
    private audio: AudioScope;
    private steeringPointer: Input.Pointer | null = null;
    private readonly pointerWorld = new PhaserMath.Vector2();
    private contact: Physics.Arcade.Collider;
    private landingPrompt: GameObjects.Text;
    private uiCamera: Phaser.Cameras.Scene2D.Camera;
    private boostHeld = false;
    private fireHeld = false;

    constructor ()
    {
        super('Game');
    }

    create ()
    {
        this.steeringPointer = null;
        this.boostHeld = false;
        this.fireHeld = false;
        this.audio = getAudioService(this.game).createScope(this);
        this.camera = this.cameras.main;
        this.camera.setZoom(1).removeBounds();
        this.camera.setBackgroundColor('#000000');
        this.physics.world.setBounds(gameWorldBounds.x, gameWorldBounds.y, gameWorldBounds.width, gameWorldBounds.height);
        this.background = new Starfield(this, gameWorldBounds.width, gameWorldBounds.height, gameWorldBounds.x, gameWorldBounds.y);
        this.sun = new Sun(this, gameObjectLayout.sun);
        this.ship = new Spaceship(this, gameObjectLayout.ship);
        this.planetModels = gameObjectLayout.planets.map(options => ({ ...options.model }));
        this.planets = gameObjectLayout.planets.map((options, index) => new Planet(this, { ...options, model: this.planetModels[index] }));
        const projectileObstacles: CircleObstacle[] = [...this.planetModels, {
            x: this.sun.sprite.x, y: this.sun.sprite.y, radius: this.sun.radius
        }];
        this.weapon = new ShipWeapon(this, this.ship, projectileObstacles, projectile => {
            this.uiCamera.ignore(projectile.sprite);
            this.audio.play('ship-laser');
        });
        this.contact = this.physics.add.collider(this.ship.sprite, [this.sun.sprite, ...this.planets.map(planet => planet.sprite)]);
        this.camera.startFollow(this.ship.sprite, false, 1, 1, 0, 0);
        this.camera.centerOn(this.ship.sprite.x, this.ship.sprite.y);
        const ui = this.add.container(0, 0).setScrollFactor(0).setDepth(ObjectDepth.UI);
        const help = this.add.text(24, 24, 'Hold / drag to fly · Left Shift: 5× boost · Left Ctrl: fire', {
            fontFamily: 'Arial', fontSize: 18, color: '#ffffff', backgroundColor: '#102039', padding: { x: 12, y: 10 }
        }).setScrollFactor(0).setDepth(ObjectDepth.UI);
        this.landingPrompt = this.add.text(512, 692, 'Press [SPACE] / Tap on planet\nto land', {
            fontFamily: 'Arial', fontSize: 20, color: '#d6efff', align: 'center',
            backgroundColor: '#102039', padding: { x: 18, y: 12 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(ObjectDepth.UI).setVisible(false);
        const exit = this.add.text(1000, 744, 'Exit demo', {
            fontFamily: 'Arial', fontSize: 20, color: '#ffffff', backgroundColor: '#243952', padding: { x: 14, y: 10 }
        }).setOrigin(1, 1).setScrollFactor(0).setDepth(ObjectDepth.UI).setInteractive({ useHandCursor: true });
        ui.add([help, this.landingPrompt, exit]);
        this.camera.ignore(ui);
        this.uiCamera = this.cameras.add(0, 0, this.scale.width, this.scale.height, false, 'UI');
        this.uiCamera.ignore(this.children.list.filter(child => child !== ui));
        exit.on('pointerdown', (_pointer: Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
            event.stopPropagation();
            this.loseFocus();
            this.scene.start('GameOver');
        });
        this.input.on('pointerdown', this.startSteering, this);
        this.input.on('pointerup', this.endSteering, this);
        this.input.on('pointerupoutside', this.endSteering, this);
        this.game.events.on('blur', this.loseFocus, this);
        window.addEventListener('blur', this.loseFocus);
        window.addEventListener('touchcancel', this.cancelTouch);
        window.addEventListener('keydown', this.flightKeyDown);
        window.addEventListener('keyup', this.flightKeyUp);
        this.events.once('shutdown', () => {
            this.loseFocus();
            this.input.off('pointerdown', this.startSteering, this);
            this.input.off('pointerup', this.endSteering, this);
            this.input.off('pointerupoutside', this.endSteering, this);
            this.game.events.off('blur', this.loseFocus, this);
            window.removeEventListener('blur', this.loseFocus);
            window.removeEventListener('touchcancel', this.cancelTouch);
            window.removeEventListener('keydown', this.flightKeyDown);
            window.removeEventListener('keyup', this.flightKeyUp);
            this.contact.destroy();
            this.camera.stopFollow();
            this.cameras.remove(this.uiCamera);
        });
        for (const planet of this.planets) planet.updateLandingIndicator(this.ship);
        this.updateLandingPrompt();
        this.background.update(this.time.now);
    }

    private startSteering (pointer: Input.Pointer): void
    {
        if (!this.steeringPointer && (pointer.wasTouch || pointer.button === 0)) this.steeringPointer = pointer;
    }

    private endSteering (pointer: Input.Pointer): void
    {
        if (pointer === this.steeringPointer && (pointer.wasTouch || !pointer.leftButtonDown())) this.releaseSteering();
    }

    private readonly cancelTouch = (event: TouchEvent): void => {
        const pointer = this.steeringPointer;
        if (pointer?.wasTouch && Array.from(event.changedTouches).some(touch => touch.identifier === pointer.identifier)) this.releaseSteering();
    };

    private readonly releaseSteering = (): void => {
        this.steeringPointer = null;
        this.ship?.setTarget(null);
        this.ship?.setBoostRequested(false);
    };

    private readonly flightKeyDown = (event: KeyboardEvent): void => {
        if (event.target instanceof Element && event.target.closest('[data-game-input="ignore"]')) return;
        if (event.code === 'ShiftLeft') this.boostHeld = true;
        if (event.code === 'ControlLeft') {
            this.fireHeld = true;
            event.preventDefault();
        }
    };

    private readonly flightKeyUp = (event: KeyboardEvent): void => {
        if (event.code === 'ShiftLeft') this.boostHeld = false;
        if (event.code === 'ControlLeft') this.fireHeld = false;
    };

    private readonly loseFocus = (): void => {
        this.boostHeld = false;
        this.fireHeld = false;
        this.weapon?.setFiring(false);
        this.releaseSteering();
    };

    private updateLandingPrompt (): void
    {
        this.landingPrompt.setVisible(this.planets.some(planet => planet.indicator.visible));
    }

    update (time: number, delta: number): void
    {
        const pointer = this.steeringPointer;
        if (pointer?.isDown && (pointer.wasTouch || pointer.leftButtonDown())) {
            this.camera.getWorldPoint(pointer.x, pointer.y, this.pointerWorld);
            // Phaser 4's inverse camera matrix describes the last rendered frame.
            // Compensate for this frame's physics movement before camera follow renders.
            this.pointerWorld.x += this.ship.sprite.x - this.camera.midPoint.x;
            this.pointerWorld.y += this.ship.sprite.y - this.camera.midPoint.y;
            this.ship.setTarget(this.pointerWorld);
        } else this.releaseSteering();
        this.ship.setBoostRequested(this.boostHeld && this.steeringPointer !== null);
        this.ship.update(time, delta);
        this.sun.update(time, delta);
        updateShipAudio(this.audio, this.ship, this.ship.body.velocity.length(),
            shipTuning.maxSpeed, shipBoostTuning.speedMultiplier, delta);
        const zoomTarget = this.ship.boosting ? shipBoostTuning.cameraZoom : 1;
        const zoomBlend = 1 - Math.exp(-delta / (shipBoostTuning.cameraTransitionSeconds * 1000));
        this.camera.setZoom(this.camera.zoom + (zoomTarget - this.camera.zoom) * zoomBlend);
        for (const planet of this.planets) {
            planet.update(time, delta);
            planet.updateLandingIndicator(this.ship);
        }
        this.updateLandingPrompt();
        this.weapon.setFiring(this.fireHeld);
        this.weapon.update(time, delta);
        this.background.update(time);
    }
}
