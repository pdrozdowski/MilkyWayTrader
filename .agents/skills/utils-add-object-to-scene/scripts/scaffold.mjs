import { mkdir, readFile, realpath, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';

const args = process.argv.slice(2);
if (args.includes('--help')) {
    console.log('From repo root: scaffold.mjs <object-id> [--scene Game] [--physics none|dynamic|static] [--shape circle|rectangle] [--dry-run]');
    process.exit(0);
}

try {
    const id = args.shift();
    if (!id || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id)) throw new Error('Object ID must be lowercase kebab-case, starting with a letter.');
    const options = { scene: 'Game', physics: 'none', shape: 'rectangle', dryRun: false };
    const seen = new Set();
    while (args.length) {
        const flag = args.shift();
        if (seen.has(flag)) throw new Error(`Repeated flag: ${flag}`);
        seen.add(flag);
        if (flag === '--dry-run') options.dryRun = true;
        else if (['--scene', '--physics', '--shape'].includes(flag)) {
            const value = args.shift();
            if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}`);
            options[flag.slice(2)] = value;
        } else throw new Error(`Unknown flag: ${flag}`);
    }
    if (!/^[A-Z][A-Za-z0-9]*$/.test(options.scene)) throw new Error('Scene must be a PascalCase scene name.');
    if (!['none', 'dynamic', 'static'].includes(options.physics)) throw new Error('Physics must be none, dynamic or static.');
    if (!['circle', 'rectangle'].includes(options.shape)) throw new Error('Shape must be circle or rectangle.');
    if (options.physics === 'none' && seen.has('--shape')) throw new Error('--shape requires dynamic or static physics.');

    const root = await realpath(process.cwd());
    const sceneModule = options.scene[0].toLowerCase() + options.scene.slice(1) + 'Scene';
    const scenePath = await realpath(join(root, 'src/game/scenes', `${sceneModule}.ts`));
    const sceneRelative = relative(root, scenePath);
    if (sceneRelative.startsWith('..') || isAbsolute(sceneRelative)) throw new Error('Scene escapes the repository.');
    if (!(await stat(scenePath)).isFile()) throw new Error('Target scene must be a file.');
    await stat(join(root, 'src/game/objects/_shared/sceneObject.ts'));
    const paths = [`src/game/objects/${id}`, `public/assets/objects/${id}`];
    for (const path of paths) {
        try { await stat(join(root, path)); throw new Error(`Destination already exists: ${path}`); }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
        // Resolve the existing parent, refusing symlinks that escape the workspace.
        let parent = dirname(resolve(root, path));
        while (true) {
            try { parent = await realpath(parent); break; }
            catch (error) { if (error.code !== 'ENOENT') throw error; parent = dirname(parent); }
        }
        const inside = relative(root, parent);
        if (inside.startsWith('..') || isAbsolute(inside)) throw new Error('Destination escapes the repository.');
    }
    const entries = await readdir(join(root, 'src/game/objects'), { withFileTypes: true });
    for (const entry of entries.filter(entry => entry.isDirectory() && entry.name !== '_shared')) {
        let content;
        try { content = await readFile(join(root, 'src/game/objects', entry.name, 'definition.ts'), 'utf8'); }
        catch (error) { if (error.code === 'ENOENT') continue; throw error; }
        if (new RegExp(`\\bid\\s*:\\s*['"]${id}['"]|\\bkey\\s*:\\s*['"]object:${id}:`).test(content)) {
            throw new Error(`Duplicate object ID/key in ${entry.name}/definition.ts`);
        }
    }
    const className = id.split('-').map(part => part[0].toUpperCase() + part.slice(1)).join('');
    const moduleName = className[0].toLowerCase() + className.slice(1);
    const shape = options.shape === 'circle' ? "{ kind: 'circle', radius: 24 }" : "{ kind: 'rectangle', width: 48, height: 48 }";
    const physics = options.physics === 'none' ? '' : `,\n    physics: { kind: '${options.physics}', shape: ${shape} }`;
    const files = {
        [`src/game/objects/${id}/definition.ts`]: `import { ObjectDepth } from '../../visual/layers';\nimport type { GameObjectDefinition } from '../_shared/types';\n\nexport const definition: GameObjectDefinition = {\n    id: '${id}',\n    assets: [{ kind: 'image', key: 'object:${id}:main', path: 'objects/${id}/${id}.svg' }],\n    animations: [],\n    visual: { texture: 'object:${id}:main', scale: 1, depth: ObjectDepth.Planet }${physics}\n};\n`,
        [`src/game/objects/${id}/${moduleName}.ts`]: `import { Scene } from 'phaser';\nimport { SceneObject } from '../_shared/sceneObject';\nimport type { SceneObjectOptions } from '../_shared/types';\nimport { definition } from './definition';\n\nexport class ${className} extends SceneObject\n{\n    constructor (scene: Scene, options: SceneObjectOptions)\n    {\n        super(scene, definition, options);\n    }\n}\n`,
        [`public/assets/objects/${id}/${id}.svg`]: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><title>${className}</title>${options.shape === 'circle' ? '<circle cx="32" cy="32" r="24"' : '<rect x="8" y="8" width="48" height="48"'} fill="#b854bc" stroke="#fff" stroke-width="2"/><text x="32" y="38" text-anchor="middle" fill="#fff" font-size="18">?</text></svg>\n`
    };
    if (!options.dryRun) {
        // Reserve both directories before writing; never overwrite an existing file.
        for (const path of paths) { await mkdir(dirname(join(root, path)), { recursive: true }); await mkdir(join(root, path)); }
        for (const [path, content] of Object.entries(files)) await writeFile(join(root, path), content, { flag: 'wx' });
    }
    console.log(`${options.dryRun ? 'DRY RUN' : 'CREATED'} ${id}\n${Object.keys(files).join('\n')}\nNext: implement behavior; import ${className} in src/game/scenes/${sceneModule}.ts, create/update it and connect interactions. Preloader discovers its definition automatically.`);
} catch (error) {
    console.error(`Scaffold stopped: ${error.message}`);
    process.exitCode = 1;
}
