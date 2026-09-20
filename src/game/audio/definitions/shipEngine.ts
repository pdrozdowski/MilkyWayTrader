import type { SoundDefinition } from '../types';

export const definition: SoundDefinition = {
    id: 'ship-engine', key: 'audio:ship-engine', paths: ['audio/ship-engine/engine-loop.wav'],
    category: 'sfx', mode: 'loop', gain: 0.55, maxVoices: 1,
    credit: { source: 'scripts/generate-demo-audio.mjs', author: 'MilkyWayTrader', license: 'MIT' }
};
