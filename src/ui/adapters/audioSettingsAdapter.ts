import type { Game } from 'phaser';
import { getAudioService } from '../../game/audio/gameAudio';
import type { AudioSettingsPort } from '../contracts';

export function createAudioSettingsPort (game: Game): AudioSettingsPort
{
    const service = getAudioService(game);
    return {
        getSettings: () => service.getSettings(),
        subscribe: listener => service.subscribe(listener),
        setMuted: muted => service.setMuted(muted),
        setMasterVolume: volume => service.setMasterVolume(volume)
    };
}
