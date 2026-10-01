import type { SoundDefinition } from '../types';

export const definition: SoundDefinition = {
    id: 'asteroid-fragment', key: 'audio:asteroid-fragment', paths: ['audio/asteroid-fragment/asteroid-fragment.wav'],
    category: 'sfx', mode: 'one-shot', gain: 0.36, maxVoices: 3,
    credit: { source: 'scripts/generate-demo-audio.mjs', author: 'MilkyWayTrader', license: 'MIT' }
};
