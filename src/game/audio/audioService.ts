import { AudioScope } from './audioScope.ts';
import { validateSoundDefinitions } from './validate.ts';
import type { AudioBackend, AudioOwner, AudioSettings, AudioVoice, SettingsStorage, SoundDefinition } from './types';

export const AUDIO_SETTINGS_KEY = 'milky-way-trader.audio.v1';
const DEFAULT_SETTINGS: AudioSettings = { muted: false, masterVolume: 0.5 };

export class AudioService
{
    private readonly scopes = new Set<AudioScope>();
    private readonly listeners = new Set<(settings: Readonly<AudioSettings>) => void>();
    private readonly definitions: Map<string, SoundDefinition>;
    private readonly warned = new Set<string>();
    private readonly backend: AudioBackend;
    private readonly storage?: SettingsStorage;
    private settings: AudioSettings;
    private destroyed = false;
    suspended = false;

    constructor(backend: AudioBackend, definitions: readonly SoundDefinition[], storage?: SettingsStorage)
    {
        validateSoundDefinitions(definitions);
        this.backend = backend;
        this.definitions = new Map(definitions.map(definition => [definition.id, definition]));
        this.storage = storage;
        this.settings = this.readSettings();
        backend.applySettings(this.settings);
    }

    createScope(owner: AudioOwner): AudioScope
    {
        if (this.destroyed) throw new Error('Audio service has been destroyed.');
        const scope = new AudioScope(this, owner);
        this.scopes.add(scope);
        return scope;
    }

    getSettings(): Readonly<AudioSettings> { return { ...this.settings }; }
    setMuted(muted: boolean): void { this.changeSettings({ ...this.settings, muted }); }
    setMasterVolume(volume: number): void
    {
        if (Number.isFinite(volume)) this.changeSettings({ ...this.settings, masterVolume: Math.max(0, Math.min(1, volume)) });
    }

    subscribe(listener: (settings: Readonly<AudioSettings>) => void): () => void
    {
        if (this.destroyed) return () => {};
        this.listeners.add(listener);
        listener(this.getSettings());
        return () => { this.listeners.delete(listener); };
    }

    canPlay(): boolean
    {
        return !this.destroyed && !this.suspended && !this.settings.muted && this.settings.masterVolume > 0 && this.backend.canPlay();
    }

    definition(id: string): SoundDefinition | undefined
    {
        const definition = this.definitions.get(id);
        if (!definition) this.warnOnce(id, `Unknown sound: ${id}`);
        return definition;
    }

    addVoice(key: string): AudioVoice | null
    {
        try {
            const voice = this.backend.add(key);
            if (!voice) this.warnOnce(key, `Audio unavailable: ${key}`);
            return voice;
        } catch { this.warnOnce(key, `Audio unavailable: ${key}`); return null; }
    }

    removeVoice(voice: AudioVoice): void { this.backend.remove(voice); }
    releaseScope(scope: AudioScope): void { this.scopes.delete(scope); }

    suspend(): void
    {
        this.suspended = true;
        for (const scope of this.scopes) scope.silence();
    }

    resume(): void { this.suspended = false; }

    destroy(): void
    {
        if (this.destroyed) return;
        this.destroyed = true;
        for (const scope of this.scopes) scope.destroy();
        this.listeners.clear();
    }

    private changeSettings(settings: AudioSettings): void
    {
        if (this.destroyed) return;
        this.settings = settings;
        this.backend.applySettings(settings);
        if (settings.muted || settings.masterVolume === 0) for (const scope of this.scopes) scope.silence(false);
        try { this.storage?.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(settings)); } catch { /* Session settings still work. */ }
        for (const listener of this.listeners) listener(this.getSettings());
    }

    private readSettings(): AudioSettings
    {
        try {
            const saved = JSON.parse(this.storage?.getItem(AUDIO_SETTINGS_KEY) ?? 'null');
            if (saved && typeof saved.muted === 'boolean' && typeof saved.masterVolume === 'number' && Number.isFinite(saved.masterVolume)) {
                return { muted: saved.muted, masterVolume: Math.max(0, Math.min(1, saved.masterVolume)) };
            }
        } catch { /* Missing, corrupt, or inaccessible storage uses defaults. */ }
        return { ...DEFAULT_SETTINGS };
    }

    private warnOnce(key: string, message: string): void
    {
        if (!this.warned.has(key)) { this.warned.add(key); console.warn(message); }
    }
}
