import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import ts from 'typescript';

function transpileModule (path, imports) {
    const source = readFileSync(path, 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
    const module = { exports: {} };
    new Function('require', 'module', 'exports', compiled)(name => imports[name], module, module.exports);
    return module.exports;
}

test('asteroid projection reconciles IDs, shows persisted durability and places star infall below the surface', () => {
    const { AsteroidProjection, asteroidProjectionDepth } = transpileModule('src/game/objects/asteroid/asteroidProjection.ts', {
        '../../definitions/gameplayTuning': { asteroidTuning: { sizes: { big: { radius: 72, hitPoints: 3 }, medium: { radius: 48, hitPoints: 2 }, small: { radius: 24, hitPoints: 1 } } } },
        '../../definitions/moolarisDefinition': { moolarisDefinition: { position: { x: 0, y: 0 }, radius: 100 } },
        '../../visual/layers': { ObjectDepth: { Asteroid: 15, Sun: 5 } }
    });
    const events = { once() {}, off() {} };
    const created = [];
    const scene = { events, add: { image(x, y, texture) {
        const sprite = { x, y, width: 144, destroyed: 0,
            setDepth() { return this; }, setPosition(nextX, nextY) { this.x = nextX; this.y = nextY; return this; },
            setTexture(nextTexture) { this.texture = nextTexture; return this; }, setScale(scale) { this.scale = scale; return this; },
            setRotation(rotation) { this.rotation = rotation; return this; }, destroy() { this.destroyed++; } };
        created.push(sprite); return sprite;
    }, graphics() { return { destroyed: 0, clear() { return this; }, setDepth() { return this; }, fillStyle() { return this; }, fillRect() { return this; }, destroy() { this.destroyed++; } }; } } };
    const projection = new AsteroidProjection(scene);
    projection.synchronize([{ id: 'parent', variant: 'rock', size: 'big', hitPoints: 3, position: { x: 202, y: 3 }, velocity: { x: 0, y: 0 }, orbit: null, outsideSafeAreaSinceActiveMs: null }]);
    projection.synchronize([{ id: 'parent', variant: 'ice', size: 'medium', hitPoints: 1, position: { x: 4, y: 5 }, velocity: { x: 0, y: 0 }, orbit: null, outsideSafeAreaSinceActiveMs: null }]);
    assert.equal(created.length, 1);
    assert.deepEqual({ x: created[0].x, y: created[0].y, texture: created[0].texture, scale: created[0].scale }, { x: 4, y: 5, texture: 'asteroid:ice', scale: 2 / 3 });
    projection.synchronize([{ id: 'parent-fragment-1', variant: 'ice', size: 'small', hitPoints: 1, position: { x: 4, y: 5 }, velocity: { x: 0, y: 0 }, orbit: null, outsideSafeAreaSinceActiveMs: null }]);
    assert.equal(created.length, 2);
    assert.equal(created[0].destroyed, 1, 'absent parent is removed before child projection');
    projection.destroy();
    projection.destroy();
    assert.equal(created[1].destroyed, 1, 'shutdown cleanup remains idempotent');
    assert.equal(asteroidProjectionDepth({ id: 'infall', variant: 'rock', size: 'small', hitPoints: 1, position: { x: 110, y: 0 }, velocity: { x: -1, y: 0 }, orbit: null, outsideSafeAreaSinceActiveMs: null }), 5);
    assert.equal(asteroidProjectionDepth({ id: 'fragment', variant: 'rock', size: 'small', hitPoints: 1, position: { x: 110, y: 0 }, velocity: { x: 1, y: 0 }, orbit: null, outsideSafeAreaSinceActiveMs: null }), 5);
});

test('fragment feedback only recognizes committed parent-to-children transitions and identifies planet impacts', () => {
    const { fragmentedParents, planetImpactParents } = transpileModule('src/game/effects/asteroidExplosion.ts', {
        '../visual/layers': { ObjectDepth: { AsteroidEffect: 16, Planet: 10 } },
        '../definitions/gameplayTuning': { asteroidTuning: { sizes: { big: { radius: 72 }, medium: { radius: 48 }, small: { radius: 24 } } } }
    });
    const parent = { id: 'parent', variant: 'rock', size: 'big', hitPoints: 1, position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 }, orbit: null, outsideSafeAreaSinceActiveMs: null };
    const child = { ...parent, id: 'parent-fragment-1', size: 'medium' };
    assert.deepEqual(fragmentedParents([parent], [child]), [parent]);
    assert.deepEqual(fragmentedParents([], [child]), [], 'first synchronization and restore state do not replay a one-shot');
    assert.deepEqual(fragmentedParents([parent], []), [], 'Moolaris removal has no fragmentation feedback');
    assert.deepEqual(planetImpactParents([parent], [child], [{ id: 'planet', name: 'Planet', position: { x: 10, y: 0 }, radius: 20 }]), [parent]);
    assert.deepEqual(planetImpactParents([parent], [child], [{ id: 'planet', name: 'Planet', position: { x: 100, y: 0 }, radius: 20 }]), []);
});

test('scaffold dry-run, validation, overwrite refusal and generated TypeScript integration', async () => {
    const root = resolve('.');
    await mkdir('.cache', { recursive: true });
    const fixture = await mkdtemp(join(root, '.cache/object-scaffold-'));
    await mkdir(join(fixture, 'src/game/scenes'), { recursive: true });
    await cp('src/game/objects/_shared', join(fixture, 'src/game/objects/_shared'), { recursive: true });
    await cp('src/game/visual', join(fixture, 'src/game/visual'), { recursive: true });
    await mkdir(join(fixture, 'src/game/definitions'), { recursive: true });
    await cp('src/game/definitions/gameplayTuning.ts', join(fixture, 'src/game/definitions/gameplayTuning.ts'));
    await rm(join(fixture, 'src/game/visual/orbitalPaths.ts'));
    await writeFile(join(fixture, 'src/game/scenes/gameScene.ts'), "import { Scene } from 'phaser';\nexport class Game extends Scene {}\n");
    await cp('src/viteEnv.d.ts', join(fixture, 'src/viteEnv.d.ts'));
    const script = join(root, '.agents/skills/utils-add-object-to-scene/scripts/scaffold.mjs');
    const run = args => spawnSync(process.execPath, [script, ...args], { cwd: fixture, encoding: 'utf8', windowsHide: true });
    for (const args of [['../escape'], ['probe','--scene','../Game'], ['probe','--scene','Missing'], ['probe','--physics','unknown'], ['probe','--shape','circle']]) assert.notEqual(run(args).status, 0);
    assert.equal(run(['probe','--dry-run']).status, 0);
    assert.deepEqual(await readdir(join(fixture,'src/game/objects')), ['_shared']);
    assert.equal(run(['probe','--physics','dynamic','--shape','circle']).status, 0);
    const definition = await readFile(join(fixture,'src/game/objects/probe/definition.ts'),'utf8');
    assert.notEqual(run(['probe']).status, 0);
    assert.equal(await readFile(join(fixture,'src/game/objects/probe/definition.ts'),'utf8'), definition);
    assert.equal(run(['decoration']).status, 0);
    assert.equal(run(['obstacle','--physics','static']).status, 0);
    await mkdir(join(fixture, 'src/game/scenes/Folder.ts'));
    assert.notEqual(run(['not-created', '--scene', 'Folder']).status, 0, 'a directory is not a scene');
    await mkdir(join(fixture, 'src/game/objects/alias'));
    const alias = join(fixture, 'src/game/objects/alias/definition.ts');
    await writeFile(alias, "export const definition = { id: 'duplicate-object' };\n");
    assert.notEqual(run(['duplicate-object']).status, 0, 'existing IDs in other modules must be rejected');
    await writeFile(alias, "export const definition = { id: 'alias', assets: [{ key: 'object:duplicate-key:image' }] };\n");
    assert.notEqual(run(['duplicate-key', '--dry-run']).status, 0, 'duplicate key prefixes must fail even during dry-run');
    assert.deepEqual((await readdir(join(fixture, 'src/game/objects'))).sort(), ['_shared', 'alias', 'decoration', 'obstacle', 'probe']);
    await writeFile(join(fixture, 'src/game/scenes/gameScene.ts'), "import { Scene } from 'phaser';\nimport { Probe } from '../objects/probe/probe';\nexport class Game extends Scene { create () { const probe = new Probe(this, { x: 50, y: 50 }); probe.update(0, 16); } }\n");
    await writeFile(join(fixture,'tsconfig.json'), JSON.stringify({ extends: join(root,'tsconfig.json'), include: ['src'] }));
    execFileSync(process.execPath, [join(root,'node_modules/typescript/bin/tsc'),'--noEmit','-p',join(fixture,'tsconfig.json')], { encoding:'utf8', windowsHide:true });
});

test('object workflow routes stateful projections through the central state skill', async () => {
    const skill = await readFile('.agents/skills/utils-add-object-to-scene/SKILL.md', 'utf8');
    const contract = await readFile('.agents/skills/utils-add-object-to-scene/references/objects.md', 'utf8');
    assert.match(skill, /Visual-only objects use this workflow directly/);
    assert.match(skill, /\$utils-add-state/);
    assert.match(skill, /authoritative position, health, inventory, lifecycle, timer/);
    assert.match(skill, /arch-make-data-logical-diag/);
    assert.match(contract, /GameStateProvider/);
    assert.match(contract, /synchronize their sprites and bodies/);
});
