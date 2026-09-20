import { ObjectDepth } from '../../visual/layers';
import type { GameObjectDefinition } from '../_shared/types';

export const definition: GameObjectDefinition = {
    id: 'planet',
    assets: [{ kind: 'spritesheet', key: 'object:planet:sheet', path: 'objects/planet/spinning-surface.svg', frameWidth: 128, frameHeight: 128 }],
    animations: [{ key: 'object:planet:spin', frames: Array.from({ length: 12 }, (_, frame) => ({ key: 'object:planet:sheet', frame })), frameRate: 8, repeat: -1 }],
    visual: { texture: 'object:planet:sheet', scale: 1, depth: ObjectDepth.Planet, animation: 'object:planet:spin' },
    variants: { blue: {}, green: {}, amber: {} },
    physics: { kind: 'static', shape: { kind: 'circle', radius: 64 } }
};
