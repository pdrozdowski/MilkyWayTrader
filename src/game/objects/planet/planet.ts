import { GameObjects, Math as PhaserMath, Scene } from 'phaser';
import { SceneObject } from '../_shared/sceneObject';
import { ObjectDepth } from '../../visual/layers';
import type { SceneObjectOptions } from '../_shared/types';
import type { PlanetState } from '../../state/planetState';
import { definition } from './definition';
import { canLandNearPlanet } from '../../mechanics/planet/proximity';

const SURFACE_FEATURE_COUNT = 32;
const PLANET_VISUAL_SCALE = 0.7;
const LANDING_WAVE_COUNT = 5;
const LANDING_WAVE_PERIOD_MS = 2_000;

interface SurfaceFeature {
    readonly position: PhaserMath.Vector2;
    readonly radiusXRatio: number;
    readonly radiusYRatio: number;
    readonly color: number;
    readonly alpha: number;
}

interface PlanetPalette {
    readonly baseColor: number;
    readonly features: readonly number[];
}

const palettes: Readonly<Record<string, PlanetPalette>> = {
    blue: { baseColor: 0x397fc1, features: [0x8fd3ff, 0x22558f, 0x6ca9dd, 0xd4f3ff] },
    green: { baseColor: 0x539f72, features: [0xa9d686, 0x2e7254, 0x76b76d, 0xe2f1c2] },
    amber: { baseColor: 0xc98336, features: [0xf5c56a, 0x925126, 0xdc9a48, 0xffe0a3] }
};

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
    private readonly surface: GameObjects.Graphics;
    private readonly shipOffset = new PhaserMath.Vector2();
    private readonly rotatedFeaturePosition = new PhaserMath.Vector2();
    private readonly surfaceFeatures: readonly SurfaceFeature[];
    private readonly palette: PlanetPalette;
    private readonly spinSpeed: number;
    private activeElapsedMs = 0;

    constructor (scene: Scene, options: PlanetOptions)
    {
        super(scene, definition, { ...options.model.position, depth: options.depth, variant: options.variant });
        this.id = options.model.id;
        this.sprite.setData('planetId', this.id).setVisible(false);
        this.setSize(options.model.radius * 2);
        this.palette = palettes[options.variant ?? 'blue'];
        this.spinSpeed = options.spinSpeed ?? 1;
        this.surfaceFeatures = createSurfaceFeatures(this.palette, options.model.radius);
        this.surface = scene.add.graphics().setDepth(ObjectDepth.Planet);
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
        this.ownCleanup(() => this.surface.destroy());
        this.ownCleanup(() => this.indicator.destroy());
        this.ownCleanup(() => this.landingZone.destroy());
        this.ownCleanup(() => this.atmosphere.destroy());
        this.ownCleanup(() => this.landingGuide.destroy());
        this.ownCleanup(() => this.landingLabel.destroy());
        this.ownCleanup(() => this.planetNameLabel.destroy());
        this.synchronize(options.model);
    }

    synchronize (state: PlanetState): void
    {
        super.setPosition(state.position.x, state.position.y);
        if (this.radius !== state.radius) super.setSize(state.radius * 2);
        this.updateLabel(state);
        this.drawPlanetSurface();
        this.drawAtmosphere();
    }

    update (activeElapsedMs: number): void
    {
        this.activeElapsedMs = activeElapsedMs;
        this.drawPlanetSurface();
        this.drawLandingGuide();
    }

    private updateLabel (state: PlanetState): void
    {
        const text = state.name.toUpperCase();
        if (this.planetNameLabel.text !== text) this.planetNameLabel.setText(text);
        this.landingLabel.setPosition(state.position.x, state.position.y - 12);
        this.planetNameLabel.setPosition(state.position.x, state.position.y + 12);
    }

    private get visualRadius (): number
    {
        return this.radius * PLANET_VISUAL_SCALE;
    }

    private drawPlanetSurface (): void
    {
        const radius = this.visualRadius;
        const angle = this.activeElapsedMs * this.spinSpeed * 0.000025;
        this.surface.clear().setPosition(this.sprite.x, this.sprite.y);
        this.surface.fillStyle(this.palette.baseColor).fillCircle(0, 0, radius);
        for (const feature of this.surfaceFeatures) {
            this.rotatedFeaturePosition.copy(feature.position).scale(PLANET_VISUAL_SCALE).rotate(angle);
            this.surface.fillStyle(feature.color, feature.alpha).fillEllipse(
                this.rotatedFeaturePosition.x,
                this.rotatedFeaturePosition.y,
                feature.radiusXRatio * radius * 2,
                feature.radiusYRatio * radius * 2
            );
        }
        this.surface.lineStyle(Math.max(2, radius * 0.025), 0xeaf8ff, 0.18).strokeCircle(0, 0, radius);
    }

    private drawAtmosphere (): void
    {
        this.atmosphere.clear().setPosition(this.sprite.x, this.sprite.y);
        for (let halo = 5; halo >= 1; halo--) {
            this.atmosphere.lineStyle(3, 0x72bfff, (6 - halo) * 0.035);
            this.atmosphere.strokeCircle(0, 0, this.visualRadius + halo * 2);
        }
    }

    private drawLandingGuide (): void
    {
        if (!this.landingGuide.visible) return;
        const cycle = this.activeElapsedMs / LANDING_WAVE_PERIOD_MS;
        const startRadius = 0;
        const endRadius = this.visualRadius * 0.75;
        this.landingGuide.clear().setPosition(this.sprite.x, this.sprite.y);
        for (let index = 0; index < LANDING_WAVE_COUNT; index++) {
            const phase = (cycle + index / LANDING_WAVE_COUNT) % 1;
            const radius = startRadius + (endRadius - startRadius) * phase;
            this.landingGuide.lineStyle(2, 0xc6efff, phase * 0.42).strokeCircle(0, 0, radius);
        }
    }

    updateLandingIndicator (ship: SceneObject): void
    {
        this.indicator.setPosition(this.sprite.x, this.sprite.y).setRadius(this.visualRadius);
        const distance = this.shipOffset.set(ship.sprite.x, ship.sprite.y).subtract(this.sprite).length();
        const available = canLandNearPlanet(distance, ship.radius, this.radius);
        this.indicator.setVisible(available);
        this.landingLabel.setVisible(available);
        this.planetNameLabel.setVisible(available);
        this.landingGuide.setVisible(available);
        this.landingZone.setPosition(this.sprite.x, this.sprite.y)
            .setRadius(this.visualRadius + 60).setVisible(available);
        this.drawLandingGuide();
    }
}

function createSurfaceFeatures (palette: PlanetPalette, radius: number): readonly SurfaceFeature[]
{
    return Array.from({ length: SURFACE_FEATURE_COUNT }, (_, index) => {
        const radiusXRatio = 0.05 + pseudoRandom(index, 1) * 0.09;
        const radiusYRatio = 0.035 + pseudoRandom(index, 2) * 0.07;
        const featureRadius = Math.max(radiusXRatio, radiusYRatio) * radius;
        const angle = pseudoRandom(index, 3) * Math.PI * 2;
        const distance = 0.08 * radius + pseudoRandom(index, 4) * (radius * 0.82 - featureRadius);
        return {
            position: new PhaserMath.Vector2(Math.cos(angle), Math.sin(angle)).scale(distance),
            radiusXRatio,
            radiusYRatio,
            color: palette.features[index % palette.features.length],
            alpha: 0.24 + pseudoRandom(index, 5) * 0.28
        };
    });
}

function pseudoRandom (index: number, salt: number): number
{
    const value = Math.sin(index * 91.345 + salt * 47.853) * 43758.5453;
    return value - Math.floor(value);
}
