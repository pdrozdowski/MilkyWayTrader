import { ObjectDepth } from '../../visual/layers';
import type { GameObjectDefinition } from '../_shared/types';

// All artwork points up; the sprite rotates continuously to match velocity.
export const shipTuning = { maxSpeed: 240, accelerationSeconds: 1, stoppingSeconds: 0.5 };
export const shipBoostTuning = {
    speedMultiplier: 5, accelerationSeconds: 1, flameLengthMultiplier: 5,
    flameColor: 0x65dcff, cameraZoom: 0.78, cameraTransitionSeconds: 0.25,
    trailLifetime: 300
};
export const shipFlameLengths = [7, 10, 13, 11, 8, 6];
export const shipFrames = {
    off: { key: 'object:spaceship:engines-off' },
    on: { key: 'object:spaceship:engine-on-sequence' }
};
export const shipEngineAnimation = 'object:spaceship:engine-fire';

export const definition: GameObjectDefinition = {
    id: 'spaceship',
    assets: [
        { kind: 'image', key: shipFrames.off.key, path: 'objects/spaceship/engines-off.svg' },
        { kind: 'spritesheet', key: shipFrames.on.key, path: 'objects/spaceship/engine-on-sequence.svg', frameWidth: 64, frameHeight: 64 }
    ],
    animations: [{
        key: shipEngineAnimation,
        frames: Array.from({ length: 6 }, (_, frame) => ({ key: shipFrames.on.key, frame })),
        frameRate: 18,
        repeat: -1
    }],
    visual: { texture: shipFrames.off.key, scale: 2, depth: ObjectDepth.Ship },
    physics: { kind: 'dynamic', shape: { kind: 'circle', radius: 18 }, bounce: 0.15, worldBounds: true }
};
