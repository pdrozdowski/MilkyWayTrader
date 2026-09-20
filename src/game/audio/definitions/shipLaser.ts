import type { SoundDefinition } from '../types';

export const definition: SoundDefinition = {
    id: 'ship-laser', key: 'audio:ship-laser', paths: ['audio/ship-laser/laser-shot.wav'],
    category: 'sfx', mode: 'one-shot', gain: 0.45, maxVoices: 2,
    credit: { source: 'scripts/generate-demo-audio.mjs', author: 'MilkyWayTrader', license: 'MIT' }
};
