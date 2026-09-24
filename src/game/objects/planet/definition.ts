import { ObjectDepth } from '../../visual/layers';
import type { GameObjectDefinition } from '../_shared/types';

export const definition: GameObjectDefinition = {
    id: 'planet',
    assets: [{ kind: 'image', key: 'object:planet:physics-host', path: 'objects/planet/physics-host.svg' }],
    animations: [],
    visual: { texture: 'object:planet:physics-host', scale: 1, depth: ObjectDepth.Planet },
    variants: { blue: {}, green: {}, amber: {} },
    physics: { kind: 'static', shape: { kind: 'circle', radius: 64 } }
};
