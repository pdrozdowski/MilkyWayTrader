import type { SoundDefinition } from './types';

export function validateSoundDefinitions(definitions: readonly SoundDefinition[]): void
{
    const ids = new Set<string>();
    const keys = new Set<string>();
    for (const definition of definitions) {
        if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(definition.id) || definition.key !== `audio:${definition.id}`) {
            throw new Error(`Invalid sound ID/key: ${definition.id}`);
        }
        if (ids.has(definition.id) || keys.has(definition.key)) throw new Error(`Duplicate sound ID/key: ${definition.key}`);
        if (!['music', 'sfx'].includes(definition.category) || !['loop', 'one-shot'].includes(definition.mode) || !Number.isFinite(definition.gain)
            || definition.gain < 0 || definition.gain > 1 || !Number.isInteger(definition.maxVoices) || definition.maxVoices < 1) {
            throw new Error(`Invalid sound playback settings: ${definition.id}`);
        }
        if (!definition.paths.length || definition.paths.some(path => !path.startsWith(`audio/${definition.id}/`)
            || path.includes('..') || path.includes('\\'))) throw new Error(`Invalid sound asset paths: ${definition.id}`);
        if (!definition.credit.source || !definition.credit.author || !definition.credit.license) {
            throw new Error(`Missing sound provenance: ${definition.id}`);
        }
        ids.add(definition.id);
        keys.add(definition.key);
    }
}
