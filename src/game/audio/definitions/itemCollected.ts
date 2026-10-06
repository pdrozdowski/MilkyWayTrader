import type { SoundDefinition } from '../types';

export const definition: SoundDefinition = {
    id: 'item-collected', key: 'audio:item-collected', paths: ['audio/item-collected.wav'],
    category: 'sfx', mode: 'one-shot', gain: 0.5, maxVoices: 2,
    credit: { source: 'public/assets/audio/item-collected.wav', author: 'User supplied', license: 'User supplied' }
};
