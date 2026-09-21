import { Scene } from 'phaser';
import { Projectile } from '../projectile/projectile';
import type { ProjectileState } from '../../state/projectileState';
export { weaponTuning } from '../../definitions/gameplayTuning';

export class ShipWeapon
{
    private readonly projectiles = new Map<string, Projectile>();

    constructor (
        private readonly scene: Scene,
        private readonly onSpawn: (projectile: Projectile) => void
    )
    {
        scene.events.once('shutdown', this.destroy, this);
    }

    synchronize (states: readonly ProjectileState[]): void
    {
        const activeIds = new Set(states.map(state => state.id));
        for (const [id, projectile] of this.projectiles) if (!activeIds.has(id)) {
            projectile.destroy();
            this.projectiles.delete(id);
        }
        for (const state of states) {
            let projectile = this.projectiles.get(state.id);
            if (!projectile) {
                projectile = new Projectile(this.scene, state);
                this.projectiles.set(state.id, projectile);
                this.onSpawn(projectile);
            }
            projectile.synchronize(state);
        }
    }

    destroy (): void
    {
        for (const projectile of this.projectiles.values()) projectile.destroy();
        this.projectiles.clear();
        this.scene.events.off('shutdown', this.destroy, this);
    }
}
