import type { SoundDefinition } from '../types';

export const definition: SoundDefinition = {
    id: 'ship-booster', key: 'audio:ship-booster', paths: ['audio/ship-booster/booster-loop.wav'],
    category: 'sfx', mode: 'loop', gain: 0.30, maxVoices: 1,
    credit: { source: 'scripts/generate-demo-audio.mjs', author: 'MilkyWayTrader', license: 'MIT' }
};
