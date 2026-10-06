import { ObjectDepth } from '../../visual/layers';
import type { GameObjectDefinition } from '../_shared/types';

export const definition: GameObjectDefinition = {
    id: 'commodity',
    assets: [
        { kind: 'image', key: 'object:commodity:supplies', path: 'icons/commodity-supplies-placeholder_32x32.png' },
        { kind: 'image', key: 'object:commodity:alloys', path: 'icons/commodity-alloys-placeholder_32x32.png' },
        { kind: 'image', key: 'object:commodity:medicines', path: 'icons/commodity-medicines-placeholder_32x32.png' }
    ],
    animations: [],
    visual: { texture: 'object:commodity:supplies', scale: 1, depth: ObjectDepth.Asteroid },
    variants: {
        supplies: {},
        alloys: { texture: 'object:commodity:alloys' },
        medicines: { texture: 'object:commodity:medicines' }
    }
};
