import { ObjectDepth } from '../../visual/layers';
import type { GameObjectDefinition } from '../_shared/types';

export const definition: GameObjectDefinition = {
    id: 'sun',
    assets: [{ kind: 'image', key: 'object:sun:surface', path: 'objects/sun/surface.svg' }],
    animations: [],
    visual: { texture: 'object:sun:surface', scale: 1, depth: ObjectDepth.Sun },
    physics: { kind: 'static', shape: { kind: 'circle', radius: 128 } }
};
