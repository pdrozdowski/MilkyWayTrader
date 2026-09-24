import { GameObjects, Input, Math as PhaserMath, Scene } from 'phaser';
import type { GameStateProvider } from '../application/gameStateProvider';
import type { AudioScope } from '../audio/audioScope';
import { getAudioService } from '../audio/gameAudio';
import { updateShipAudio } from '../audio/shipAudio';
import { projectileTuning, shipBoostTuning, shipTuning, weaponTuning } from '../definitions/gameplayTuning';
import { moolarisDefinition } from '../definitions/moolarisDefinition';
import { Starfield } from '../effects/starfield';
import { AsteroidBelt } from '../effects/asteroidBelt';
import { pauseGameClock, resumeGameClock } from '../mechanics/clock/gameClock';
import { advanceGameSimulation } from '../mechanics/gameSimulation';
import { resolveMoolarisContact } from '../mechanics/moolaris/contact';
import { Planet } from '../objects/planet/planet';
import { ShipWeapon } from '../objects/spaceship/shipWeapon';
import { Spaceship } from '../objects/spaceship/spaceship';
import { Sun } from '../objects/sun/sun';
import type { PlanetState } from '../state/planetState';
import { ObjectDepth } from '../visual/layers';
import { gameObjectLayout, gameWorldBounds } from './gameObjects';

export class Game extends Scene
{
    camera: Phaser.Cameras.Scene2D.Camera;
    background: Starfield;
    asteroidBelt: AsteroidBelt;
    sun: Sun;
    ship: Spaceship;
    planets: Planet[];
    weapon: ShipWeapon;
    private stateProvider: GameStateProvider;
    private audio: AudioScope;
    private steeringPointer: Input.Pointer | null = null;
    private readonly pointerWorld = new PhaserMath.Vector2();
    private readonly cameraDisplacement = new PhaserMath.Vector2();
    private readonly shipVelocity = new PhaserMath.Vector2();
    private lossOfControl: GameObjects.Text;
    private lossOfControlUntilMs = 0;
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
        this.stateProvider = this.registry.get('gameStateProvider') as GameStateProvider;
        const state = this.stateProvider.snapshot();
        this.camera = this.cameras.main;
        this.camera.setZoom(1).removeBounds();
        this.camera.roundPixels = true;
        this.camera.setBackgroundColor('#000000');
        this.physics.world.setBounds(gameWorldBounds.x, gameWorldBounds.y, gameWorldBounds.width, gameWorldBounds.height);
        this.background = new Starfield(this, gameWorldBounds.width, gameWorldBounds.height, gameWorldBounds.x, gameWorldBounds.y);
        this.asteroidBelt = new AsteroidBelt(this);
        this.sun = new Sun(this, gameObjectLayout.sun);
        this.ship = new Spaceship(this, state.ship);
        const planetsById = this.planetsById(state.planets);
        this.planets = gameObjectLayout.planets.map(({ id, ...options }) => new Planet(this, {
            ...options,
            model: planetsById.get(id)!
        }));
        this.weapon = new ShipWeapon(this, () => this.audio.play('ship-laser'));
        this.camera.centerOn(this.ship.sprite.x, this.ship.sprite.y);
        this.lossOfControl = this.add.text(512, this.scale.height / 3, 'CONTROLS DISABLED - RECOVERING...', {
            fontFamily: 'Arial', fontSize: 18, color: '#ffd6d6', backgroundColor: '#7a1212', padding: { x: 12, y: 10 }
        }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(ObjectDepth.UI).setVisible(false);
        const exit = this.add.text(1000, 744, 'Exit demo', {
            fontFamily: 'Arial', fontSize: 20, color: '#ffffff', backgroundColor: '#243952', padding: { x: 14, y: 10 }
        }).setOrigin(1, 1).setScrollFactor(0).setDepth(ObjectDepth.UI).setInteractive({ useHandCursor: true });
        exit.on('pointerdown', (_pointer: Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
            event.stopPropagation();
            this.exitToGameOver();
        });
        this.input.on('pointerdown', this.startSteering, this);
        this.input.on('pointerup', this.endSteering, this);
        this.input.on('pointerupoutside', this.endSteering, this);
        this.game.events.on('blur', this.loseFocus, this);
        window.addEventListener('blur', this.loseFocus);
        window.addEventListener('focus', this.gainFocus);
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
            window.removeEventListener('focus', this.gainFocus);
            window.removeEventListener('touchcancel', this.cancelTouch);
            window.removeEventListener('keydown', this.flightKeyDown);
            window.removeEventListener('keyup', this.flightKeyUp);
        });
        for (const planet of this.planets) {
            planet.update(state.clock.activeElapsedMs);
            planet.updateLandingIndicator(this.ship);
        }
        this.background.update(state.clock.activeElapsedMs);
        this.asteroidBelt.update(state.clock.activeElapsedMs);
        this.sun.synchronize(state.clock.activeElapsedMs, state.ship.position);
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
        this.releaseSteering();
        if (this.stateProvider) this.stateProvider.update(state => ({ ...state, clock: pauseGameClock(state.clock, 'background') }));
    };

    private readonly gainFocus = (): void => {
        if (this.stateProvider) this.stateProvider.update(state => ({ ...state, clock: resumeGameClock(state.clock, 'background') }));
    };

    private readonly exitToGameOver = (): void => {
        this.loseFocus();
        this.scene.start('GameOver');
    };

    private planetsById (states: readonly PlanetState[]): ReadonlyMap<string, PlanetState>
    {
        const configuredIds = new Set<string>();
        for (const options of gameObjectLayout.planets) {
            if (configuredIds.has(options.id)) throw new Error(`Duplicate configured planet id: ${options.id}.`);
            configuredIds.add(options.id);
        }
        const planetsById = new Map<string, PlanetState>();
        for (const state of states) {
            if (planetsById.has(state.id)) throw new Error(`Duplicate state planet id: ${state.id}.`);
            planetsById.set(state.id, state);
        }
        for (const id of configuredIds) if (!planetsById.has(id)) throw new Error(`Missing configured planet state: ${id}.`);
        return planetsById;
    }

    update (time: number, delta: number): void
    {
        const pointer = this.steeringPointer;
        if (pointer?.isDown && (pointer.wasTouch || pointer.leftButtonDown())) {
            this.camera.getWorldPoint(pointer.x, pointer.y, this.pointerWorld);
            // Phaser 4's inverse camera matrix describes the last rendered frame.
            this.cameraDisplacement.set(this.ship.sprite.x, this.ship.sprite.y).subtract(this.camera.midPoint);
            this.pointerWorld.add(this.cameraDisplacement);
        } else this.releaseSteering();
        const before = this.stateProvider.snapshot();
        const isMoolarisContact = !resolveMoolarisContact(before.ship).hasControl;
        if (isMoolarisContact) this.lossOfControlUntilMs = time + 1500;
        const state = this.stateProvider.update(current => advanceGameSimulation(current, {
            target: pointer?.isDown ? this.pointerWorld : null,
            boostRequested: this.boostHeld && this.steeringPointer !== null,
            firing: this.fireHeld
        }, delta, {
            obstacles: [{ ...moolarisDefinition.position, radius: moolarisDefinition.radius }],
            projectileLifetimeMs: projectileTuning.lifetime,
            projectileRadius: projectileTuning.radius,
            projectileSpeed: weaponTuning.projectileSpeed,
            shotIntervalMs: 1000 / weaponTuning.shotsPerSecond,
            muzzleOffset: weaponTuning.noseOffset * this.ship.sprite.scaleX
        }));
        this.ship.synchronize(state.ship, time);
        this.lossOfControl.setVisible(time < this.lossOfControlUntilMs);
        this.sun.synchronize(state.clock.activeElapsedMs, state.ship.position);
        this.shipVelocity.copy(state.ship.velocity);
        updateShipAudio(this.audio, state.ship, this.shipVelocity.length(),
            shipTuning.maxSpeed, shipBoostTuning.speedMultiplier, delta);
        const zoomTarget = state.ship.boosting ? shipBoostTuning.cameraZoom : 1;
        const zoomBlend = 1 - Math.exp(-delta / (shipBoostTuning.cameraTransitionSeconds * 1000));
        const nextZoom = this.camera.zoom + (zoomTarget - this.camera.zoom) * zoomBlend;
        this.camera.setZoom(Math.abs(nextZoom - zoomTarget) < 0.001 ? zoomTarget : nextZoom);
        this.camera.roundPixels = true;
        this.camera.centerOn(state.ship.position.x, state.ship.position.y);
        const planetsById = this.planetsById(state.planets);
        for (const planet of this.planets) {
            planet.synchronize(planetsById.get(planet.id)!);
            planet.update(state.clock.activeElapsedMs);
            planet.updateLandingIndicator(this.ship);
        }
        this.weapon.synchronize(state.projectiles);
        this.background.update(state.clock.activeElapsedMs);
        this.asteroidBelt.update(state.clock.activeElapsedMs);
    }

}
