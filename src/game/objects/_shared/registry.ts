import type { Scene } from 'phaser';
import type { GameObjectDefinition } from './types';

const modules = import.meta.glob<GameObjectDefinition>('../*/definition.ts', { eager: true, import: 'definition' });
export const objectDefinitions = Object.values(modules);

function validateDefinitions (): void
{
    const ids = new Set<string>();
    const keys = new Set<string>();
    for (const definition of objectDefinitions) {
        if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(definition.id) || ids.has(definition.id)) throw new Error(`Invalid or duplicate object ID: ${definition.id}`);
        ids.add(definition.id);
        for (const item of [...definition.assets, ...definition.animations]) {
            if (!item.key.startsWith(`object:${definition.id}:`) || keys.has(item.key)) throw new Error(`Invalid or duplicate object key: ${item.key}`);
            keys.add(item.key);
        }
    }
}

export function loadObjectAssets (scene: Scene): void
{
    validateDefinitions();
    for (const definition of objectDefinitions) {
        for (const asset of definition.assets) {
            if (scene.textures.exists(asset.key)) continue;
            if (asset.kind === 'image') scene.load.image(asset.key, asset.path);
            else if (asset.kind === 'atlas') scene.load.atlas(asset.key, asset.path, asset.dataPath);
            else scene.load.spritesheet(asset.key, asset.path, { frameWidth: asset.frameWidth, frameHeight: asset.frameHeight });
        }
    }
}

export function registerObjectAnimations (scene: Scene): void
{
    for (const definition of objectDefinitions) {
        for (const animation of definition.animations) {
            if (!scene.anims.exists(animation.key)) scene.anims.create(animation);
        }
    }
}
