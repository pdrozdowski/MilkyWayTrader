import { GameObjects, Scene } from 'phaser';
import { SceneObject } from '../_shared/sceneObject';
import { ObjectDepth } from '../../visual/layers';
import type { SceneObjectOptions } from '../_shared/types';
import type { PlanetWorldState } from '../../world/planetWorldState';
import { definition } from './definition';
import { canLandNearPlanet, planetLandingRadius } from '../../mechanics/planet/proximity';

export interface PlanetOptions extends Omit<SceneObjectOptions, 'x' | 'y' | 'size'> {
    model: PlanetWorldState;
    spinSpeed?: number;
    debugInfo?: boolean;
}

export class Planet extends SceneObject
{
    readonly indicator: GameObjects.Arc;
    readonly landingZone: GameObjects.Arc;
    readonly atmosphere: GameObjects.Graphics;
    readonly model: PlanetWorldState;
    readonly debugLabel: GameObjects.Text;

    constructor (scene: Scene, options: PlanetOptions)
    {
        super(scene, definition, { x: options.model.x, y: options.model.y, depth: options.depth, variant: options.variant });
        this.model = options.model;
        this.sprite.setData('planetModel', this.model);
        this.setSize(this.model.radius * 2);
        const tints: Record<string, number> = { blue: 0x7acfff, green: 0x99e8ab, amber: 0xffcb80 };
        this.sprite.setTint(tints[options.variant ?? 'blue']);
        this.sprite.anims.timeScale = options.spinSpeed ?? 1;
        this.indicator = scene.add.circle(this.model.x, this.model.y, this.radius + 6)
            .setStrokeStyle(2, 0x9be0ff).setDepth(ObjectDepth.Indicator).setVisible(false);
        this.landingZone = scene.add.circle(this.model.x, this.model.y, 1)
            .setFillStyle(0x4e9bd9, 0.035).setStrokeStyle(1.5, 0x78c9fa, 0.4)
            .setDepth(ObjectDepth.Planet - 2).setVisible(false);
        this.atmosphere = scene.add.graphics().setDepth(ObjectDepth.Planet - 1);
        this.debugLabel = scene.add.text(this.model.x, this.model.y, '', {
            fontFamily: 'monospace', fontSize: 14, color: '#bee0ff', align: 'center',
            backgroundColor: '#091421', padding: { x: 6, y: 4 }
        }).setOrigin(0.5, 1).setDepth(ObjectDepth.Indicator).setVisible(options.debugInfo ?? true);
        this.ownCleanup(() => this.indicator.destroy());
        this.ownCleanup(() => this.landingZone.destroy());
        this.ownCleanup(() => this.atmosphere.destroy());
        this.ownCleanup(() => this.debugLabel.destroy());
        this.drawAtmosphere();
        this.updateDebugLabel();
    }

    setPosition (x: number, y: number): this
    {
        super.setPosition(x, y);
        this.model.x = x;
        this.model.y = y;
        return this;
    }

    setSize (size: number): this
    {
        super.setSize(size);
        this.model.radius = this.radius;
        return this;
    }

    update (_time: number, _delta: number): void
    {
        if (this.sprite.x !== this.model.x || this.sprite.y !== this.model.y) super.setPosition(this.model.x, this.model.y);
        if (this.radius !== this.model.radius) super.setSize(this.model.radius * 2);
        this.updateDebugLabel();
    }

    private updateDebugLabel (): void
    {
        const text = `${this.model.name}\nx: ${Math.round(this.model.x)}  y: ${Math.round(this.model.y)}`;
        if (this.debugLabel.text !== text) this.debugLabel.setText(text);
        this.debugLabel.setPosition(this.model.x, this.model.y - this.radius - 16);
    }

    private drawAtmosphere (): void
    {
        this.atmosphere.clear().setPosition(this.sprite.x, this.sprite.y);
        for (let halo = 5; halo >= 1; halo--) {
            this.atmosphere.lineStyle(3, 0x72bfff, (6 - halo) * 0.035);
            this.atmosphere.strokeCircle(0, 0, this.radius + halo * 2);
        }
    }

    updateLandingIndicator (ship: SceneObject): void
    {
        this.indicator.setPosition(this.sprite.x, this.sprite.y).setRadius(this.radius + 6);
        const distance = Math.hypot(ship.sprite.x - this.sprite.x, ship.sprite.y - this.sprite.y);
        const available = canLandNearPlanet(distance, ship.radius, this.radius);
        this.indicator.setVisible(available);
        this.landingZone.setPosition(this.sprite.x, this.sprite.y)
            .setRadius(planetLandingRadius(this.radius, ship.radius)).setVisible(available);
        this.drawAtmosphere();
    }
}
