import { GameObjects, Scene } from 'phaser';
import { asteroidBeltDefinition } from '../definitions/asteroidBeltDefinition';
import { ObjectDepth } from '../visual/layers';
import { asteroidBeltLayout, projectAsteroidBelt } from '../visual/asteroidBelt';

export class AsteroidBelt
{
    private readonly sprites: readonly GameObjects.Image[];

    constructor (private readonly scene: Scene)
    {
        const scale = asteroidBeltDefinition.asteroidRadius * 2 / 600;
        this.sprites = asteroidBeltLayout.map(asteroid => scene.add.image(0, 0, `asteroid:${asteroid.type}`)
            .setScale(scale).setRotation(asteroid.rotationRadians).setDepth(ObjectDepth.AsteroidBelt));
        scene.events.once('shutdown', this.destroy, this);
    }

    update (activeElapsedMs: number): void
    {
        const positions = projectAsteroidBelt(activeElapsedMs);
        for (let index = 0; index < positions.length; index++) this.sprites[index].setPosition(positions[index].x, positions[index].y);
    }

    destroy (): void
    {
        this.scene.events.off('shutdown', this.destroy, this);
        for (const sprite of this.sprites) sprite.destroy();
    }
}
