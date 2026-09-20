import type { AudioOwner, AudioVoice, LoopOptions, SoundDefinition } from './types';
import type { AudioService } from './audioService';

export const ENGINE_CROSSFADE_MS = 120;
type VoiceSlot = { voice: AudioVoice; kind: 'idle' | 'one-shot' | 'loop' };
type LoopEntry = { id: string; slot: VoiceSlot; volume: number; rate: number };
type Channel = { id: string | null; options: LoopOptions; entries: LoopEntry[] };

export class AudioScope
{
    private readonly pools = new Map<string, VoiceSlot[]>();
    private readonly channels = new Map<string, Channel>();
    private paused = false;
    private destroyed = false;
    private readonly service: AudioService;
    private readonly owner: AudioOwner;

    constructor(service: AudioService, owner: AudioOwner)
    {
        this.service = service;
        this.owner = owner;
        for (const event of ['shutdown', 'destroy']) owner.events.on(event, this.destroy);
        for (const event of ['pause', 'sleep']) owner.events.on(event, this.pause);
        for (const event of ['resume', 'wake']) owner.events.on(event, this.resume);
    }

    play(id: string): boolean
    {
        if (!this.canPlay()) return false; // Never queue shots while locked, muted or inactive.
        const definition = this.service.definition(id);
        if (!definition || definition.mode !== 'one-shot') return false;
        const slot = this.acquire(definition);
        if (!slot) return false;
        slot.kind = 'one-shot';
        if (!slot.voice.play({ loop: false, volume: definition.gain, rate: 1 })) {
            slot.kind = 'idle';
            return false;
        }
        return true;
    }

    setLoop(channelName: string, id: string | null, options: LoopOptions = {}): void
    {
        if (this.destroyed || this.paused || this.service.suspended) return;
        if (id && this.service.definition(id)?.mode !== 'loop') return;
        let channel = this.channels.get(channelName);
        if (!channel) {
            channel = { id: null, options: {}, entries: [] };
            this.channels.set(channelName, channel);
        }
        channel.id = id;
        // Copy rather than retain callers' mutable settings.
        channel.options = { rate: options.rate, volume: options.volume };
    }

    update(delta: number): void
    {
        if (this.destroyed) return;
        if (!this.canPlay()) { this.silence(false); return; }
        const step = Math.max(0, Math.min(delta, ENGINE_CROSSFADE_MS)) / ENGINE_CROSSFADE_MS;
        for (const channel of this.channels.values()) {
            if (channel.id && !channel.entries.some(entry => entry.id === channel.id)) {
                const definition = this.service.definition(channel.id)!;
                const slot = this.acquire(definition);
                if (slot) {
                    const rate = bounded(channel.options.rate, 1, 0.1, 4);
                    slot.kind = 'loop';
                    if (slot.voice.play({ loop: true, volume: 0, rate })) {
                        channel.entries.push({ id: channel.id, slot, volume: 0, rate });
                    } else slot.kind = 'idle';
                }
            }
            for (let i = channel.entries.length - 1; i >= 0; i--) {
                const entry = channel.entries[i];
                const definition = this.service.definition(entry.id)!;
                const wanted = entry.id === channel.id;
                const target = wanted ? definition.gain * bounded(channel.options.volume, 1, 0, 1) : 0;
                const change = definition.gain * step;
                entry.volume = target > entry.volume ? Math.min(target, entry.volume + change) : Math.max(target, entry.volume - change);
                entry.slot.voice.setVolume(entry.volume);
                if (wanted) {
                    const rate = bounded(channel.options.rate, 1, 0.1, 4);
                    if (rate !== entry.rate) { entry.slot.voice.setRate(rate); entry.rate = rate; }
                }
                if (!wanted && entry.volume === 0) {
                    entry.slot.voice.stop();
                    entry.slot.kind = 'idle';
                    channel.entries.splice(i, 1);
                }
            }
        }
    }

    /** Hard silence is used for mute/focus loss; it cannot leave tails playing off-scene. */
    silence(clearIntents = true): void
    {
        for (const pool of this.pools.values()) for (const slot of pool) {
            if (slot.kind !== 'idle') slot.voice.stop();
            slot.kind = 'idle';
        }
        for (const channel of this.channels.values()) {
            channel.entries.length = 0;
            if (clearIntents) channel.id = null;
        }
    }

    private canPlay(): boolean
    {
        return !this.destroyed && !this.paused && this.service.canPlay();
    }

    private acquire(definition: SoundDefinition): VoiceSlot | null
    {
        let pool = this.pools.get(definition.id);
        if (!pool) { pool = []; this.pools.set(definition.id, pool); }
        for (const slot of pool) {
            if (slot.kind === 'one-shot' && !slot.voice.isPlaying) slot.kind = 'idle';
            if (slot.kind === 'idle') return slot;
        }
        if (pool.length >= definition.maxVoices) return null;
        const voice = this.service.addVoice(definition.key);
        if (!voice) return null;
        const slot: VoiceSlot = { voice, kind: 'idle' };
        pool.push(slot);
        return slot;
    }

    private readonly pause = (): void => { this.paused = true; this.silence(); };
    private readonly resume = (): void => { this.paused = false; };

    readonly destroy = (): void => {
        if (this.destroyed) return;
        this.destroyed = true;
        this.silence();
        for (const pool of this.pools.values()) for (const slot of pool) this.service.removeVoice(slot.voice);
        this.pools.clear();
        this.channels.clear();
        for (const event of ['shutdown', 'destroy']) this.owner.events.off(event, this.destroy);
        for (const event of ['pause', 'sleep']) this.owner.events.off(event, this.pause);
        for (const event of ['resume', 'wake']) this.owner.events.off(event, this.resume);
        this.service.releaseScope(this);
    };
}

function bounded(value: number | undefined, fallback: number, min: number, max: number): number
{
    return value === undefined || !Number.isFinite(value) ? fallback : Math.max(min, Math.min(max, value));
}
