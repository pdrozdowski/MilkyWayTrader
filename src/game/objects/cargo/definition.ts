import { ObjectDepth } from '../../visual/layers';
import type { GameObjectDefinition } from '../_shared/types';

export const definition: GameObjectDefinition = {
    id: 'cargo',
    assets: [
        { kind: 'image', key: 'object:cargo:closed', path: 'icons/cargo_32x32.png' },
        { kind: 'image', key: 'object:cargo:open', path: 'icons/cargo_2_32x32.png' }
    ],
    animations: [],
    visual: { texture: 'object:cargo:closed', scale: 1, depth: ObjectDepth.Asteroid }
};
