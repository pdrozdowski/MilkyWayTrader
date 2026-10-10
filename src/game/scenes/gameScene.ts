import { GameObjects, Input, Math as PhaserMath, Scene } from 'phaser';
import type { GameStateProvider } from '../application/gameStateProvider';
import type { AudioScope } from '../audio/audioScope';
import { getAudioService } from '../audio/gameAudio';
import { updateShipAudio } from '../audio/shipAudio';
import { asteroidTuning, projectileTuning, shipBoostTuning, shipTuning, weaponTuning } from '../definitions/gameplayTuning';
import { moolarisDefinition } from '../definitions/moolarisDefinition';
import { ShipDestruction } from '../effects/shipDestruction';
import { AsteroidExplosion, fragmentedParents, fragmentImpactPosition, planetImpactParents, planetImpactSmallAsteroids, projectileDamagedAsteroids, projectileDestroyedSmallAsteroids, projectileImpactPositions, sunConsumedAsteroids } from '../effects/asteroidExplosion';
import { OrbitalPaths } from '../effects/orbitalPaths';
import { pauseGameClock, resumeGameClock } from '../mechanics/clock/gameClock';
import { advanceGameSimulation } from '../mechanics/gameSimulation';
import { resolveMoolarisContact } from '../mechanics/moolaris/contact';
import { LANDING_CENTRE_RADIUS } from '../mechanics/planet/landing';
import { teleportShipToPlanet } from '../mechanics/debug/teleportShipToPlanet';
import { teleportShipToAsteroid } from '../mechanics/debug/teleportShipToAsteroid';
import { spawnDebugCargo } from '../mechanics/debug/spawnDebugCargo';
import { advanceShipServiceLevel } from '../application/planetShipServices';
import type { ShipServiceId } from '../application/planetShipServices';
import type { PerformanceMonitor, PerformanceStepId } from '../application/performanceMonitor';
import { Planet } from '../objects/planet/planet';
import { AsteroidProjection } from '../objects/asteroid/asteroidProjection';
import { CargoProjection } from '../objects/cargo/cargo';
import { CommodityProjection } from '../objects/commodity/commodity';
import { ShipWeapon } from '../objects/spaceship/shipWeapon';
import { Spaceship } from '../objects/spaceship/spaceship';
import { Sun } from '../objects/sun/sun';
import type { PlanetState } from '../state/planetState';
import type { AsteroidState } from '../state/asteroidState';
import { ObjectDepth } from '../visual/layers';
import { gameObjectLayout, gameWorldBounds } from './gameObjects';
import type { TelemetryPort } from '../application/telemetry/telemetry';
import type { TerminalResultState } from '../state/terminalResultState';
import { cargoCapacityByLevel } from '../domain/runBalance';

export class Game extends Scene
{
    camera: Phaser.Cameras.Scene2D.Camera;
    nebulaBackground: GameObjects.TileSprite;
    starfieldBackground: GameObjects.TileSprite;
    asteroids: AsteroidProjection;
    cargo: CargoProjection;
    commodities: CommodityProjection;
    asteroidExplosion: AsteroidExplosion;
    orbitalPaths: OrbitalPaths;
    sun: Sun;
    ship: Spaceship;
    planets: Planet[];
    weapon: ShipWeapon;
    private stateProvider: GameStateProvider;
    private audio: AudioScope;
    private telemetry: TelemetryPort;
    private steeringPointer: Input.Pointer | null = null;
    private readonly pointerWorld = new PhaserMath.Vector2();
    private readonly cameraDisplacement = new PhaserMath.Vector2();
    private readonly shipVelocity = new PhaserMath.Vector2();
    private lossOfControl: GameObjects.Text;
    private exit: GameObjects.Text;
    private joystickBase: GameObjects.Graphics;
    private joystickStick: GameObjects.Graphics;
    private joystickZone: GameObjects.Zone;
    private fireButton: GameObjects.Image;
    private boostButton: GameObjects.Image;
    private joystickPointer: Input.Pointer | null = null;
    private firePointer: Input.Pointer | null = null;
    private boostPointer: Input.Pointer | null = null;
    private readonly joystickOrigin = new PhaserMath.Vector2();
    private readonly joystickDirection = new PhaserMath.Vector2();
    private readonly joystickPosition = new PhaserMath.Vector2();
    private lossOfControlUntilMs = 0;
    private boostHeld = false;
    private fireHeld = false;
    private touchControlsVisible = false;
    private mouseMovementEnabled = true;
    private destruction: ShipDestruction | null = null;
    private deathTransitionStarted = false;
    private lastItemCollectedAtMs = Number.NEGATIVE_INFINITY;
    private lastItemBlockedAtMs = Number.NEGATIVE_INFINITY;
    private performanceMonitor: PerformanceMonitor;
    private performanceMonitorEnabled = false;
    private lastPerformanceSampleAtMs = 0;

    constructor ()
    {
        super('Game');
    }

    create ()
    {
        this.steeringPointer = null;
        this.boostHeld = false;
        this.fireHeld = false;
        this.touchControlsVisible = false;
        this.mouseMovementEnabled = true;
        this.deathTransitionStarted = false;
        this.lastItemCollectedAtMs = Number.NEGATIVE_INFINITY;
        this.lastItemBlockedAtMs = Number.NEGATIVE_INFINITY;
        this.game.events.emit('debug-controls-reset');
        this.audio = getAudioService(this.game).createScope(this);
        this.stateProvider = this.registry.get('gameStateProvider') as GameStateProvider;
        this.telemetry = this.registry.get('telemetry') as TelemetryPort;
        this.performanceMonitor = this.registry.get('performanceMonitor') as PerformanceMonitor;
        this.performanceMonitor.setEnabled(false);
        this.performanceMonitorEnabled = false;
        this.game.events.emit('performance-monitor-sample');
        const state = this.stateProvider.snapshot();
        this.camera = this.cameras.main;
        this.camera.setZoom(1).removeBounds();
        this.camera.roundPixels = true;
        this.camera.setBackgroundColor('#000000');
        this.physics.world.setBounds(gameWorldBounds.x, gameWorldBounds.y, gameWorldBounds.width, gameWorldBounds.height);
        this.nebulaBackground = this.add.tileSprite(0, 0, this.scale.width, this.scale.height, 'background:nebula')
            .setOrigin(0)
            .setScrollFactor(0)
            .setTileScale(3)
            .setDepth(ObjectDepth.Background);
        this.starfieldBackground = this.add.tileSprite(0, 0, this.scale.width, this.scale.height, 'background:starfield')
            .setOrigin(0)
            .setScrollFactor(0)
            .setDepth(ObjectDepth.Background);
        this.asteroids = new AsteroidProjection(this);
        this.cargo = new CargoProjection(this);
        this.commodities = new CommodityProjection(this);
        this.asteroidExplosion = new AsteroidExplosion(this);
        this.destruction = new ShipDestruction(this);
        this.orbitalPaths = new OrbitalPaths(this);
        this.sun = new Sun(this, gameObjectLayout.sun);
        this.ship = new Spaceship(this, state.ship);
        const planetsById = this.planetsById(state.planets);
        this.planets = gameObjectLayout.planets.map(({ id, ...options }) => new Planet(this, {
            ...options,
            model: planetsById.get(id)!
        }));
        this.weapon = new ShipWeapon(this, () => this.audio.play('ship-laser'));
        this.camera.centerOn(this.ship.sprite.x, this.ship.sprite.y);
        this.updateBackgroundTiles();
        this.lossOfControl = this.add.text(512, this.scale.height / 3, 'CONTROLS DISABLED - RECOVERING...', {
            fontFamily: 'Arial', fontSize: 18, color: '#ffd6d6', backgroundColor: '#7a1212', padding: { x: 12, y: 10 }
        }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(ObjectDepth.UI).setVisible(false);
        this.exit = this.add.text(1000, 744, 'Exit demo', {
            fontFamily: 'Arial', fontSize: 20, color: '#ffffff', backgroundColor: '#243952', padding: { x: 14, y: 10 }
        }).setOrigin(1, 1).setScrollFactor(0).setDepth(ObjectDepth.UI).setInteractive({ useHandCursor: true });
        this.exit.on('pointerdown', (_pointer: Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
            event.stopPropagation();
            this.exitToGameOver();
        });
        this.exit.setVisible(false).disableInteractive();
        this.createTouchControls();
        this.layoutScreenSpace();
        this.input.on('pointerdown', this.startSteering, this);
        this.input.on('pointerup', this.endSteering, this);
        this.input.on('pointerupoutside', this.endSteering, this);
        this.scale.on('resize', this.layoutScreenSpace, this);
        this.game.events.on('blur', this.loseFocus, this);
        this.game.events.on('game-pause-reason-added', this.clearInputForPause, this);
        this.game.events.on('landing-modal-transition', this.clearFlightInput, this);
        this.game.events.on('return-to-menu', this.exitToGameOver, this);
        this.game.events.on('debug-touch-controls', this.setTouchControlsVisible, this);
        this.game.events.on('debug-mouse-movement', this.setMouseMovementEnabled, this);
        this.game.events.on('debug-booster', this.setBoosterEnabled, this);
        this.game.events.on('debug-teleport-to-planet', this.teleportToPlanet, this);
        this.game.events.on('debug-teleport-to-asteroid', this.teleportToAsteroid, this);
        this.game.events.on('debug-spawn-cargo', this.spawnDebugCargo, this);
        this.game.events.on('debug-upgrade-ship-service', this.debugUpgradeShipService, this);
        this.game.events.on('debug-performance-monitor', this.setPerformanceMonitorEnabled, this);
        window.addEventListener('blur', this.loseFocus);
        window.addEventListener('focus', this.gainFocus);
        window.addEventListener('touchcancel', this.cancelTouch);
        window.addEventListener('keydown', this.flightKeyDown);
        window.addEventListener('keyup', this.flightKeyUp);
        this.events.once('shutdown', () => {
            this.game.events.emit('terminal-death-transition', false);
            this.loseFocus();
            this.input.off('pointerdown', this.startSteering, this);
            this.input.off('pointerup', this.endSteering, this);
            this.input.off('pointerupoutside', this.endSteering, this);
            this.scale.off('resize', this.layoutScreenSpace, this);
            this.game.events.off('blur', this.loseFocus, this);
            this.game.events.off('game-pause-reason-added', this.clearInputForPause, this);
            this.game.events.off('landing-modal-transition', this.clearFlightInput, this);
            this.game.events.off('return-to-menu', this.exitToGameOver, this);
            this.game.events.off('debug-touch-controls', this.setTouchControlsVisible, this);
            this.game.events.off('debug-mouse-movement', this.setMouseMovementEnabled, this);
            this.game.events.off('debug-booster', this.setBoosterEnabled, this);
            this.game.events.off('debug-teleport-to-planet', this.teleportToPlanet, this);
            this.game.events.off('debug-teleport-to-asteroid', this.teleportToAsteroid, this);
            this.game.events.off('debug-spawn-cargo', this.spawnDebugCargo, this);
            this.game.events.off('debug-upgrade-ship-service', this.debugUpgradeShipService, this);
            this.game.events.off('debug-performance-monitor', this.setPerformanceMonitorEnabled, this);
            this.detachPerformanceFrameListeners();
            this.performanceMonitor.setEnabled(false);
            this.performanceMonitorEnabled = false;
            this.game.events.emit('performance-monitor-sample');
            window.removeEventListener('blur', this.loseFocus);
            window.removeEventListener('focus', this.gainFocus);
            window.removeEventListener('touchcancel', this.cancelTouch);
            window.removeEventListener('keydown', this.flightKeyDown);
            window.removeEventListener('keyup', this.flightKeyUp);
            this.destruction?.destroy();
            this.destruction = null;
        });
        for (const planet of this.planets) {
            planet.update(state.clock.activeElapsedMs, 0);
            planet.updateLandingIndicator(this.ship, state.planetLifecycle);
        }
        this.asteroids.synchronize(state.asteroids);
        this.cargo.synchronize(state.orbitalCargo);
        this.commodities.synchronize(state.looseItems, new Set());
        this.sun.synchronize(state.clock.activeElapsedMs, state.ship.position);
    }

    private readonly performanceFrameStarted = (): void => { this.performanceMonitor.frameStarted(); };

    private readonly performanceUpdatePhaseEnded = (): void => { this.performanceMonitor.updatePhaseEnded(); };

    private readonly performanceRenderStarted = (): void => { this.performanceMonitor.renderStarted(); };

    private readonly performanceRenderEnded = (): void => { this.performanceMonitor.renderEnded(); };

    private readonly setPerformanceMonitorEnabled = (enabled: boolean): void => {
        this.performanceMonitorEnabled = enabled;
        if (enabled) {
            this.performanceMonitor.setEnabled(true);
            this.lastPerformanceSampleAtMs = 0;
            this.game.events.on('prestep', this.performanceFrameStarted);
            this.game.events.on('poststep', this.performanceUpdatePhaseEnded);
            this.game.events.on('prerender', this.performanceRenderStarted);
            this.game.events.on('postrender', this.performanceRenderEnded);
        } else {
            this.detachPerformanceFrameListeners();
            this.performanceMonitor.setEnabled(false);
        }
        this.game.events.emit('performance-monitor-sample');
    };

    private detachPerformanceFrameListeners (): void
    {
        this.game.events.off('prestep', this.performanceFrameStarted);
        this.game.events.off('poststep', this.performanceUpdatePhaseEnded);
        this.game.events.off('prerender', this.performanceRenderStarted);
        this.game.events.off('postrender', this.performanceRenderEnded);
    }

    private markPerformanceStep (id: PerformanceStepId): void
    {
        if (!this.performanceMonitorEnabled) return;
        this.performanceMonitor.stepStarted(id);
    }

    private endPerformanceStep (): void
    {
        if (!this.performanceMonitorEnabled) return;
        this.performanceMonitor.stepEnded();
    }

    private samplePerformanceMonitor (time: number): void
    {
        if (!this.performanceMonitorEnabled || time - this.lastPerformanceSampleAtMs < 250) return;
        this.lastPerformanceSampleAtMs = time;
        this.game.events.emit('performance-monitor-sample');
    }

    private startSteering (pointer: Input.Pointer): void
    {
        if (this.isJoystickPointer(pointer)) {
            this.startJoystick(pointer);
            return;
        }
        if (!this.steeringPointer && this.mouseMovementEnabled && !pointer.wasTouch && pointer.button === 0) this.steeringPointer = pointer;
    }

    private isJoystickPointer (pointer: Input.Pointer): boolean
    {
        return this.joystickZone.active && PhaserMath.Distance.Between(pointer.x, pointer.y, this.joystickZone.x, this.joystickZone.y) <= 80;
    }

    private startJoystick (pointer: Input.Pointer): void
    {
        if (this.joystickPointer) return;
        this.releaseSteering();
        this.joystickPointer = pointer;
        if (pointer.wasTouch) this.joystickOrigin.set(pointer.x, pointer.y);
        else this.joystickOrigin.set(this.joystickZone.x, this.joystickZone.y);
        this.updateJoystick(pointer);
    }

    private setTouchControlsVisible (visible: boolean): void
    {
        this.touchControlsVisible = visible;
        if (!visible && !this.sys.game.device.input.touch) {
            this.releaseJoystick();
            this.firePointer = null;
            this.boostPointer = null;
        }
        this.layoutScreenSpace();
    }

    private setBoosterEnabled (enabled: boolean): void
    {
        this.stateProvider.update(state => ({
            ...state,
            ship: enabled ? state.ship : { ...state.ship, boosting: false, boostAcceleration: 0 },
            shipStatus: { ...state.shipStatus, boosterUnlocked: enabled }
        }));
    }

    private setMouseMovementEnabled (enabled: boolean): void
    {
        this.mouseMovementEnabled = enabled;
        if (!enabled) this.releaseSteering();
    }

    private endSteering (pointer: Input.Pointer): void
    {
        if (pointer === this.steeringPointer && !pointer.leftButtonDown()) this.releaseSteering();
        if (pointer === this.joystickPointer) this.releaseJoystick();
        if (pointer === this.firePointer) this.firePointer = null;
        if (pointer === this.boostPointer) this.boostPointer = null;
    }

    private readonly cancelTouch = (event: TouchEvent): void => {
        const pointer = this.steeringPointer;
        if (pointer?.wasTouch && Array.from(event.changedTouches).some(touch => touch.identifier === pointer.identifier)) this.releaseSteering();
        if (this.joystickPointer && Array.from(event.changedTouches).some(touch => touch.identifier === this.joystickPointer?.identifier)) this.releaseJoystick();
        if (this.firePointer && Array.from(event.changedTouches).some(touch => touch.identifier === this.firePointer?.identifier)) this.firePointer = null;
        if (this.boostPointer && Array.from(event.changedTouches).some(touch => touch.identifier === this.boostPointer?.identifier)) this.boostPointer = null;
    };

    private readonly releaseSteering = (): void => {
        this.steeringPointer = null;
    };

    private createTouchControls (): void
    {
        this.joystickBase = this.add.graphics().setScrollFactor(0).setDepth(ObjectDepth.UI).setVisible(false);
        this.joystickStick = this.add.graphics().setScrollFactor(0).setDepth(ObjectDepth.UI).setVisible(false);
        this.joystickZone = this.add.zone(0, 0, 160, 160).setScrollFactor(0).setDepth(ObjectDepth.UI).setCircleDropZone(80).setInteractive();
        this.joystickZone.on('pointerdown', (pointer: Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
            event.stopPropagation();
            this.startJoystick(pointer);
        });
        this.fireButton = this.createTouchButton('control:fire');
        this.boostButton = this.createTouchButton('control:boost');
        this.bindTouchButton(this.fireButton, pointer => { this.firePointer = pointer; }, pointer => { if (pointer === this.firePointer) this.firePointer = null; });
        this.bindTouchButton(this.boostButton, pointer => { this.boostPointer = pointer; }, pointer => { if (pointer === this.boostPointer) this.boostPointer = null; });
    }

    private createTouchButton (assetKey: string): GameObjects.Image
    {
        return this.add.image(0, 0, assetKey).setScrollFactor(0).setDepth(ObjectDepth.UI).setInteractive({ useHandCursor: true }).setVisible(false);
    }

    private bindTouchButton (button: GameObjects.Image, down: (pointer: Input.Pointer) => void, up: (pointer: Input.Pointer) => void): void
    {
        button.on('pointerdown', (pointer: Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
            event.stopPropagation();
            down(pointer);
        });
        button.on('pointerup', up);
        button.on('pointerout', up);
    }

    private readonly releaseJoystick = (): void => {
        this.joystickPointer = null;
        this.joystickDirection.setTo(0, 0);
        this.joystickOrigin.set(this.joystickZone.x, this.joystickZone.y);
        this.joystickPosition.copy(this.joystickOrigin);
        this.drawJoystick();
    };

    private updateJoystick (pointer: Input.Pointer): void
    {
        this.joystickPosition.set(pointer.x, pointer.y).subtract(this.joystickOrigin);
        const distance = this.joystickPosition.length();
        if (distance <= 20) this.joystickDirection.setTo(0, 0);
        else this.joystickDirection.copy(this.joystickPosition).normalize();
        this.joystickPosition.limit(60).add(this.joystickOrigin);
        this.drawJoystick();
    }

    private drawJoystick (): void
    {
        this.joystickBase.clear().fillStyle(0x173c5d, 0.55).fillCircle(this.joystickOrigin.x, this.joystickOrigin.y, 72).lineStyle(2, 0x8bdfff, 0.8).strokeCircle(this.joystickOrigin.x, this.joystickOrigin.y, 72);
        this.joystickStick.clear().fillStyle(0x8bdfff, 0.8).fillCircle(this.joystickPosition.x, this.joystickPosition.y, 28);
    }

    private layoutScreenSpace (): void
    {
        const { width, height } = this.scale;
        const viewport = this.scale.getViewPort();
        const visibleLeft = viewport.left;
        const visibleRight = viewport.right;
        const visibleBottom = viewport.bottom;
        this.nebulaBackground.setSize(width, height);
        this.starfieldBackground.setSize(width, height);
        this.lossOfControl.setPosition(width / 2, height / 3);
        this.exit.setPosition(width - 24, height - 24);
        const touchLayoutVisible = !this.deathTransitionStarted && (this.sys.game.device.input.touch || this.touchControlsVisible);
        this.joystickBase.setVisible(touchLayoutVisible);
        this.joystickStick.setVisible(touchLayoutVisible);
        this.joystickZone.setActive(touchLayoutVisible).setPosition(visibleLeft + 108, visibleBottom - 108);
        this.fireButton.setVisible(touchLayoutVisible).setPosition(visibleRight - 74, visibleBottom - 74);
        this.boostButton.setVisible(touchLayoutVisible).setPosition(visibleRight - 186, visibleBottom - 74);
        if (this.joystickPointer) this.drawJoystick();
        else this.releaseJoystick();
    }

    private updateBackgroundTiles (): void
    {
        this.nebulaBackground.setTilePosition(this.camera.scrollX / 3, this.camera.scrollY / 3);
        this.starfieldBackground.setTilePosition(this.camera.scrollX, this.camera.scrollY);
    }

    private readonly flightKeyDown = (event: KeyboardEvent): void => {
        if (event.target instanceof Element && event.target.closest('[data-game-input="ignore"]')) return;
        if (this.hasInputBlockingPause()) {
            this.clearFlightInput();
            return;
        }
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
        this.clearFlightInput();
        if (this.stateProvider) this.stateProvider.update(state => ({ ...state, clock: pauseGameClock(state.clock, 'background') }));
    };

    private readonly gainFocus = (): void => {
        if (this.stateProvider) this.stateProvider.update(state => ({ ...state, clock: resumeGameClock(state.clock, 'background') }));
    };

    private readonly exitToGameOver = (): void => {
        this.telemetry.endSession(this.stateProvider.snapshot().credits);
        this.loseFocus();
        this.scene.start('MainMenu');
    };

    private readonly clearFlightInput = (): void => {
        this.boostHeld = false;
        this.fireHeld = false;
        this.releaseSteering();
        this.releaseJoystick();
        this.firePointer = null;
        this.boostPointer = null;
    };

    private readonly clearInputForPause = (reason: string): void => {
        if (reason === 'menu' || reason === 'orientation' || reason === 'landed') this.clearFlightInput();
    };

    private hasInputBlockingPause (): boolean
    {
        if (this.deathTransitionStarted) return true;
        const reasons = this.stateProvider.snapshot().clock.pauseReasons;
        return reasons.includes('menu') || reasons.includes('orientation') || reasons.includes('landed');
    }

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
        this.markPerformanceStep('input-intent');
        const pointer = this.steeringPointer;
        if (pointer?.isDown && (pointer.wasTouch || pointer.leftButtonDown())) {
            this.camera.getWorldPoint(pointer.x, pointer.y, this.pointerWorld);
            // Phaser 4's inverse camera matrix describes the last rendered frame.
            this.cameraDisplacement.set(this.ship.sprite.x, this.ship.sprite.y).subtract(this.camera.midPoint);
            this.pointerWorld.add(this.cameraDisplacement);
        } else this.releaseSteering();
        if (this.joystickPointer?.isDown) this.updateJoystick(this.joystickPointer);
        else this.releaseJoystick();
        const joystickTarget = this.joystickDirection.lengthSq() > 0
            ? this.pointerWorld.copy(this.joystickDirection).scale(1000).add(this.ship.sprite)
            : null;
        this.markPerformanceStep('state-snapshot');
        const before = this.stateProvider.snapshot();
        const isMoolarisContact = !resolveMoolarisContact(before.ship).hasControl;
        if (isMoolarisContact) this.lossOfControlUntilMs = time + 1500;
        this.markPerformanceStep('state-commit');
        const state = this.stateProvider.update(current => advanceGameSimulation(current, {
            target: pointer?.isDown ? this.pointerWorld : joystickTarget,
            boostRequested: (this.boostHeld || this.boostPointer !== null) && (this.steeringPointer !== null || joystickTarget !== null),
            firing: this.fireHeld || this.firePointer !== null,
            landingRequested: this.landingRequested(before)
        }, delta, {
            obstacles: [{ ...moolarisDefinition.position, radius: moolarisDefinition.radius }],
            projectileLifetimeMs: projectileTuning.lifetime,
            projectileRadius: projectileTuning.radius,
            projectileSpeed: weaponTuning.projectileSpeed,
            shotIntervalMs: 1000 / weaponTuning.shotsPerSecond,
            muzzleOffset: weaponTuning.noseOffset * this.ship.sprite.scaleX
        }));
        this.markPerformanceStep('feedback-and-ship-sync');
        if (before.moolarisDamageArmed && !state.moolarisDamageArmed && state.terminalResult === null) this.playShipCrashFeedback(state.ship.position);
        const failedPickup = before.looseItems.some(item => Math.hypot(item.position.x - before.ship.position.x, item.position.y - before.ship.position.y) <= asteroidTuning.salvage.looseItemPickupRadius)
            && state.looseItems.length === before.looseItems.length
            && before.cargo.reduce((total, container) => total + container.quantity, 0) >= (cargoCapacityByLevel[before.shipStatus.cargoLevel] ?? 0);
        if (failedPickup) {
            this.game.events.emit('salvage-pickup-cargo-full');
            if (time - this.lastItemBlockedAtMs >= 500) {
                this.lastItemBlockedAtMs = time;
                this.audio.play('item-collection-blocked');
            }
        }
        if (before.terminalResult === null && state.terminalResult !== null) {
            this.beginDeathTransition(state.terminalResult, state.ship.position);
            this.endPerformanceStep();
            return;
        }
        if (this.deathTransitionStarted) {
            this.endPerformanceStep();
            return;
        }
        if (before.planetLifecycle.landedPlanetId === null && state.planetLifecycle.landedPlanetId !== null) this.clearFlightInput();
        if (before.planetLifecycle.landedPlanetId === null && state.planetLifecycle.landedPlanetId !== null) this.telemetry.emit('planet_landed', { planet: state.planetLifecycle.landedPlanetId, credits_after: state.credits });
        const renewedAsteroidControlLock = state.ship.asteroidControlLockedUntilActiveMs !== null
            && state.ship.asteroidControlLockedUntilActiveMs !== before.ship.asteroidControlLockedUntilActiveMs;
        if (renewedAsteroidControlLock) {
            this.clearFlightInput();
            this.lossOfControlUntilMs = time + 750;
        }
        if (state.ship.asteroidImpactAtActiveMs !== null && state.ship.asteroidImpactAtActiveMs !== before.ship.asteroidImpactAtActiveMs) {
            this.playShipCrashFeedback(state.ship.position);
        }
        this.ship.synchronize(state.ship, state.shipStatus.engineLevel, time);
        this.lossOfControl.setVisible(time < this.lossOfControlUntilMs);
        this.sun.synchronize(state.clock.activeElapsedMs, state.ship.position);
        this.shipVelocity.copy(state.ship.velocity);
        updateShipAudio(this.audio, { enginesOn: state.ship.enginesOn && !state.clock.pauseReasons.includes('manual'), boosting: state.ship.boosting }, this.shipVelocity.length(),
            shipTuning.maxSpeed, shipBoostTuning.speedMultiplier, delta);
        const zoomTarget = state.ship.boosting ? shipBoostTuning.cameraZoom : 1;
        const zoomBlend = 1 - Math.exp(-delta / (shipBoostTuning.cameraTransitionSeconds * 1000));
        const nextZoom = this.camera.zoom + (zoomTarget - this.camera.zoom) * zoomBlend;
        this.camera.setZoom(Math.abs(nextZoom - zoomTarget) < 0.001 ? zoomTarget : nextZoom);
        this.camera.roundPixels = true;
        this.camera.centerOn(state.ship.position.x, state.ship.position.y);
        this.updateBackgroundTiles();
        this.markPerformanceStep('planets');
        const planetsById = this.planetsById(state.planets);
        for (const planet of this.planets) {
            planet.synchronize(planetsById.get(planet.id)!);
            planet.update(state.clock.activeElapsedMs, time);
            planet.updateLandingIndicator(this.ship, state.planetLifecycle);
        }
        this.markPerformanceStep('weapon-asteroids');
        this.weapon.synchronize(state.projectiles);
        this.playVisibleAsteroidFragmentation(before.asteroids, state.asteroids, before.projectiles, state.projectiles, state.planets, state.clock.activeElapsedMs - before.clock.activeElapsedMs);
        this.asteroids.synchronize(state.asteroids);
        this.markPerformanceStep('removals-effects');
        const destroyedCargoIds = cargoDestroyedIds(before, state);
        for (const id of destroyedCargoIds) {
            this.audio.play('asteroid-crash-metal-clean');
            const destroyedCargo = before.orbitalCargo.find(cargo => cargo.id === id);
            if (destroyedCargo && this.camera.worldView.contains(destroyedCargo.position.x, destroyedCargo.position.y)) {
                this.asteroidExplosion.explodeCargoDestroyed(destroyedCargo.position);
            }
        }
        const sunConsumedItems = sunConsumedLooseItemIds(before, state, state.clock.activeElapsedMs - before.clock.activeElapsedMs);
        for (const id of sunConsumedItems) {
            this.playSunConsumedSound();
            const item = before.looseItems.find(candidate => candidate.id === id);
            if (item && this.camera.worldView.contains(item.position.x, item.position.y)) {
                this.asteroidExplosion.explodeSunConsumedLooseItem(item.position);
            }
        }
        const beforeLooseIds = new Set(before.looseItems.map(item => item.id));
        const currentLooseIds = new Set(state.looseItems.map(item => item.id));
        const collectedItemCount = [...beforeLooseIds].filter(id => !currentLooseIds.has(id) && !sunConsumedItems.has(id)).length;
        if (collectedItemCount > 0 && time - this.lastItemCollectedAtMs >= 200) {
            this.lastItemCollectedAtMs = time;
            this.audio.stop('item-collected');
            this.audio.play('item-collected');
        }
        this.markPerformanceStep('cargo-commodities');
        this.cargo.synchronize(state.orbitalCargo);
        this.commodities.synchronize(state.looseItems, sunConsumedItems);
        this.endPerformanceStep();
        this.samplePerformanceMonitor(time);
    }

    private readonly teleportToPlanet = (planetId: string): void => {
        this.clearFlightInput();
        this.stateProvider.update(state => teleportShipToPlanet(state, planetId));
    };

    private readonly teleportToAsteroid = (): void => {
        this.clearFlightInput();
        this.stateProvider.update(teleportShipToAsteroid);
    };

    private readonly spawnDebugCargo = (): void => {
        this.stateProvider.update(spawnDebugCargo);
    };

    private readonly debugUpgradeShipService = (serviceId: ShipServiceId): void => {
        this.stateProvider.update(state => advanceShipServiceLevel(state, serviceId));
    };

    private playShipCrashFeedback (position: Readonly<{ x: number; y: number }>): void
    {
        this.asteroidExplosion.explodeShipCrash(position);
        this.audio.play('asteroid-crash-metal-clean');
        this.camera.shake(180, 0.008);
    }

    private playSunConsumedSound (): void
    {
        this.audio.stop('sun-asteroid-low-slurp-loud-no-noise');
        this.audio.play('sun-asteroid-low-slurp-loud-no-noise');
    }

    private beginDeathTransition (terminalResult: TerminalResultState, position: Readonly<{ x: number; y: number }>): void
    {
        if (this.deathTransitionStarted) return;
        this.deathTransitionStarted = true;
        this.game.events.emit('terminal-death-transition', true);
        this.clearFlightInput();
        this.ship.setVisible(false);
        this.lossOfControl.setVisible(false);
        this.exit.setVisible(false).disableInteractive();
        this.joystickBase.setVisible(false);
        this.joystickStick.setVisible(false);
        this.joystickZone.disableInteractive().setActive(false);
        this.fireButton.setVisible(false).disableInteractive();
        this.boostButton.setVisible(false).disableInteractive();
        this.audio.silence();
        this.audio.play('asteroid-crash-metal-clean');
        this.destruction?.play(position, () => {
            if (!this.sys.isActive()) return;
            this.scene.start('GameOver', { terminalResult });
        });
    }

    private playVisibleAsteroidFragmentation (
        previous: readonly AsteroidState[], current: readonly AsteroidState[], previousProjectiles: readonly import('../state/projectileState').ProjectileState[], currentProjectiles: readonly import('../state/projectileState').ProjectileState[], planets: readonly PlanetState[], activeDeltaMs: number
    ): void
    {
        const planetImpactIds = new Set(planetImpactParents(previous, current, planets).map(parent => parent.id));
        const smallPlanetImpacts = planetImpactSmallAsteroids(previous, current, planets);
        const smallPlanetImpactIds = new Set(smallPlanetImpacts.map(asteroid => asteroid.id));
        for (const position of projectileImpactPositions(previous, current, previousProjectiles, currentProjectiles, activeDeltaMs, projectileTuning.radius)) {
            if (this.camera.worldView.contains(position.x, position.y)) this.asteroidExplosion.explodeProjectileImpact(position);
        }
        for (const asteroid of projectileDamagedAsteroids(previous, current)) if (this.camera.worldView.contains(asteroid.position.x, asteroid.position.y)) this.audio.play('asteroid-projectile-impact-clean');
        for (const asteroid of sunConsumedAsteroids(previous, current)) {
            // This is global feedback: camera and ship distance must not suppress it.
            this.asteroids.fadeOutSunConsumed(asteroid.id, () => this.playSunConsumedSound());
        }
        for (const parent of fragmentedParents(previous, current)) {
            const impactPosition = fragmentImpactPosition(parent, current);
            if (!this.camera.worldView.contains(impactPosition.x, impactPosition.y)) continue;
            if (planetImpactIds.has(parent.id)) {
                this.asteroidExplosion.explodePlanetImpact(impactPosition);
                this.audio.play('asteroid-planet-impact-deep-loud');
            } else {
                this.asteroidExplosion.explode(impactPosition);
                this.audio.play('asteroid-falls-apart-clean');
            }
        }
        for (const asteroid of smallPlanetImpacts) {
            if (!this.camera.worldView.contains(asteroid.position.x, asteroid.position.y)) continue;
            this.asteroidExplosion.explodePlanetImpact(asteroid.position);
            this.audio.play('asteroid-planet-impact-deep-loud');
        }
        for (const asteroid of projectileDestroyedSmallAsteroids(previous, current, previousProjectiles, currentProjectiles)) {
            if (smallPlanetImpactIds.has(asteroid.id)) continue;
            if (!this.camera.worldView.contains(asteroid.position.x, asteroid.position.y)) continue;
            this.asteroidExplosion.explode(asteroid.position);
            this.audio.play('asteroid-falls-apart-clean');
        }
    }

    private landingRequested (state: ReturnType<GameStateProvider['snapshot']>): boolean
    {
        const planetId = state.planetLifecycle.capturedPlanetId;
        const planet = planetId === null ? null : state.planets.find(candidate => candidate.id === planetId);
        if (!planet || state.planetLifecycle.landedPlanetId !== null) return false;
        return Math.hypot(state.ship.position.x - planet.position.x, state.ship.position.y - planet.position.y) <= LANDING_CENTRE_RADIUS;
    }

}

function cargoDestroyedIds (previous: ReturnType<GameStateProvider['snapshot']>, current: ReturnType<GameStateProvider['snapshot']>): readonly string[]
{
    const currentIds = new Set(current.orbitalCargo.map(cargo => cargo.id));
    const newLooseItemIds = new Set(current.looseItems.map(item => item.id));
    return previous.orbitalCargo.filter(cargo => !currentIds.has(cargo.id)
        && Array.from(newLooseItemIds).some(id => id.startsWith(`${cargo.id}-spill-`))).map(cargo => cargo.id);
}

function sunConsumedLooseItemIds (
    previous: ReturnType<GameStateProvider['snapshot']>, current: ReturnType<GameStateProvider['snapshot']>, activeDeltaMs: number
): ReadonlySet<string>
{
    const currentIds = new Set(current.looseItems.map(item => item.id));
    const maximumTravel = 240 * Math.max(0, activeDeltaMs) / 1000;
    return new Set(previous.looseItems.filter(item => !currentIds.has(item.id)
        && Math.hypot(item.position.x - moolarisDefinition.position.x, item.position.y - moolarisDefinition.position.y)
            <= moolarisDefinition.radius + maximumTravel).map(item => item.id));
}
