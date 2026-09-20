import type { Scene } from 'phaser';
import type { SoundDefinition } from './types';
import { validateSoundDefinitions } from './validate';

const modules = import.meta.glob<SoundDefinition>('./definitions/*.ts', { eager: true, import: 'definition' });
export const soundDefinitions = Object.values(modules);
validateSoundDefinitions(soundDefinitions);

export function loadSoundAssets(scene: Scene): void
{
    for (const definition of soundDefinitions) {
        if (!scene.cache.audio.exists(definition.key)) scene.load.audio(definition.key, [...definition.paths]);
    }
}
