import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EventEmitter } from 'node:events';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import ts from 'typescript';
import { AudioService, AUDIO_SETTINGS_KEY } from '../src/game/audio/audioService.ts';
import { updateShipAudio } from '../src/game/audio/shipAudio.ts';
import { validateSoundDefinitions } from '../src/game/audio/validate.ts';
import { definition as laser } from '../src/game/audio/definitions/shipLaser.ts';
import { definition as engine } from '../src/game/audio/definitions/shipEngine.ts';
import { definition as booster } from '../src/game/audio/definitions/shipBooster.ts';
import { FireCadence } from '../src/game/mechanics/spaceship/fireCadence.ts';
import { shotTrajectory } from '../src/game/mechanics/projectile/trajectory.ts';
import { validateWav } from '../.agents/skills/utils-add-sound/scripts/scaffold.mjs';
import { generateEffects } from '../scripts/generate-demo-audio.mjs';

const definitions = [laser, engine, booster];
function fixture(storage) {
    const owner = { events: new EventEmitter() };
    const voices = [];
    const removed = [];
    const backend = {
        unlocked: true, missing: false, settings: null,
        canPlay() { return this.unlocked; },
        add(key) {
            if (this.missing) return null;
            const voice = {
                key, isPlaying: false, plays: [], stops: 0, volume: 0, rate: 1,
                play(config) { this.isPlaying = true; this.plays.push(config); this.volume = config.volume; this.rate = config.rate; return true; },
                stop() { this.isPlaying = false; this.stops++; },
                setVolume(volume) { this.volume = volume; },
                setRate(rate) { this.rate = rate; }
            };
            voices.push(voice);
            return voice;
        },
        remove(voice) { removed.push(voice); },
        applySettings(settings) { this.settings = { ...settings }; }
    };
    const service = new AudioService(backend, definitions, storage);
    const scope = service.createScope(owner);
    return { owner, backend, voices, removed, service, scope };
}

test('engine updates reuse loops, crossfade, reverse cleanly and silence coasting', () => {
    const { scope, voices } = fixture();
    const thrust = { enginesOn: true, boosting: false };
    for (let i = 0; i < 100; i++) updateShipAudio(scope, thrust, i * 3, 240, 5, 16);
    assert.equal(voices.length, 1);
    assert.equal(voices[0].plays.length, 1, 'frame updates must not restart engine audio');
    assert.equal(voices[0].rate, 1.15);
    assert.equal(voices[0].volume, engine.gain);
    updateShipAudio(scope, { ...thrust, boosting: true }, 720, 240, 5, 60);
    assert.equal(voices.length, 2);
    assert(Math.abs(voices[0].volume - engine.gain / 2) < 1e-9);
    assert(Math.abs(voices[1].volume - booster.gain / 2) < 1e-9);
    assert.equal(voices[1].rate, 1.15);
    updateShipAudio(scope, thrust, 120, 240, 5, 60);
    assert.equal(voices[0].plays.length, 1, 'reversing a crossfade should reuse the still-playing engine');
    assert.equal(voices[1].isPlaying, false);
    updateShipAudio(scope, { ...thrust, boosting: true }, 2000, 240, 5, 120);
    assert.equal(voices.length, 2, 'mode switches reuse the same bounded voices');
    assert.equal(voices[1].rate, 1.3);
    assert.equal(voices[0].isPlaying, false);
    updateShipAudio(scope, { enginesOn: false, boosting: false }, 800, 240, 5, 120);
    assert(voices.every(voice => !voice.isPlaying));
});

test('one-shots have a bounded pool and completed voices are reused', () => {
    const { scope, voices } = fixture();
    assert(scope.play(laser.id));
    assert(scope.play(laser.id));
    assert.equal(scope.play(laser.id), false);
    assert.equal(voices.length, 2);
    voices[0].isPlaying = false;
    assert(scope.play(laser.id));
    assert.equal(voices.length, 2);
    assert.equal(voices[0].plays.length, 2);
});

test('lock, mute and zero volume drop shots, while loops use the latest state on recovery', () => {
    const { scope, service, backend, voices } = fixture();
    backend.unlocked = false;
    scope.setLoop('engine', engine.id);
    assert.equal(scope.play(laser.id), false);
    scope.update(120);
    scope.setLoop('engine', booster.id, { rate: 1.2 });
    backend.unlocked = true;
    scope.update(120);
    assert.equal(voices.length, 1);
    assert.equal(voices[0].key, booster.key, 'unlock must not resurrect the earlier normal-engine state');
    assert.equal(voices[0].plays.length, 1, 'discarded laser shot must not be replayed');
    service.setMuted(true);
    assert.equal(voices[0].isPlaying, false);
    assert.equal(scope.play(laser.id), false);
    scope.setLoop('engine', null);
    service.setMuted(false);
    scope.update(120);
    assert.equal(voices[0].plays.length, 1, 'muting does not retain an obsolete engine state');
    service.setMasterVolume(0);
    assert.equal(scope.play(laser.id), false);
    scope.setLoop('engine', engine.id);
    scope.update(120);
    service.setMasterVolume(0.5);
    scope.update(120);
    assert.equal(voices.length, 2);
    assert.equal(voices[1].key, engine.key);
});

test('focus loss and scene pause/sleep stop playback; shutdown removes owned resources exactly once', () => {
    const { scope, service, owner, voices, removed } = fixture();
    scope.setLoop('engine', engine.id);
    scope.update(120);
    scope.play(laser.id);
    service.suspend();
    assert(voices.every(voice => !voice.isPlaying));
    assert.equal(scope.play(laser.id), false);
    service.resume();
    scope.update(120);
    assert(voices.every(voice => !voice.isPlaying), 'focus restore must wait for authoritative loop state');
    for (const [pause, resume] of [['pause', 'resume'], ['sleep', 'wake']]) {
        scope.setLoop('engine', engine.id);
        scope.update(120);
        owner.events.emit(pause);
        assert(voices.every(voice => !voice.isPlaying));
        scope.setLoop('engine', booster.id);
        assert.equal(scope.play(laser.id), false);
        owner.events.emit(resume);
        scope.update(120);
        assert(voices.every(voice => !voice.isPlaying));
    }
    owner.events.emit('shutdown');
    scope.destroy();
    owner.events.emit('destroy');
    service.destroy();
    service.destroy();
    assert.equal(removed.length, voices.length);
    assert.equal(new Set(removed).size, removed.length);
    assert.equal(owner.events.eventNames().length, 0);
    assert.equal(scope.play(laser.id), false);
});

test('preferences persist, clamp safely, notify controls and survive invalid/inaccessible storage', () => {
    const values = new Map();
    const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
    const { service, backend } = fixture(storage);
    const updates = [];
    const unsubscribe = service.subscribe(settings => updates.push(settings));
    service.setMasterVolume(0.8);
    service.setMuted(true);
    assert.deepEqual(backend.settings, { muted: true, masterVolume: 0.8 });
    assert.deepEqual(fixture(storage).service.getSettings(), backend.settings);
    unsubscribe();
    service.setMuted(false);
    assert.equal(updates.length, 3);
    values.set(AUDIO_SETTINGS_KEY, '{broken');
    assert.deepEqual(fixture(storage).service.getSettings(), { muted: false, masterVolume: 0.5 });
    values.set(AUDIO_SETTINGS_KEY, JSON.stringify({ muted: false, masterVolume: 20 }));
    assert.equal(fixture(storage).service.getSettings().masterVolume, 1);
    const denied = fixture({ getItem() { throw new Error('Denied'); }, setItem() { throw new Error('Denied'); } });
    denied.service.setMasterVolume(-1);
    denied.service.setMasterVolume(NaN);
    assert.equal(denied.service.getSettings().masterVolume, 0);
});

test('invalid definitions fail early and unavailable assets cannot crash gameplay', () => {
    assert.throws(() => validateSoundDefinitions([laser, { ...laser }]), /Duplicate/);
    assert.throws(() => validateSoundDefinitions([{ ...laser, key: 'laser' }]), /Invalid/);
    assert.throws(() => validateSoundDefinitions([{ ...laser, category: 'voice' }]), /playback settings/);
    assert.throws(() => validateSoundDefinitions([{ ...laser, paths: ['audio/ship-laser/../bad.wav'] }]), /paths/);
    const { scope, backend, voices } = fixture();
    backend.missing = true;
    const warnings = [];
    const original = console.warn;
    console.warn = message => warnings.push(message);
    try {
        for (let i = 0; i < 10; i++) {
            assert.equal(scope.play(laser.id), false);
            scope.setLoop('engine', engine.id);
            scope.update(16);
        }
        assert.equal(voices.length, 0);
        assert.equal(warnings.length, 2, 'warn once per missing sound');
    } finally { console.warn = original; }
});

test('actual weapon spawns produce one laser event each; booster-blocked actions stay silent', async () => {
    const source = await readFile(new URL('../src/game/objects/spaceship/shipWeapon.ts', import.meta.url), 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
    // Test the real weapon with inert scene/projectile adapters rather than loading a browser renderer.
    class Projectile {
        constructor(_scene, options) { this.options = options; this.sprite = {}; }
        advance() {}
        destroy() { this.options.onDestroy(); }
    }
    const imports = {
        '../projectile/projectile': { Projectile }, '../projectile/definition': { projectileTuning: { radius: 6 } },
        '../../mechanics/projectile/trajectory': { shotTrajectory }, '../../mechanics/spaceship/fireCadence': { FireCadence }
    };
    const module = { exports: {} };
    new Function('require', 'module', 'exports', compiled)(name => imports[name], module, module.exports);
    const { scope, voices } = fixture();
    const ship = { boosting: false, sprite: { x: 0, y: 0, rotation: 0, scaleX: 1 } };
    const weapon = new module.exports.ShipWeapon({ events: new EventEmitter() }, ship, [], () => scope.play(laser.id));
    weapon.setFiring(true);
    for (let time = 0; time <= 1000; time += 10) {
        for (const voice of voices) voice.isPlaying = false;
        weapon.update(time, 10);
    }
    assert.equal(weapon.projectiles.size, 4);
    assert.equal(voices.reduce((sum, voice) => sum + voice.plays.length, 0), 4);
    ship.boosting = true;
    for (let time = 1010; time < 2000; time += 10) weapon.update(time, 10);
    assert.equal(voices.reduce((sum, voice) => sum + voice.plays.length, 0), 4);
    weapon.destroy();
});

test('generated WAVs are reproducible, correctly timed, DC-free and periodic at loop boundaries', async () => {
    const generated = generateEffects();
    for (const definition of definitions) {
        const wav = await readFile(new URL(`../public/assets/${definition.paths[0]}`, import.meta.url));
        assert.deepEqual(wav, generated[definition.id]);
        const info = validateWav(wav);
        assert.equal(info.rate, 44100);
        assert.equal(info.channels, 1);
        assert.equal(info.frames / info.rate, definition.mode === 'loop' ? 2 : 0.18);
        const samples = Array.from({ length: info.frames }, (_, i) => wav.readInt16LE(info.dataStart + i * 2));
        const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
        assert(Math.abs(mean) < 1);
        assert(samples.every(value => Math.abs(value) <= 19661));
        if (definition.mode === 'loop') {
            let maxStep = 0;
            for (let i = 1; i < samples.length; i++) maxStep = Math.max(maxStep, Math.abs(samples[i] - samples[i - 1]));
            assert(Math.abs(samples[0] - samples.at(-1)) <= maxStep + 1, 'loop seam must not introduce a waveform jump');
        }
    }
});

test('sound scaffold validates first, preserves existing files and generates a compiling discoverable definition', async () => {
    const root = await mkdtemp(join(tmpdir(), 'milky-audio-'));
    await mkdir(join(root, 'src/game/scenes'), { recursive: true });
    await mkdir(join(root, 'src/game/audio/definitions'), { recursive: true });
    await writeFile(join(root, 'src/game/scenes/gameScene.ts'), 'export class Game {}');
    await writeFile(join(root, 'src/game/audio/types.ts'), await readFile(new URL('../src/game/audio/types.ts', import.meta.url)));
    await writeFile(join(root, 'source.wav'), await readFile(new URL('../public/assets/audio/ship-laser/laser-shot.wav', import.meta.url)));
    const script = resolve('.agents/skills/utils-add-sound/scripts/scaffold.mjs');
    const run = args => spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: 'utf8' });
    const dry = run(['test-laser', '--file', 'source.wav', '--dry-run']);
    assert.equal(dry.status, 0, dry.stderr);
    assert.match(dry.stdout, /DRY RUN/);
    assert.deepEqual(await readdir(join(root, 'src/game/audio/definitions')), []);
    const created = run(['test-laser', '--file', 'source.wav']);
    assert.equal(created.status, 0, created.stderr);
    const definition = join(root, 'src/game/audio/definitions/testLaser.ts');
    execFileSync(process.execPath, [resolve('node_modules/typescript/bin/tsc'), '--noEmit', '--strict', '--skipLibCheck', '--target', 'ES2020', definition]);
    const { definition: discovered } = await import(new URL(`file:///${definition.replaceAll('\\', '/')}`));
    validateSoundDefinitions([discovered]);
    assert.equal(discovered.key, 'audio:test-laser');
    assert.equal(discovered.category, 'sfx');
    assert.deepEqual(await readFile(join(root, 'public/assets/audio/test-laser/test-laser.wav')), await readFile(join(root, 'source.wav')));
    const loop = run(['test-loop', '--file', 'source.wav', '--mode', 'loop']);
    assert.equal(loop.status, 0, loop.stderr);
    const { definition: loopDefinition } = await import(new URL(`file:///${join(root, 'src/game/audio/definitions/testLoop.ts').replaceAll('\\', '/')}`));
    assert.equal(loopDefinition.mode, 'loop');
    assert.equal(loopDefinition.maxVoices, 1);
    const music = run(['test-music', '--file', 'source.wav', '--category', 'music', '--mode', 'loop']);
    assert.equal(music.status, 0, music.stderr);
    const { definition: musicDefinition } = await import(new URL(`file:///${join(root, 'src/game/audio/definitions/testMusic.ts').replaceAll('\\', '/')}`));
    assert.equal(musicDefinition.category, 'music');
    const before = await readFile(definition);
    assert.notEqual(run(['test-laser', '--file', 'source.wav']).status, 0);
    assert.deepEqual(await readFile(definition), before);
    for (const args of [
        ['../bad', '--file', 'source.wav'], ['OtherName', '--file', 'source.wav'],
        ['new-sound', '--file', 'source.wav', '--scene', 'Missing'],
        ['new-sound', '--file', 'source.wav', '--mode', 'music'],
        ['new-sound', '--file', 'source.wav', '--category', 'voice'],
        ['new-sound', '--file', 'missing.wav'], ['new-sound']
    ]) assert.notEqual(run(args).status, 0, String(args));
    await writeFile(join(root, 'bad.wav'), 'not audio');
    assert.notEqual(run(['new-sound', '--file', 'bad.wav']).status, 0);
    const incomplete = Buffer.concat([await readFile(join(root, 'source.wav')), Buffer.from([0, 0])]);
    incomplete.writeUInt32LE(incomplete.length - 8, 4);
    await writeFile(join(root, 'incomplete.wav'), incomplete);
    assert.notEqual(run(['new-sound', '--file', 'incomplete.wav']).status, 0, 'partial trailing chunk headers must be rejected');
    await mkdir(join(root, 'src/game/scenes/Folder.ts'));
    assert.notEqual(run(['new-sound', '--file', 'source.wav', '--scene', 'Folder']).status, 0);
    await writeFile(join(root, 'src/game/audio/definitions/alias.ts'), "export const definition = { id: 'duplicate-sound', key: 'audio:duplicate-sound' };");
    assert.notEqual(run(['duplicate-sound', '--file', 'source.wav']).status, 0);
    assert.deepEqual(await readdir(join(root, 'src/game/audio/definitions')), ['alias.ts', 'testLaser.ts', 'testLoop.ts', 'testMusic.ts']);
});
