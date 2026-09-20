import { Sound } from 'phaser';
import type { Game } from 'phaser';
import { AudioService } from './audioService';
import { soundDefinitions } from './registry';
import type { AudioVoice, SettingsStorage } from './types';

const SERVICE_KEY = 'audioService';

export function getAudioService(game: Game): AudioService
{
    const service = game.registry.get(SERVICE_KEY) as AudioService | undefined;
    if (!service) throw new Error('Audio service must be initialized during postBoot.');
    return service;
}

export function initializeGameAudio(game: Game): void
{
    let storage: SettingsStorage | undefined;
    try { storage = window.localStorage; } catch { /* Private browsing may deny storage. */ }
    const manager = game.sound;
    const service = new AudioService({
        canPlay: () => !(manager instanceof Sound.NoAudioSoundManager) && !manager.locked
            && (!(manager instanceof Sound.WebAudioSoundManager) || manager.context.state === 'running'),
        add: key => game.cache.audio.exists(key) ? manager.add(key) as unknown as AudioVoice : null,
        remove: voice => { manager.remove(voice as unknown as Sound.BaseSound); },
        applySettings: settings => { manager.setMute(settings.muted); manager.setVolume(settings.masterVolume); }
    }, soundDefinitions, storage);
    game.registry.set(SERVICE_KEY, service);
    const suspendedReasons = new Set<string>();
    const blur = (): void => { suspendedReasons.add('blur'); service.suspend(); };
    const hidden = (): void => { suspendedReasons.add('hidden'); service.suspend(); };
    const restore = (reason: string): void => { suspendedReasons.delete(reason); if (!suspendedReasons.size) service.resume(); };
    const focus = (): void => restore('blur');
    const visible = (): void => restore('hidden');
    game.events.on('blur', blur);
    game.events.on('hidden', hidden);
    game.events.on('focus', focus);
    game.events.on('visible', visible);
    game.events.once('destroy', () => {
        service.destroy();
        game.events.off('blur', blur);
        game.events.off('hidden', hidden);
        game.events.off('focus', focus);
        game.events.off('visible', visible);
        game.registry.remove(SERVICE_KEY);
    });
}
