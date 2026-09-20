import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// Original MIT-licensed demo effects. Deterministic, offline, no runtime synthesis.
export const SAMPLE_RATE = 44100;
export const LASER_PITCH_MULTIPLIER = 1.6;
const OUTPUT_FILENAMES = {
    'ship-laser': 'laser-shot.wav',
    'ship-engine': 'engine-loop.wav',
    'ship-booster': 'booster-loop.wav'
};

export function encodeWav(samples) {
    const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
    const centered = samples.map(value => value - mean);
    const peak = centered.reduce((max, value) => Math.max(max, Math.abs(value)), 0) || 1;
    const wav = Buffer.alloc(44 + centered.length * 2);
    wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVE', 8);
    wav.write('fmt ', 12); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20);
    wav.writeUInt16LE(1, 22); wav.writeUInt32LE(SAMPLE_RATE, 24);
    wav.writeUInt32LE(SAMPLE_RATE * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
    wav.write('data', 36); wav.writeUInt32LE(centered.length * 2, 40);
    centered.forEach((value, index) => wav.writeInt16LE(Math.round(value / peak * 0.6 * 32767), 44 + index * 2));
    return wav;
}

export function generateEffects() {
    const tau = 2 * Math.PI;
    const laser = Array.from({ length: Math.round(SAMPLE_RATE * 0.18) }, (_, i) => {
        const t = i / SAMPLE_RATE;
        // Falling chirp, quick attack and smooth release: a short, unmistakable pew.
        const phase = tau * LASER_PITCH_MULTIPLIER * (1350 * t - 520 / 0.18 * t * t);
        const envelope = Math.min(1, t / 0.003) * Math.pow(1 - t / 0.18, 2.4);
        return (Math.sin(phase) + 0.2 * Math.sin(phase * 2)) * envelope;
    });
    const length = SAMPLE_RATE * 2;
    const engine = Array.from({ length }, (_, i) => {
        const t = i / SAMPLE_RATE;
        const pulse = 0.68 + 0.2 * Math.sin(tau * 27 * t) + 0.12 * Math.sin(tau * 54 * t);
        return pulse * (Math.sin(tau * 62 * t) + 0.45 * Math.sin(tau * 124 * t)
            + 0.18 * Math.sin(tau * 186 * t) + 0.1 * Math.sin(tau * 310 * t));
    });
    // Periodic noise from deterministic Fourier components. Every frequency fits the
    // two-second loop, so the seam is continuous even when playback rate changes.
    const booster = Array(length).fill(0);
    let seed = 1729;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
    for (let band = 0; band < 110; band++) {
        const frequency = Math.round((180 + random() * 2600) * 2) / 2;
        const phase = random() * tau;
        const amplitude = 1 / (1 + frequency / 1300);
        for (let i = 0; i < length; i++) booster[i] += amplitude * Math.sin(tau * frequency * i / SAMPLE_RATE + phase);
    }
    for (let i = 0; i < length; i++) {
        const t = i / SAMPLE_RATE;
        booster[i] = booster[i] * (0.9 + 0.1 * Math.sin(tau * 3 * t)) + 2 * Math.sin(tau * 380 * t);
    }
    return { 'ship-laser': encodeWav(laser), 'ship-engine': encodeWav(engine), 'ship-booster': encodeWav(booster) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
    for (const [id, wav] of Object.entries(generateEffects())) {
        const directory = new URL(`../public/assets/audio/${id}/`, import.meta.url);
        await mkdir(directory, { recursive: true });
        await writeFile(new URL(OUTPUT_FILENAMES[id], directory), wav);
        console.log(`${id}: ${wav.length} bytes`);
    }
}
