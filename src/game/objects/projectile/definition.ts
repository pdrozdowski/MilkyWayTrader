import { ObjectDepth } from '../../visual/layers';
import type { GameObjectDefinition } from '../_shared/types';

export const definition: GameObjectDefinition = {
    id: 'projectile',
    assets: [{ kind: 'image', key: 'object:projectile:egg', path: 'objects/projectile/egg.svg' }],
    animations: [],
    visual: { texture: 'object:projectile:egg', scale: 1, depth: ObjectDepth.Projectile }
};

// Swept circle collision is handled by Projectile, avoiding Arcade tunneling.
export const projectileTuning = { lifetime: 20000, radius: 6 };
