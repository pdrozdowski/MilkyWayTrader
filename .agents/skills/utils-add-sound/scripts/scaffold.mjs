import { mkdir, readFile, realpath, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function validateWav(wav) {
    if (wav.length < 44 || wav.toString('ascii', 0, 4) !== 'RIFF' || wav.toString('ascii', 8, 12) !== 'WAVE'
        || wav.readUInt32LE(4) + 8 !== wav.length) throw new Error('Source must be a complete RIFF/WAVE file.');
    let format;
    let data;
    let offset = 12;
    for (; offset + 8 <= wav.length;) {
        const kind = wav.toString('ascii', offset, offset + 4);
        const size = wav.readUInt32LE(offset + 4);
        const start = offset + 8;
        if (start + size > wav.length) throw new Error('Truncated WAV chunk.');
        if (kind === 'fmt ') {
            if (size < 16) throw new Error('Invalid WAV format chunk.');
            format = { encoding: wav.readUInt16LE(start), channels: wav.readUInt16LE(start + 2),
                rate: wav.readUInt32LE(start + 4), bytesPerSecond: wav.readUInt32LE(start + 8),
                alignment: wav.readUInt16LE(start + 12), bits: wav.readUInt16LE(start + 14) };
        }
        if (kind === 'data') data = { size, start };
        offset = start + size + size % 2;
        if (offset > wav.length) throw new Error('Missing WAV chunk padding.');
    }
    if (offset !== wav.length) throw new Error('Incomplete WAV chunk header.');
    if (!format || !data || format.encoding !== 1 || format.bits !== 16 || ![1, 2].includes(format.channels)
        || format.rate < 8000 || format.rate > 96000 || format.alignment !== format.channels * 2
        || format.bytesPerSecond !== format.rate * format.alignment || !data.size || data.size % format.alignment) {
        throw new Error('Use PCM 16-bit mono/stereo WAV, 8–96 kHz, with complete audio samples.');
    }
    return { ...format, frames: data.size / format.alignment, dataStart: data.start };
}

function assertInside(root, path) {
    const inside = relative(root, path);
    if (inside.startsWith('..') || isAbsolute(inside)) throw new Error('Destination or scene escapes the repository.');
}

export async function scaffold(args, cwd = process.cwd()) {
    if (args.includes('--help')) {
        console.log('scaffold.mjs <sound-id> --file <path.wav> [--category sfx|music] [--mode one-shot|loop] [--scene Game] [--dry-run]');
        return;
    }
    const id = args.shift();
    if (!id || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id)) throw new Error('Sound ID must be lowercase kebab-case, starting with a letter.');
    const options = { scene: 'Game', category: 'sfx', mode: 'one-shot', dryRun: false, file: '' };
    const seen = new Set();
    while (args.length) {
        const flag = args.shift();
        if (seen.has(flag)) throw new Error(`Repeated flag: ${flag}`);
        seen.add(flag);
        if (flag === '--dry-run') options.dryRun = true;
        else if (['--scene', '--category', '--mode', '--file'].includes(flag)) {
            const value = args.shift();
            if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}`);
            options[flag.slice(2)] = value;
        } else throw new Error(`Unknown flag: ${flag}`);
    }
    if (!/^[A-Z][A-Za-z0-9]*$/.test(options.scene)) throw new Error('Scene must be a PascalCase scene name.');
    if (!['sfx', 'music'].includes(options.category)) throw new Error('Category must be sfx or music.');
    if (!['one-shot', 'loop'].includes(options.mode)) throw new Error('Mode must be one-shot or loop.');
    if (!options.file) throw new Error('--file is required.');
    const root = await realpath(cwd);
    const sceneModule = options.scene[0].toLowerCase() + options.scene.slice(1) + 'Scene';
    const scene = await realpath(join(root, 'src/game/scenes', `${sceneModule}.ts`));
    assertInside(root, scene);
    if (!(await stat(scene)).isFile()) throw new Error('Target scene must be a file.');
    await stat(join(root, 'src/game/audio/types.ts'));
    const wav = await readFile(resolve(root, options.file));
    validateWav(wav);
    const definitionModule = id.replace(/-([a-z0-9])/g, (_, character) => character.toUpperCase());
    const definitionPath = `src/game/audio/definitions/${definitionModule}.ts`;
    const assetDirectory = `public/assets/audio/${id}`;
    const paths = [definitionPath, assetDirectory];
    for (const path of paths) {
        try { await stat(join(root, path)); throw new Error(`Destination already exists: ${path}`); }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
        let parent = dirname(resolve(root, path));
        while (true) {
            try { parent = await realpath(parent); break; }
            catch (error) { if (error.code !== 'ENOENT') throw error; parent = dirname(parent); }
        }
        assertInside(root, parent);
    }
    let files = [];
    try { files = await readdir(join(root, 'src/game/audio/definitions')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    for (const file of files.filter(file => file.endsWith('.ts'))) {
        const content = await readFile(join(root, 'src/game/audio/definitions', file), 'utf8');
        if (new RegExp(`\\b(?:id|key)\\s*:\\s*['"](?:audio:)?${id}['"]`).test(content)) throw new Error(`Duplicate sound ID/key in ${file}`);
    }
    const assetFilename = `${id}.wav`;
    const definition = `import type { SoundDefinition } from '../types';\n\nexport const definition: SoundDefinition = {\n    id: '${id}', key: 'audio:${id}', paths: ['audio/${id}/${assetFilename}'],\n    category: '${options.category}', mode: '${options.mode}', gain: 0.3, maxVoices: ${options.mode === 'loop' ? 1 : 2},\n    credit: { source: 'User-provided recording', author: 'Unspecified', license: 'Unspecified' }\n};\n`;
    if (!options.dryRun) {
        await mkdir(dirname(join(root, assetDirectory)), { recursive: true });
        await mkdir(join(root, assetDirectory)); // Reserve without overwriting.
        await mkdir(dirname(join(root, definitionPath)), { recursive: true });
        await writeFile(join(root, definitionPath), definition, { flag: 'wx' });
        await writeFile(join(root, assetDirectory, assetFilename), wav, { flag: 'wx' });
    }
    console.log(`${options.dryRun ? 'DRY RUN' : 'CREATED'} ${id}\n${definitionPath}\n${assetDirectory}/${assetFilename}\nNext: complete provenance and gain; wire actual actions/state through an owned AudioScope in src/game/scenes/${sceneModule}.ts. Preloader discovers the definition automatically.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
    try { await scaffold(process.argv.slice(2)); }
    catch (error) { console.error(`Scaffold stopped: ${error.message}`); process.exitCode = 1; }
}
