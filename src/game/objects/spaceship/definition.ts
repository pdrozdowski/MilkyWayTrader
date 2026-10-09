import { ObjectDepth } from '../../visual/layers';
import { shipTuning } from '../../definitions/gameplayTuning.ts';
import type { GameObjectDefinition } from '../_shared/types';
export { shipBoostTuning, shipTuning } from '../../definitions/gameplayTuning';

// All artwork points up; the sprite rotates continuously to match velocity. The hull carries no
// exhaust, so nozzles and flames are drawn by the engine module for the purchased engine level.
export const shipFlameLengths = [7, 10, 13, 11, 8, 6];
export const shipFlameFrameRate = 18;
export const shipFrames = {
    hull: { key: 'object:spaceship:hull' },
    flameNormal: { key: 'object:spaceship:flame-normal' },
    flameHot: { key: 'object:spaceship:flame-hot' }
};

export const definition: GameObjectDefinition = {
    id: 'spaceship',
    assets: [
        { kind: 'image', key: shipFrames.hull.key, path: 'objects/spaceship/hull.svg' },
        { kind: 'image', key: shipFrames.flameNormal.key, path: 'objects/spaceship/flame-normal.svg' },
        { kind: 'image', key: shipFrames.flameHot.key, path: 'objects/spaceship/flame-hot.svg' }
    ],
    animations: [],
    visual: { texture: shipFrames.hull.key, scale: 1, depth: ObjectDepth.Ship },
    physics: { kind: 'dynamic', shape: { kind: 'circle', radius: shipTuning.collisionRadius }, bounce: 0.15, worldBounds: true }
};
