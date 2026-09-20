import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';

const repository = resolve('.');
const generator = join(repository, '.agents/skills/arch-make-code-graph/scripts/build-code-graph.mjs');

function run(root, ...args)
{
    return spawnSync(process.execPath, [generator, '--root', root, ...args], {
        cwd: repository,
        encoding: 'utf8',
        windowsHide: true
    });
}

async function put(root, path, contents)
{
    const target = join(root, path);
    await mkdir(resolve(target, '..'), { recursive: true });
    await writeFile(target, contents);
    return target;
}

async function fixture()
{
    await mkdir(join(repository, '.cache'), { recursive: true });
    const root = await mkdtemp(join(repository, '.cache/code-graph-fixture-'));
    await put(root, 'tsconfig.json', JSON.stringify({ compilerOptions: { strict: true }, include: ['src'] }));
    await put(root, 'public/assets/logo.svg', '<svg xmlns="http://www.w3.org/2000/svg"/>\n');
    await put(root, 'src/model.ts', [
        'export interface Base {}',
        'export type Alias = Base;',
        'export enum Mode { A }',
        'export const settings = { mode: Mode.A };',
        'export function make(value: Alias): Base { return value; }',
        'export class Model implements Base { current: Alias = make({}); }',
        ''
    ].join('\n'));
    await put(root, 'src/ui/view.ts', [
        "import { Model as Renamed, type Alias } from '../model';",
        "export class View extends Renamed { value!: Alias; icon = '/assets/logo.svg'; }",
        ''
    ].join('\n'));
    await put(root, 'src/data/types.ts', 'export interface Stored { id: string }\n');
    await put(root, 'src/game/scenes/gameObjects.ts', 'export const layout = { x: 1 };\n');
    await put(root, 'src/game/scenes/screen.ts', 'export class Screen {}\n');
    await put(root, 'src/game/objects/ship.ts', 'export class Ship {}\n');
    await put(root, 'src/game/definitions/thing.ts', 'export const definition = { id: "thing" };\n');
    await put(root, 'src/game/registry.ts', [
        "const modules = import.meta.glob('./definitions/*.ts', { eager: true, import: 'definition' });",
        'export const registry = Object.values(modules);',
        ''
    ].join('\n'));
    return root;
}

function edge(graph, from, to, kind)
{
    return graph.edges.some(item => item.from === from && item.to === to && item.kind === kind);
}

test('builds deterministic declaration, layer, dependency, glob and asset nodes', async () => {
    const root = await fixture();
    const first = run(root);
    assert.equal(first.status, 0, first.stderr);
    assert.match(first.stdout, /Graph CREATED .* parsed 8, reused 0, deleted 0/);

    const output = join(root, 'context/foundation/code-graph.json');
    const graph = JSON.parse(await readFile(output, 'utf8'));
    assert.deepEqual(new Set(graph.nodes.filter(node => node.module === 'src/model').map(node => node.kind)),
        new Set(['interface', 'type', 'enum', 'variable', 'function', 'class']));
    assert.equal(graph.nodes.find(node => node.id === 'src/ui/view#View').layer, 'ui');
    assert.equal(graph.nodes.find(node => node.id === 'src/data/types#Stored').layer, 'data');
    assert.equal(graph.nodes.find(node => node.id === 'src/game/scenes/gameObjects#layout').layer, 'data');
    assert.equal(graph.nodes.find(node => node.id === 'src/game/scenes/screen#Screen').layer, 'ui');
    assert.equal(graph.nodes.find(node => node.id === 'src/game/objects/ship#Ship').layer, 'model');
    assert.equal(graph.nodes.find(node => node.id === 'src/game/definitions/thing#definition').layer, 'data');
    assert(graph.nodes.some(node => node.id === 'asset:public/assets/logo.svg' && node.layer === 'asset'));
    assert(edge(graph, 'src/ui/view#View', 'src/model#Model', 'extends'));
    assert(edge(graph, 'src/ui/view#View', 'src/model#Alias', 'imports'));
    assert(edge(graph, 'src/model#Model', 'src/model#Base', 'implements'));
    assert(edge(graph, 'src/model#Alias', 'src/model#Base', 'uses'));
    assert(edge(graph, 'src/game/registry#modules', 'src/game/definitions/thing#definition', 'glob-imports'));
    assert(edge(graph, 'src/ui/view#View', 'asset:public/assets/logo.svg', 'asset'));
    assert.deepEqual(graph.nodes.map(node => node.id), [...graph.nodes.map(node => node.id)].sort((a, b) => a.localeCompare(b)));
    assert.equal('generatedAt' in graph, false);

    const modified = (await stat(output)).mtimeMs;
    const second = run(root);
    assert.equal(second.status, 0, second.stderr);
    assert.match(second.stdout, /Graph UNCHANGED .* parsed 0, reused 8, deleted 0/);
    assert.equal((await stat(output)).mtimeMs, modified);
    const checked = run(root, '--check');
    assert.equal(checked.status, 0, checked.stderr);
    assert.match(checked.stdout, /Graph CURRENT/);
});

test('updates incrementally and preserves graph and cache on stale checks or syntax errors', async () => {
    const root = await fixture();
    assert.equal(run(root).status, 0);
    const model = join(root, 'src/model.ts');
    await writeFile(model, `${await readFile(model, 'utf8')}export const changed = settings;\n`);
    const changed = run(root);
    assert.equal(changed.status, 0, changed.stderr);
    assert.match(changed.stdout, /parsed 1, reused 7, deleted 0/);
    let graph = JSON.parse(await readFile(join(root, 'context/foundation/code-graph.json'), 'utf8'));
    assert(graph.nodes.some(node => node.id === 'src/model#changed'));

    await unlink(join(root, 'src/data/types.ts'));
    const deleted = run(root);
    assert.equal(deleted.status, 0, deleted.stderr);
    assert.match(deleted.stdout, /parsed 0, reused 7, deleted 1/);

    const cache = join(root, '.cache/arch-make-code-graph/cache-v1.json');
    await writeFile(cache, '{invalid');
    const rebuilt = run(root);
    assert.equal(rebuilt.status, 0, rebuilt.stderr);
    assert.match(rebuilt.stdout, /parsed 7, reused 0, deleted 0/);

    await writeFile(model, `${await readFile(model, 'utf8')}export const stale = changed;\n`);
    const output = join(root, 'context/foundation/code-graph.json');
    const graphBeforeCheck = await readFile(output, 'utf8');
    const cacheBeforeCheck = await readFile(cache, 'utf8');
    const stale = run(root, '--check');
    assert.equal(stale.status, 1, stale.stderr);
    assert.match(stale.stdout, /Graph STALE .* parsed 1, reused 6/);
    assert.equal(await readFile(output, 'utf8'), graphBeforeCheck);
    assert.equal(await readFile(cache, 'utf8'), cacheBeforeCheck);

    assert.equal(run(root).status, 0);
    const graphBeforeFailure = await readFile(output, 'utf8');
    const cacheBeforeFailure = await readFile(cache, 'utf8');
    await writeFile(model, 'export class Broken {\n');
    const broken = run(root);
    assert.equal(broken.status, 2);
    assert.match(broken.stderr, /Code graph failed: src\/model\.ts:\d+:/);
    assert.equal(await readFile(output, 'utf8'), graphBeforeFailure);
    assert.equal(await readFile(cache, 'utf8'), cacheBeforeFailure);
});

test('requires force before replacing an unowned JSON file', async () => {
    const root = await fixture();
    const output = await put(root, 'context/foundation/code-graph.json', '{}\n');
    const refused = run(root);
    assert.equal(refused.status, 2);
    assert.match(refused.stderr, /Refusing to overwrite JSON not owned/);
    assert.equal(await readFile(output, 'utf8'), '{}\n');
    const forced = run(root, '--force');
    assert.equal(forced.status, 0, forced.stderr);
    assert.equal(JSON.parse(await readFile(output, 'utf8')).generator, 'arch-make-code-graph');
});
