import { GameObjects, Math as PhaserMath, Scene } from 'phaser';
import { SceneObject } from '../_shared/sceneObject';
import { ObjectDepth } from '../../visual/layers';
import type { SceneObjectOptions } from '../_shared/types';
import type { PlanetState } from '../../state/planetState';
import { definition } from './definition';
import { canLandNearPlanet, planetLandingRadius } from '../../mechanics/planet/proximity';
import { activeTimeWave } from '../../visual/activeTime';

const LANDING_GUIDE_START_RADIUS = 75;
const LANDING_GUIDE_RADIUS_STEP = 10;

export interface PlanetOptions extends Omit<SceneObjectOptions, 'x' | 'y' | 'size'> {
    model: PlanetState;
    spinSpeed?: number;
}

export class Planet extends SceneObject
{
    readonly indicator: GameObjects.Arc;
    readonly landingZone: GameObjects.Arc;
    readonly atmosphere: GameObjects.Graphics;
    readonly landingGuide: GameObjects.Graphics;
    readonly id: string;
    readonly landingLabel: GameObjects.Text;
    readonly planetNameLabel: GameObjects.Text;
    private readonly shipOffset = new PhaserMath.Vector2();
    private readonly spinSpeed: number;

    constructor (scene: Scene, options: PlanetOptions)
    {
        super(scene, definition, { ...options.model.position, depth: options.depth, variant: options.variant });
        this.id = options.model.id;
        this.sprite.setData('planetId', this.id);
        this.setSize(options.model.radius * 2);
        const tints: Record<string, number> = { blue: 0x7acfff, green: 0x99e8ab, amber: 0xffcb80 };
        this.sprite.setTint(tints[options.variant ?? 'blue']);
        this.spinSpeed = options.spinSpeed ?? 1;
        this.sprite.anims.pause();
        this.indicator = scene.add.circle(options.model.position.x, options.model.position.y, this.radius + 6)
            .setStrokeStyle(2, 0x9be0ff).setDepth(ObjectDepth.Indicator).setVisible(false);
        this.landingZone = scene.add.circle(options.model.position.x, options.model.position.y, 1)
            .setFillStyle(0x4e9bd9, 0.035).setStrokeStyle(1.5, 0x78c9fa, 0.4)
            .setDepth(ObjectDepth.Planet - 2).setVisible(false);
        this.atmosphere = scene.add.graphics().setDepth(ObjectDepth.Planet - 1);
        this.landingGuide = scene.add.graphics().setDepth(ObjectDepth.Indicator).setVisible(false);
        this.landingLabel = scene.add.text(options.model.position.x, options.model.position.y, 'LAND ON', {
            fontFamily: 'Arial', fontSize: 13, color: '#ffffff', align: 'center',
            stroke: '#091421', strokeThickness: 5
        }).setOrigin(0.5).setDepth(ObjectDepth.Indicator).setVisible(false);
        this.planetNameLabel = scene.add.text(options.model.position.x, options.model.position.y, '', {
            fontFamily: 'Arial', fontSize: 22, color: '#ffffff', align: 'center',
            stroke: '#091421', strokeThickness: 5
        }).setOrigin(0.5).setDepth(ObjectDepth.Indicator).setVisible(false);
        this.ownCleanup(() => this.indicator.destroy());
        this.ownCleanup(() => this.landingZone.destroy());
        this.ownCleanup(() => this.atmosphere.destroy());
        this.ownCleanup(() => this.landingGuide.destroy());
        this.ownCleanup(() => this.landingLabel.destroy());
        this.ownCleanup(() => this.planetNameLabel.destroy());
        this.drawAtmosphere();
        this.synchronize(options.model);
    }

    synchronize (state: PlanetState): void
    {
        super.setPosition(state.position.x, state.position.y);
        if (this.radius !== state.radius) super.setSize(state.radius * 2);
        this.updateLabel(state);
    }

    update (activeElapsedMs: number): void
    {
        this.sprite.setFrame(Math.floor(activeElapsedMs * this.spinSpeed / 125) % 12);
        this.drawLandingGuide(activeElapsedMs);
    }

    private updateLabel (state: PlanetState): void
    {
        const text = state.name.toUpperCase();
        if (this.planetNameLabel.text !== text) this.planetNameLabel.setText(text);
        this.landingLabel.setPosition(state.position.x, state.position.y - 12);
        this.planetNameLabel.setPosition(state.position.x, state.position.y + 12);
    }

    private drawAtmosphere (): void
    {
        this.atmosphere.clear().setPosition(this.sprite.x, this.sprite.y);
        for (let halo = 5; halo >= 1; halo--) {
            this.atmosphere.lineStyle(3, 0x72bfff, (6 - halo) * 0.035);
            this.atmosphere.strokeCircle(0, 0, this.radius + halo * 2);
        }
    }

    private drawLandingGuide (activeElapsedMs: number): void
    {
        if (!this.landingGuide.visible) return;
        this.landingGuide.clear().setPosition(this.sprite.x, this.sprite.y);
        for (let index = 0, radius = LANDING_GUIDE_START_RADIUS; radius > 0; index++, radius -= LANDING_GUIDE_RADIUS_STEP) {
            const wave = activeTimeWave(-index * 0.9, 0.00875, activeElapsedMs);
            this.landingGuide.lineStyle(3, 0xc6efff, 0.16 + (wave + 1) * 0.16).strokeCircle(0, 0, radius);
        }
    }

    updateLandingIndicator (ship: SceneObject): void
    {
        this.indicator.setPosition(this.sprite.x, this.sprite.y).setRadius(this.radius + 6);
        const distance = this.shipOffset.set(ship.sprite.x, ship.sprite.y).subtract(this.sprite).length();
        const available = canLandNearPlanet(distance, ship.radius, this.radius);
        this.indicator.setVisible(available);
        this.landingLabel.setVisible(available);
        this.planetNameLabel.setVisible(available);
        this.landingGuide.setVisible(available);
        this.landingZone.setPosition(this.sprite.x, this.sprite.y)
            .setRadius(planetLandingRadius(this.radius, ship.radius)).setVisible(available);
        this.drawAtmosphere();
    }
}
