import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
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

// Minimal chainable stand-in for Phaser graphics/image objects; records only what the tests read.
function phaserDisplayStub () {
    const stub = { visible: true, destroyed: 0 };
    const chain = () => stub;
    for (const method of ['setDepth', 'setPosition', 'setRotation', 'setScale', 'setTexture', 'setOrigin', 'setDisplaySize', 'clear', 'fillStyle', 'fillRoundedRect', 'lineStyle', 'strokeRoundedRect', 'lineBetween', 'fillTriangle', 'fillCircle']) stub[method] = chain;
    stub.setVisible = visible => { stub.visible = visible; return stub; };
    stub.setTexture = texture => { stub.texture = texture; return stub; };
    stub.destroy = () => { stub.destroyed++; };
    return stub;
}

test('asteroid projection reconciles IDs, shows persisted durability and keeps every asteroid above planets', () => {
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
    assert.equal(asteroidProjectionDepth({ id: 'infall', variant: 'rock', size: 'small', hitPoints: 1, position: { x: 110, y: 0 }, velocity: { x: -1, y: 0 }, orbit: null, outsideSafeAreaSinceActiveMs: null }), 15);
    assert.equal(asteroidProjectionDepth({ id: 'fragment', variant: 'rock', size: 'small', hitPoints: 1, position: { x: 110, y: 0 }, velocity: { x: 1, y: 0 }, orbit: null, outsideSafeAreaSinceActiveMs: null }), 15);
});

test('salvage projections reconcile state IDs, use approved frames/icons and clean up faded objects', () => {
    const destroyed = [];
    class SceneObject {
        constructor (scene, _definition, options) {
            this.scene = scene;
            this.sprite = {
                x: options.x, y: options.y, texture: '', destroyed: false,
                setTexture (texture) { this.texture = texture; return this; },
                setPosition (x, y) { this.x = x; this.y = y; return this; }
            };
            this.cleanups = [];
        }
        setPosition (x, y) { this.sprite.setPosition(x, y); return this; }
        ownCleanup (cleanup) { this.cleanups.push(cleanup); }
        destroy () { if (this.sprite.destroyed) return; this.sprite.destroyed = true; for (const cleanup of this.cleanups) cleanup(); destroyed.push(this); }
    }
    const graphics = () => ({ clear () { return this; }, setDepth () { return this; }, fillStyle () { return this; }, fillRect () { return this; }, destroy () {} });
    const scene = { time: { now: 0 }, events: { once () {}, off () {} }, add: { graphics }, tweens: { add (config) { config.onComplete?.(); } } };
    const cargoDefinition = transpileModule('src/game/objects/cargo/definition.ts', { '../../visual/layers': { ObjectDepth: { Asteroid: 15 } } }).definition;
    const commodityDefinition = transpileModule('src/game/objects/commodity/definition.ts', { '../../visual/layers': { ObjectDepth: { Asteroid: 15 } } }).definition;
    assert.deepEqual(cargoDefinition.assets.map(asset => asset.path), ['icons/cargo_32x32.png', 'icons/cargo_2_32x32.png']);
    assert.deepEqual(commodityDefinition.assets.map(asset => asset.path), [
        'icons/commodity-milk-48x48.png', 'icons/commodity-grain_48x48.png', 'icons/commodity-cheese-48x48.png', 'icons/commodity-bun_48x48.png', 'icons/commodity-spaceRation-48x48.png'
    ]);
    const { serotonCommodityIds: commodityIds } = transpileModule('src/game/domain/serotonMarketCatalog.ts', {});
    for (const asset of commodityDefinition.assets) assert(existsSync(join('public/assets', asset.path)), `missing commodity asset ${asset.path}`);
    assert.deepEqual(Object.keys(commodityDefinition.variants ?? {}), commodityIds);
    assert.deepEqual(commodityIds.map(id => commodityDefinition.variants[id]?.texture ?? commodityDefinition.visual.texture), [
        'object:commodity:milk', 'object:commodity:grain', 'object:commodity:cheese', 'object:commodity:bun', 'object:commodity:spaceRation'
    ]);
    assert.equal(commodityDefinition.physics, undefined, 'loose commodity projection creates no Arcade body');
    assert.equal(cargoDefinition.physics, undefined, 'cargo projection creates no Arcade body');
    const { CargoProjection } = transpileModule('src/game/objects/cargo/cargo.ts', {
        phaser: {}, '../_shared/sceneObject': { SceneObject }, '../../visual/layers': { ObjectDepth: { Asteroid: 15, Indicator: 11 } }, './definition': { definition: {} }
    });
    const { CommodityProjection } = transpileModule('src/game/objects/commodity/commodity.ts', {
        phaser: {}, '../_shared/sceneObject': { SceneObject }, './definition': { definition: {} }
    });
    const cargo = new CargoProjection(scene);
    cargo.synchronize([{ id: 'cargo-1', position: { x: 4, y: 5 }, orbit: {}, hitPoints: 2, manifest: [{ commodityId: 'grain', quantity: 2, totalCost: 0 }] }]);
    scene.time.now = 300;
    cargo.synchronize([{ id: 'cargo-1', position: { x: 7, y: 9 }, orbit: {}, hitPoints: 1, manifest: [{ commodityId: 'grain', quantity: 2, totalCost: 0 }] }]);
    assert.equal(cargo.cargoById.get('cargo-1').sprite.texture, 'object:cargo:open');
    cargo.synchronize([]);
    assert.equal(cargo.cargoById.size, 0);
    const commodities = new CommodityProjection(scene);
    commodities.synchronize(commodityIds.map((commodityId, index) => ({ id: `loose-${commodityId}`, position: { x: index, y: index }, motion: {}, container: { commodityId, quantity: 1, totalCost: 0 } })), new Set());
    for (const commodityId of commodityIds) {
        assert.equal(commodities.commodityById.get(`loose-${commodityId}`).sprite.texture, `object:commodity:${commodityId}`);
    }
    commodities.synchronize([{ id: 'loose-milk', position: { x: 3, y: 4 }, motion: {}, container: { commodityId: 'milk', quantity: 1, totalCost: 0 } }], new Set());
    assert.equal(commodities.commodityById.size, 1, 'commodities absent from the manifest are destroyed');
    assert.deepEqual({ x: commodities.commodityById.get('loose-milk').sprite.x, y: commodities.commodityById.get('loose-milk').sprite.y }, { x: 3, y: 4 });
    commodities.synchronize([], new Set(['loose-milk']));
    assert.equal(commodities.commodityById.size, 0, 'sun fade completion destroys its scoped projection');
    assert(destroyed.length >= 2, 'projection wrappers release their owned presentation objects');
});

test('main-menu background fits viewport height and centers its horizontal crop', () => {
    const { mainMenuBackgroundTransform } = transpileModule('src/game/scenes/mainMenuBackground.ts', {});
    assert.deepEqual(mainMenuBackgroundTransform({ width: 1920, height: 1080 }, 941), {
        x: 960, y: 540, scale: 1080 / 941
    });
    assert.deepEqual(mainMenuBackgroundTransform({ width: 390, height: 844 }, 941), {
        x: 195, y: 422, scale: 844 / 941
    });
});

test('fragment feedback only recognizes committed parent-to-children transitions and identifies planet impacts', () => {
    const { fragmentedParents, fragmentImpactPosition, planetImpactParents, planetImpactSmallAsteroids, projectileImpactPositions } = transpileModule('src/game/effects/asteroidExplosion.ts', {
        '../visual/layers': { ObjectDepth: { AsteroidEffect: 16, Planet: 10 } },
        '../definitions/gameplayTuning': { asteroidTuning: { sizes: { big: { radius: 72 }, medium: { radius: 48 }, small: { radius: 24 } } } },
        '../world/geometry': { sweptCircleIntersection (first, second) {
            const offset = first.start.x - second.start.x;
            const velocity = (first.end.x - first.start.x) - (second.end.x - second.start.x);
            const radius = first.radius + second.radius;
            const constant = offset * offset - radius * radius;
            if (constant <= 0) return 0;
            if (velocity === 0) return null;
            const linear = 2 * offset * velocity;
            const time = (-linear - Math.sqrt(linear * linear - 4 * velocity * velocity * constant)) / (2 * velocity * velocity);
            return time >= 0 && time <= 1 ? time : null;
        } }
    });
    const parent = { id: 'parent', variant: 'rock', size: 'big', hitPoints: 1, position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 }, orbit: null, outsideSafeAreaSinceActiveMs: null };
    const child = { ...parent, id: 'parent-fragment-1', size: 'medium' };
    assert.deepEqual(fragmentedParents([parent], [child]), [parent]);
    assert.deepEqual(fragmentImpactPosition(parent, [{ ...child, position: { x: 12, y: 4 } }]), { x: 12, y: 4 });
    assert.deepEqual(fragmentedParents([], [child]), [], 'first synchronization and restore state do not replay a one-shot');
    assert.deepEqual(fragmentedParents([parent], []), [], 'Moolaris removal has no fragmentation feedback');
    assert.deepEqual(planetImpactParents([parent], [child], [{ id: 'planet', name: 'Planet', position: { x: 10, y: 0 }, radius: 20 }]), [parent]);
    assert.deepEqual(planetImpactParents([parent], [child], [{ id: 'planet', name: 'Planet', position: { x: 100, y: 0 }, radius: 20 }]), []);
    const small = { ...parent, id: 'small', size: 'small' };
    assert.deepEqual(planetImpactSmallAsteroids([small], [], [{ id: 'planet', name: 'Planet', position: { x: 10, y: 0 }, radius: 20 }]), [small]);
    assert.deepEqual(planetImpactSmallAsteroids([small], [], [{ id: 'planet', name: 'Planet', position: { x: 100, y: 0 }, radius: 20 }]), []);
    const shot = { id: 'shot', position: { x: -100, y: 0 }, velocity: { x: 1_000, y: 0 }, bornAtActiveMs: 0 };
    const bulletTarget = { ...parent, id: 'bullet-target', hitPoints: 3 };
    const damaged = { ...bulletTarget, hitPoints: 2, position: { x: 0, y: 0 } };
    assert.deepEqual(projectileImpactPositions([bulletTarget], [damaged], [shot], [], 100, 4), [{ x: -76, y: 0 }]);
});

test('engine exhaust adds pipes and hotter flames as the engine levels up', () => {
    const { engineExhaustLayout, engineExhaustPipeX, engineFlamePulseLength, hotFlameLengthMultiplier } = transpileModule('src/game/objects/spaceship/exhaustLayout.ts', {
        './definition': {
            shipBoostTuning: { flameLengthMultiplier: 5 },
            shipFlameFrameRate: 18,
            shipFlameLengths: [7, 10, 13, 11, 8, 6]
        }
    });
    const shape = (level, boosting = false) => engineExhaustLayout(level, boosting)
        .map(pipe => `${pipe.x}:${pipe.variant}:${pipe.lengthMultiplier}`);

    assert.equal(hotFlameLengthMultiplier, 2.5);
    assert.deepEqual(shape(1), [`${engineExhaustPipeX.centre}:normal:1`], 'level one keeps the single pipe');
    assert.deepEqual(shape(2), [`${engineExhaustPipeX.centre}:hot:2.5`], 'level two lengthens that pipe and burns it red');
    assert.deepEqual(shape(3), [`${engineExhaustPipeX.left}:normal:1`, `${engineExhaustPipeX.right}:normal:1`], 'level three adds the second pipe');
    assert.deepEqual(shape(4), [`${engineExhaustPipeX.left}:hot:2.5`, `${engineExhaustPipeX.right}:hot:2.5`], 'level four lengthens both pipes');
    assert.deepEqual(shape(5), [`${engineExhaustPipeX.left}:normal:1`, `${engineExhaustPipeX.centre}:hot:2.5`, `${engineExhaustPipeX.right}:normal:1`],
        'level five fits a hot centre pipe between the twin pipes');
    assert.deepEqual(shape(1, true), [`${engineExhaustPipeX.left}:boost:5`, `${engineExhaustPipeX.right}:boost:5`],
        'boosting lights the two level-one pipes at the boosted length regardless of the engine level');
    assert.deepEqual(shape(5, true), shape(1, true));
    assert.equal(engineExhaustLayout(99, false).length, 3, 'an out-of-range level clamps to the strongest layout');
    assert.deepEqual(shape(0), shape(1), 'an out-of-range level falls back to the single pipe');
    assert(Object.isFrozen(engineExhaustLayout(3, false)));

    assert.deepEqual([0, 56, 112, 167, 223, 278].map(engineFlamePulseLength), [7, 10, 13, 11, 8, 6], 'the flame pulses through the retired animation lengths');
    assert.equal(engineFlamePulseLength(333), engineFlamePulseLength(1_333), 'the pulse runs on a whole-frame loop');
});

test('the engine exhaust hides with the ship and stays hidden while updates continue', () => {
    const { EngineExhaust } = transpileModule('src/game/objects/spaceship/engineExhaust.ts', {
        phaser: { GameObjects: {}, Scene: class {} },
        '../../visual/layers': { ObjectDepth: { Ship: 20 } },
        './definition': { shipFrames: { flameNormal: { key: 'flame-normal' }, flameHot: { key: 'flame-hot' } } },
        './exhaustLayout': { engineFlamePulseLength: () => 10 }
    });
    const created = [];
    const scene = { add: {
        graphics: () => { const graphics = phaserDisplayStub(); created.push(graphics); return graphics; },
        image: () => { const image = phaserDisplayStub(); created.push(image); return image; }
    } };
    const exhaust = new EngineExhaust(scene);
    const sprite = { x: 0, y: 0, rotation: 0, scaleX: 1 };
    const pipes = [
        { x: -7, variant: 'normal', lengthMultiplier: 1 },
        { x: 7, variant: 'hot', lengthMultiplier: 2.5 }
    ];
    const nozzles = () => created[0];
    const flames = () => created.slice(1);

    exhaust.update(0, sprite, pipes, true);
    assert.equal(nozzles().visible, true);
    assert.deepEqual(flames().map(flame => flame.visible), [true, true]);
    assert.deepEqual(flames().map(flame => flame.texture), ['flame-normal', 'flame-hot']);

    exhaust.setVisible(false);
    assert.equal(nozzles().visible, false, 'nozzles leave with the destroyed ship');
    assert.deepEqual(flames().map(flame => flame.visible), [false, false], 'flames leave with the destroyed ship');

    exhaust.update(100, sprite, pipes, true);
    assert.equal(nozzles().visible, false, 'a later update must not bring the nozzles back');
    assert.deepEqual(flames().map(flame => flame.visible), [false, false], 'a later update must not relight the flames');

    exhaust.setVisible(true);
    exhaust.update(200, sprite, pipes, true);
    assert.equal(nozzles().visible, true, 'a reused exhaust shows again');
    assert.deepEqual(flames().map(flame => flame.visible), [true, true]);
    exhaust.update(300, sprite, pipes, false);
    assert.deepEqual(flames().map(flame => flame.visible), [false, false], 'idle engines keep their flames dark');
    assert.equal(nozzles().visible, true, 'idle engines still show their nozzles');

    exhaust.destroy();
    exhaust.destroy();
    assert.equal(nozzles().destroyed, 1, 'cleanup stays idempotent');
    assert.deepEqual(flames().map(flame => flame.destroyed), [1, 1]);
});

test('hiding the ship hides the hull, the exhaust and the boost imagery together', () => {
    const hidden = [];
    const { Spaceship } = transpileModule('src/game/objects/spaceship/spaceship.ts', {
        phaser: { Physics: {}, Scene: class {} },
        '../_shared/sceneObject': {
            SceneObject: class {
                constructor () {
                    this.sprite = { setRotation () {}, setVisible: visible => hidden.push(['hull', visible]) };
                    this.body = { setEnable () {}, setVelocity () {} };
                }
                setPosition () {}
                ownCleanup () {}
            }
        },
        './definition': { definition: { id: 'spaceship' } },
        './boostEffects': { BoostEffects: class { setVisible (visible) { hidden.push(['boost', visible]); } update () {} destroy () {} } },
        './engineExhaust': { EngineExhaust: class { setVisible (visible) { hidden.push(['exhaust', visible]); } update () {} destroy () {} } },
        './exhaustLayout': { engineExhaustLayout: () => [] }
    });
    const ship = new Spaceship({}, { position: { x: 0, y: 0 }, rotation: 0, enginesOn: false, boosting: false });
    ship.setVisible(false);
    assert.deepEqual(hidden, [['hull', false], ['exhaust', false], ['boost', false]]);
    ship.setVisible(true);
    assert.deepEqual(hidden.slice(3), [['hull', true], ['exhaust', true], ['boost', true]]);
});

test('the split spaceship definition loads a hull and both flame variants from real assets', () => {
    const { definition } = transpileModule('src/game/objects/spaceship/definition.ts', {
        '../../visual/layers': { ObjectDepth: { Ship: 20 } },
        '../../definitions/gameplayTuning.ts': { shipTuning: { collisionRadius: 18 } }
    });
    assert.equal(definition.visual.texture, 'object:spaceship:hull');
    assert.equal(definition.animations.length, 0, 'flames no longer ride on a sprite animation');
    assert.deepEqual(definition.assets.map(asset => asset.key), [
        'object:spaceship:hull',
        'object:spaceship:flame-normal',
        'object:spaceship:flame-hot'
    ]);
    for (const asset of definition.assets) assert.ok(existsSync(`public/assets/${asset.path}`), asset.path);
    assert(!existsSync('public/assets/objects/spaceship/engine-on-sequence.svg'), 'the retired twin-flame spritesheet is gone');
    assert(!existsSync('public/assets/objects/spaceship/engines-off.svg'), 'the nozzle-baked hull is replaced by the split hull');
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
    await mkdir(join(fixture, 'src/game/domain'), { recursive: true });
    await cp('src/game/domain/runBalance.ts', join(fixture, 'src/game/domain/runBalance.ts'));
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
