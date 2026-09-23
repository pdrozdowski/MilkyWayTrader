import { GameObjects, Math as PhaserMath, Scene } from 'phaser';
import { SceneObject } from '../_shared/sceneObject';
import { ObjectDepth } from '../../visual/layers';
import type { SceneObjectOptions } from '../_shared/types';
import type { PlanetState } from '../../state/planetState';
import { definition } from './definition';
import { canLandNearPlanet, planetLandingRadius } from '../../mechanics/planet/proximity';

export interface PlanetOptions extends Omit<SceneObjectOptions, 'x' | 'y' | 'size'> {
    model: PlanetState;
    spinSpeed?: number;
    debugInfo?: boolean;
}

export class Planet extends SceneObject
{
    readonly indicator: GameObjects.Arc;
    readonly landingZone: GameObjects.Arc;
    readonly atmosphere: GameObjects.Graphics;
    readonly id: string;
    readonly debugLabel: GameObjects.Text;
    private readonly shipOffset = new PhaserMath.Vector2();

    constructor (scene: Scene, options: PlanetOptions)
    {
        super(scene, definition, { ...options.model.position, depth: options.depth, variant: options.variant });
        this.id = options.model.id;
        this.sprite.setData('planetId', this.id);
        this.setSize(options.model.radius * 2);
        const tints: Record<string, number> = { blue: 0x7acfff, green: 0x99e8ab, amber: 0xffcb80 };
        this.sprite.setTint(tints[options.variant ?? 'blue']);
        this.sprite.anims.timeScale = options.spinSpeed ?? 1;
        this.indicator = scene.add.circle(options.model.position.x, options.model.position.y, this.radius + 6)
            .setStrokeStyle(2, 0x9be0ff).setDepth(ObjectDepth.Indicator).setVisible(false);
        this.landingZone = scene.add.circle(options.model.position.x, options.model.position.y, 1)
            .setFillStyle(0x4e9bd9, 0.035).setStrokeStyle(1.5, 0x78c9fa, 0.4)
            .setDepth(ObjectDepth.Planet - 2).setVisible(false);
        this.atmosphere = scene.add.graphics().setDepth(ObjectDepth.Planet - 1);
        this.debugLabel = scene.add.text(options.model.position.x, options.model.position.y, '', {
            fontFamily: 'monospace', fontSize: 14, color: '#bee0ff', align: 'center',
            backgroundColor: '#091421', padding: { x: 6, y: 4 }
        }).setOrigin(0.5, 1).setDepth(ObjectDepth.Indicator).setVisible(options.debugInfo ?? true);
        this.ownCleanup(() => this.indicator.destroy());
        this.ownCleanup(() => this.landingZone.destroy());
        this.ownCleanup(() => this.atmosphere.destroy());
        this.ownCleanup(() => this.debugLabel.destroy());
        this.drawAtmosphere();
        this.synchronize(options.model);
    }

    synchronize (state: PlanetState): void
    {
        super.setPosition(state.position.x, state.position.y);
        if (this.radius !== state.radius) super.setSize(state.radius * 2);
        this.updateDebugLabel(state);
    }

    private updateDebugLabel (state: PlanetState): void
    {
        const text = state.name;
        if (this.debugLabel.text !== text) this.debugLabel.setText(text);
        this.debugLabel.setPosition(state.position.x, state.position.y - this.radius - 16);
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
        const distance = this.shipOffset.set(ship.sprite.x, ship.sprite.y).subtract(this.sprite).length();
        const available = canLandNearPlanet(distance, ship.radius, this.radius);
        this.indicator.setVisible(available);
        this.landingZone.setPosition(this.sprite.x, this.sprite.y)
            .setRadius(planetLandingRadius(this.radius, ship.radius)).setVisible(available);
        this.drawAtmosphere();
    }
}
