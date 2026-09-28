import { GameObjects, Scene } from 'phaser';
import { createOrbitalPathDashes } from '../visual/orbitalPaths.ts';
import { ObjectDepth } from '../visual/layers.ts';

export class OrbitalPaths
{
    private readonly graphics: GameObjects.Graphics;

    constructor (private readonly scene: Scene)
    {
        this.graphics = scene.add.graphics().setDepth(ObjectDepth.OrbitalPaths);
        this.graphics.lineStyle(2, 0x5c86a8, 0.45);
        for (const dash of createOrbitalPathDashes()) {
            this.graphics.lineBetween(
                dash.centre.x + Math.cos(dash.startRadians) * dash.radius,
                dash.centre.y - Math.sin(dash.startRadians) * dash.radius,
                dash.centre.x + Math.cos(dash.endRadians) * dash.radius,
                dash.centre.y - Math.sin(dash.endRadians) * dash.radius
            );
        }
        scene.events.once('shutdown', this.destroy, this);
    }

    destroy (): void
    {
        this.scene.events.off('shutdown', this.destroy, this);
        this.graphics.destroy();
    }
}
