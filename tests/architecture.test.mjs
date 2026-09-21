import assert from 'node:assert/strict';
import { test } from 'node:test';
import { access, readdir, readFile } from 'node:fs/promises';
import { basename, dirname, extname, join, normalize, relative, resolve } from 'node:path';
import ts from 'typescript';

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
    await assertPureLayer(join(sourceRoot, 'game/state'), [path('game/state')]);
    await assertPureLayer(join(sourceRoot, 'game/domain'), [path('game/domain')]);
    await assertPureLayer(join(sourceRoot, 'game/application'), [path('game/application'), path('game/domain'), path('game/state')]);
    await assertPureLayer(join(sourceRoot, 'game/world'), [path('game/world')]);
    await assertPureLayer(join(sourceRoot, 'game/mechanics'), [path('game/mechanics'), path('game/world'), path('game/state'), path('game/definitions')]);
});

test('authoritative state declarations are readonly data without behavior', async () => {
    for (const file of await sourceFiles(join(sourceRoot, 'game/state'))) {
        const source = await readFile(file, 'utf8');
        const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
        assert(!/\b(?:Phaser|window|document|Date|Map|Set|undefined)\b/.test(source), `${relative(root, file)} contains a prohibited state value`);
        for (const node of parsed.statements) {
            assert(!ts.isClassDeclaration(node), `${relative(root, file)} declares a state class`);
            assert(!ts.isVariableStatement(node), `${relative(root, file)} declares module-level state`);
            if (!ts.isInterfaceDeclaration(node)) continue;
            for (const member of node.members) {
                assert(ts.isPropertySignature(member), `${relative(root, file)} contains behavior in ${node.name.text}`);
                assert((ts.getModifiers(member) ?? []).some(modifier => modifier.kind === ts.SyntaxKind.ReadonlyKeyword),
                    `${relative(root, file)} contains mutable field ${member.name.getText(parsed)}`);
            }
        }
    }
});

test('spatial state uses serializable vectors instead of parallel coordinate fields', async () => {
    const expected = new Map([
        ['shipState.ts', ['readonly position: Vector2State', 'readonly velocity: Vector2State']],
        ['planetState.ts', ['readonly position: Vector2State']],
        ['projectileState.ts', ['readonly position: Vector2State', 'readonly velocity: Vector2State']]
    ]);
    for (const [name, fields] of expected) {
        const source = await readFile(join(sourceRoot, 'game/state', name), 'utf8');
        assert(!/readonly\s+(?:x|y|velocityX|velocityY)\s*:/.test(source), `${name} contains parallel coordinate fields`);
        for (const field of fields) assert(source.includes(field), `${name} is missing ${field}`);
    }
});

test('one provider owns state and Phaser projections do not declare authoritative fields', async () => {
    const files = await sourceFiles(join(sourceRoot, 'game'));
    let constructions = 0;
    for (const file of files) constructions += ((await readFile(file, 'utf8')).match(/new\s+GameStateProvider\s*\(/g) ?? []).length;
    assert.equal(constructions, 1, 'GameStateProvider must have one production construction point');
    const projectionFiles = [
        'game/objects/spaceship/spaceship.ts', 'game/objects/spaceship/shipWeapon.ts',
        'game/objects/planet/planet.ts', 'game/objects/projectile/projectile.ts'
    ];
    const authoritative = new Set(['x', 'y', 'velocityX', 'velocityY', 'rotation', 'enginesOn', 'boosting', 'bornAt',
        'bornAtActiveMs', 'alive', 'model', 'nextShotAtMs', 'lastShotAtMs', 'projectileSequence', 'firing']);
    for (const module of projectionFiles) {
        const file = join(sourceRoot, module);
        const source = await readFile(file, 'utf8');
        const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
        for (const statement of parsed.statements) if (ts.isClassDeclaration(statement)) for (const member of statement.members) {
            if (ts.isPropertyDeclaration(member) && member.name) {
                assert(!authoritative.has(member.name.getText(parsed)), `${module} owns authoritative field ${member.name.getText(parsed)}`);
            }
        }
    }
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
