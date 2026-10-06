import type { SoundDefinition } from '../types';

export const definition: SoundDefinition = {
    id: 'item-collection-blocked', key: 'audio:item-collection-blocked', paths: ['audio/item_collection_blocked.wav'],
    category: 'sfx', mode: 'one-shot', gain: 0.5, maxVoices: 2,
    credit: { source: 'public/assets/audio/item_collection_blocked.wav', author: 'User supplied', license: 'User supplied' }
};
