import { Scene } from 'phaser';
import type { CircleObstacle } from '../../world/geometry';
import { Projectile } from '../projectile/projectile';
import { projectileTuning } from '../projectile/definition';
import { shotTrajectory } from '../../mechanics/projectile/trajectory';
import type { Spaceship } from './spaceship';
import { FireCadence } from '../../mechanics/spaceship/fireCadence';

export const weaponTuning = {
    shotsPerSecond: 3,
    projectileSpeed: 400,
    noseOffset: 25
};

export class ShipWeapon
{
    readonly projectiles = new Set<Projectile>();
    private firing = false;
    private readonly cadence = new FireCadence(1000 / weaponTuning.shotsPerSecond);

    constructor (
        private readonly scene: Scene,
        private readonly ship: Spaceship,
        private readonly obstacles: readonly CircleObstacle[],
        private readonly onSpawn: (projectile: Projectile) => void
    )
    {
        scene.events.once('shutdown', this.destroy, this);
    }

    setFiring (firing: boolean): void
    {
        this.firing = firing;
    }

    update (time: number, delta: number): void
    {
        for (const projectile of this.projectiles) projectile.advance(time, delta, this.obstacles);
        if (!this.cadence.shouldFire(time, this.firing && !this.ship.boosting)) return;
        const trajectory = shotTrajectory(this.ship.sprite, this.ship.sprite.rotation,
            weaponTuning.noseOffset * this.ship.sprite.scaleX + projectileTuning.radius + 1, weaponTuning.projectileSpeed);
        const projectile = new Projectile(this.scene, {
            ...trajectory.start, velocity: trajectory.velocity, bornAt: time,
            onDestroy: () => this.projectiles.delete(projectile)
        });
        this.projectiles.add(projectile);
        this.onSpawn(projectile);
        projectile.advance(time, 0, this.obstacles);
    }

    destroy (): void
    {
        this.firing = false;
        for (const projectile of this.projectiles) projectile.destroy();
        this.projectiles.clear();
        this.scene.events.off('shutdown', this.destroy, this);
    }
}
