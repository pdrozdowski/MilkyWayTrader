import type { SoundDefinition } from '../types';

export const definition: SoundDefinition = {
    id: 'ship-asteroid-crash', key: 'audio:ship-asteroid-crash', paths: ['audio/ship-asteroid-crash/ship-asteroid-crash.wav'],
    category: 'sfx', mode: 'one-shot', gain: 0.48, maxVoices: 2,
    credit: { source: 'scripts/generate-demo-audio.mjs', author: 'MilkyWayTrader', license: 'MIT' }
};
