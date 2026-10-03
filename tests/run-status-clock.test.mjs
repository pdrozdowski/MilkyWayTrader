import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function transpileModule (path, imports) {
    const source = readFileSync(path, 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
    const module = { exports: {} };
    new Function('require', 'module', 'exports', compiled)(name => imports[name], module, module.exports);
    return module.exports;
}

const { displayLabels } = transpileModule('src/ui/components/displayLabels.ts', {});
const { RunStatusClock } = transpileModule('src/ui/components/runStatusClock.ts', { './displayLabels': { displayLabels } });
const { mountAuthControls } = transpileModule('src/ui/components/authControls.ts', {
    '../contracts': {},
    './displayLabels': { displayLabels }
});

class FakeVector2 {
    constructor (x, y) { this.x = x; this.y = y; }
    normalize () { const length = Math.hypot(this.x, this.y); this.x /= length; this.y /= length; return this; }
    scale (value) { this.x *= value; this.y *= value; return this; }
    clone () { return new FakeVector2(this.x, this.y); }
    add (other) { this.x += other.x; this.y += other.y; return this; }
}

const { ShipDestruction, shipDestructionDurationMs, shipDestructionFragmentCounts } = transpileModule('src/game/effects/shipDestruction.ts', {
    phaser: { Math: { Vector2: FakeVector2 } },
    '../visual/layers': { ObjectDepth: { Ship: 20, UI: 100 } }
});

class FakeScheduler {
    nextId = 1;
    callbacks = new Map();
    cleared = [];

    setInterval (callback, delayMs) {
        assert.equal(delayMs, 500);
        const id = this.nextId++;
        this.callbacks.set(id, callback);
        return id;
    }

    clearInterval (id) {
        this.cleared.push(id);
    }

    fire (id) {
        this.callbacks.get(id)?.();
    }
}

test('running clock selects the running image without an interval and exposes its semantic state', () => {
    const scheduler = new FakeScheduler();
    const clock = new RunStatusClock(scheduler, () => {});
    clock.update(65, 'RUNNING', true);
    assert.deepEqual(clock.snapshot(), {
        imageSource: '/assets/icons/clock_32x32.png', value: '01:05', accessibleName: `01:05 · ${displayLabels.clockRunning}`
    });
    assert.equal(scheduler.callbacks.size, 0);
});

test('visible paused clock starts on frame one and alternates at 500 ms', () => {
    const scheduler = new FakeScheduler();
    const clock = new RunStatusClock(scheduler, () => {});
    clock.update(9, 'PAUSED', true);
    assert.equal(clock.snapshot().imageSource, '/assets/icons/clock_paused_1_32x32.png');
    assert.equal(clock.snapshot().accessibleName, `00:09 · ${displayLabels.clockPaused}`);
    scheduler.fire(1);
    assert.equal(clock.snapshot().imageSource, '/assets/icons/clock_paused_2_32x32.png');
    scheduler.fire(1);
    assert.equal(clock.snapshot().imageSource, '/assets/icons/clock_paused_1_32x32.png');
});

test('resuming stops paused animation and restores the running image', () => {
    const scheduler = new FakeScheduler();
    const clock = new RunStatusClock(scheduler, () => {});
    clock.update(12, 'PAUSED', true);
    clock.update(12, 'RUNNING', true);
    assert.equal(clock.snapshot().imageSource, '/assets/icons/clock_32x32.png');
    assert.deepEqual(scheduler.cleared, [1]);
});

test('hide and idempotent destroy clean up animation while stale callbacks cannot change presentation', () => {
    const scheduler = new FakeScheduler();
    let updates = 0;
    const clock = new RunStatusClock(scheduler, () => { updates++; });
    clock.update(12, 'PAUSED', true);
    clock.update(12, 'PAUSED', false);
    assert.deepEqual(scheduler.cleared, [1]);
    const hiddenImage = clock.snapshot().imageSource;
    scheduler.fire(1);
    assert.equal(clock.snapshot().imageSource, hiddenImage);
    clock.update(12, 'PAUSED', true);
    clock.destroy();
    clock.destroy();
    assert.deepEqual(scheduler.cleared, [1, 2]);
    const updatesBeforeStaleCallback = updates;
    scheduler.fire(2);
    assert.equal(updates, updatesBeforeStaleCallback);
});

test('ship destruction creates five large and eight small fragments, uses the exact transition duration, and cleans up idempotently', () => {
    const events = { handlers: new Map(), once (name, callback) { this.handlers.set(name, callback); }, off (name, callback) { if (this.handlers.get(name) === callback) this.handlers.delete(name); } };
    const tweens = { added: [], killed: [], add (config) { this.added.push(config); }, killTweensOf (target) { this.killed.push(target); } };
    const graphics = [];
    const graphic = () => {
        const item = { destroyed: 0, alpha: 1, rotation: 0, fillStyle () { return this; }, fillTriangle () { return this; }, fillCircle () { return this; }, setDepth () { return this; }, setPosition (x, y) { this.x = x; this.y = y; return this; }, setRotation (value) { this.rotation = value; return this; }, destroy () { this.destroyed++; } };
        graphics.push(item); return item;
    };
    const overlay = { destroyed: 0, setOrigin () { return this; }, setScrollFactor () { return this; }, setDepth () { return this; }, destroy () { this.destroyed++; } };
    const scene = { events, tweens, scale: { width: 1024, height: 768 }, add: { graphics: graphic, rectangle: () => overlay } };
    const effect = new ShipDestruction(scene);
    effect.play({ x: 8, y: 12 }, () => {});
    assert.deepEqual(shipDestructionFragmentCounts, { large: 5, small: 8 });
    assert.equal(graphics.length, shipDestructionFragmentCounts.large + shipDestructionFragmentCounts.small);
    assert.equal(tweens.added.length, graphics.length + 1);
    assert(tweens.added.every(tween => tween.duration === shipDestructionDurationMs));
    effect.destroy(); effect.destroy();
    assert.deepEqual(graphics.map(item => item.destroyed), Array(graphics.length).fill(1));
    assert.equal(overlay.destroyed, 1);
    assert.equal(events.handlers.size, 0);
});

class FakeElement {
    constructor (children = {}) {
        this.children = children;
        this.textContent = '';
        this.title = '';
        this.disabled = false;
        this.listeners = new Map();
        this.classList = { values: new Set(), toggle: (name, enabled) => enabled ? this.classList.values.add(name) : this.classList.values.delete(name) };
    }

    querySelector (selector) {
        return this.children[selector] ?? null;
    }

    addEventListener (type, listener) {
        this.listeners.set(type, listener);
    }

    removeEventListener (type, listener) {
        if (this.listeners.get(type) === listener) this.listeners.delete(type);
    }

    click () {
        this.listeners.get('click')?.();
    }
}

test('a signed-in player can locally sign out without changing the game-facing controls', async () => {
    const label = new FakeElement();
    const signIn = new FakeElement({ '.main-menu-sign-in-preview-label': label });
    const status = new FakeElement();
    const root = new FakeElement({ '#main-menu-sign-in-preview': signIn, '#run-status-auth': status });
    let snapshot = { status: 'signed-in', email: 'pilot@example.test', message: null };
    let listener = null;
    let signOuts = 0;
    let unsubscribed = false;
    const port = {
        getSnapshot: () => snapshot,
        subscribe: next => { listener = next; return () => { unsubscribed = true; }; },
        signInWithGoogle: async () => { throw new Error('A signed-in player must not start sign-in again.'); },
        signOut: async () => {
            signOuts++;
            snapshot = { status: 'unsigned', email: null, message: null };
            listener(snapshot);
        },
        destroy: () => {}
    };

    const handle = mountAuthControls(root, port);
    assert.equal(label.textContent, 'pilot@example.test');
    assert.equal(status.textContent, 'pilot@example.test');
    assert(status.classList.values.has('run-status-auth--signed-in'));

    signIn.click();
    await Promise.resolve();
    assert.equal(signOuts, 1);
    assert.equal(label.textContent, 'Sign In');
    assert.equal(status.textContent, displayLabels.unsigned);
    assert(!status.classList.values.has('run-status-auth--signed-in'));

    handle.destroy();
    assert(unsubscribed);
    assert.equal(signIn.listeners.size, 0);
});
