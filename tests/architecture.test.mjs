import assert from 'node:assert/strict';
import { test } from 'node:test';
import { access, readdir, readFile } from 'node:fs/promises';
import { basename, dirname, extname, join, normalize, relative, resolve } from 'node:path';

const root = resolve('.');
const sourceRoot = join(root, 'src');

async function sourceFiles(directory)
{
    try {
        const entries = await readdir(directory, { withFileTypes: true });
        const nested = await Promise.all(entries.map(entry => entry.isDirectory()
            ? sourceFiles(join(directory, entry.name))
            : Promise.resolve(extname(entry.name) === '.ts' ? [join(directory, entry.name)] : [])));
        return nested.flat();
    } catch (error) {
        if (error.code === 'ENOENT') return [];
        throw error;
    }
}

function importedModules(source)
{
    const imports = [];
    const pattern = /(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g;
    for (const match of source.matchAll(pattern)) imports.push(match[1]);
    return imports;
}

function resolvedModule(file, specifier)
{
    return specifier.startsWith('.') ? normalize(resolve(dirname(file), specifier)).replaceAll('\\', '/') : specifier;
}

async function assertPureLayer(directory, allowedRoots)
{
    const pureFiles = await sourceFiles(directory);
    const browserGlobal = /\b(?:document|window|HTMLElement|HTMLCanvasElement|KeyboardEvent|TouchEvent)\b/;
    for (const file of pureFiles) {
        const source = await readFile(file, 'utf8');
        for (const specifier of importedModules(source)) {
            assert(specifier.startsWith('.'), `${relative(root, file)} imports external module ${specifier}`);
            const resolved = resolvedModule(file, specifier);
            assert(allowedRoots.some(allowed => resolved.startsWith(allowed)), `${relative(root, file)} crosses its layer boundary`);
        }
        assert(!browserGlobal.test(source), `${relative(root, file)} must not use browser globals`);
    }
}

test('pure layers follow their dependency direction', async () => {
    const path = value => normalize(join(sourceRoot, value)).replaceAll('\\', '/');
    await assertPureLayer(join(sourceRoot, 'game/domain'), [path('game/domain')]);
    await assertPureLayer(join(sourceRoot, 'game/application'), [path('game/application'), path('game/domain')]);
    await assertPureLayer(join(sourceRoot, 'game/world'), [path('game/world')]);
    await assertPureLayer(join(sourceRoot, 'game/mechanics'), [path('game/mechanics'), path('game/world')]);
});

test('UI components depend only on UI contracts and components', async () => {
    for (const file of await sourceFiles(join(sourceRoot, 'ui/components'))) {
        const source = await readFile(file, 'utf8');
        for (const specifier of importedModules(source)) {
            assert.notEqual(specifier, 'phaser', `${relative(root, file)} imports Phaser`);
            const resolved = resolvedModule(file, specifier);
            assert(!resolved.includes('/src/game/'), `${relative(root, file)} imports a game implementation`);
            assert(!resolved.includes('/src/ui/adapters/'), `${relative(root, file)} imports an adapter`);
        }
    }
    const gameMain = await readFile(join(sourceRoot, 'game/main.ts'), 'utf8');
    assert(!importedModules(gameMain).some(specifier => resolvedModule(join(sourceRoot, 'game/main.ts'), specifier).includes('/src/ui/')),
        'src/game/main.ts must not import UI modules');
});

test('scene-wide effects do not depend on object modules', async () => {
    for (const file of await sourceFiles(join(sourceRoot, 'game/effects'))) {
        const source = await readFile(file, 'utf8');
        for (const specifier of importedModules(source)) {
            assert(!resolvedModule(file, specifier).includes('/src/game/objects/'), `${relative(root, file)} imports an object module`);
        }
    }
});

test('shared visual and DOM UI modules use their canonical locations', async () => {
    await Promise.all([
        access(join(sourceRoot, 'game/visual/layers.ts')),
        access(join(sourceRoot, 'ui/components/displayControls.ts')),
        access(join(sourceRoot, 'ui/components/audioControls.ts')),
        access(join(sourceRoot, 'ui/setupUi.ts'))
    ]);
    for (const obsolete of ['display.ts', 'audioControls.ts', 'ui/display.ts', 'ui/audioControls.ts', 'game/objects/_shared/layers.ts', 'game/effects/boostEffects.ts']) {
        await assert.rejects(access(join(sourceRoot, obsolete)), error => error.code === 'ENOENT');
    }
});

test('TypeScript module filenames use lower camel case', async () => {
    const files = [...await sourceFiles(sourceRoot), ...await sourceFiles(join(root, 'tests/ui')), join(root, 'playwrightConfig.ts')];
    for (const file of files) {
        const filename = basename(file);
        const moduleName = filename.endsWith('.d.ts') ? filename.slice(0, -5) : filename.slice(0, -3);
        assert.match(moduleName, /^[a-z][A-Za-z0-9]*$/, `${relative(root, file)} must use lower camel case`);
    }
});
