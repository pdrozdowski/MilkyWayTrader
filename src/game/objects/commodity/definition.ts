import { ObjectDepth } from '../../visual/layers';
import type { GameObjectDefinition } from '../_shared/types';

export const definition: GameObjectDefinition = {
    id: 'commodity',
    assets: [
        { kind: 'image', key: 'object:commodity:milk', path: 'icons/commodity-milk-48x48.png' },
        { kind: 'image', key: 'object:commodity:grain', path: 'icons/commodity-grain_48x48.png' },
        { kind: 'image', key: 'object:commodity:cheese', path: 'icons/commodity-cheese-48x48.png' },
        { kind: 'image', key: 'object:commodity:bun', path: 'icons/commodity-bun_48x48.png' },
        { kind: 'image', key: 'object:commodity:spaceRation', path: 'icons/commodity-spaceRation-48x48.png' }
    ],
    animations: [],
    visual: { texture: 'object:commodity:milk', scale: 1, depth: ObjectDepth.Asteroid },
    variants: {
        milk: {},
        grain: { texture: 'object:commodity:grain' },
        cheese: { texture: 'object:commodity:cheese' },
        bun: { texture: 'object:commodity:bun' },
        spaceRation: { texture: 'object:commodity:spaceRation' }
    }
};
