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
const { mountCargoTransfer } = transpileModule('src/ui/components/cargoTransfer.ts', {
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
        this.attributes = {};
    }

    querySelector (selector) {
        return this.children[selector] ?? null;
    }

    addEventListener (type, listener) {
        this.listeners.set(type, listener);
    }

    setAttribute (name, value) {
        this.attributes[name] = value;
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

test('cargo transfer renders cargo/commodity/ship columns, usage, and directional one/max controls without average price', () => {
    const row = () => new FakeElement({
        '.cargo-transfer-row-cargo-quantity': new FakeElement(),
        '.cargo-transfer-row-ship-quantity': new FakeElement(),
        '.cargo-transfer-row-icon': new FakeElement(),
        '.cargo-transfer-row-name': new FakeElement(),
        '.cargo-transfer-to-ship-one': new FakeElement(),
        '.cargo-transfer-to-ship-max': new FakeElement(),
        '.cargo-transfer-to-cargo-one': new FakeElement(),
        '.cargo-transfer-to-cargo-max': new FakeElement()
    });
    const modal = new FakeElement();
    const title = new FakeElement();
    const cargoHeader = new FakeElement();
    const commodityHeader = new FakeElement();
    const shipHeader = new FakeElement();
    const cargoUsage = new FakeElement();
    const shipUsage = new FakeElement();
    const warning = new FakeElement();
    const close = new FakeElement();
    const supplies = row();
    const alloys = row();
    const medicines = row();
    const rowsContainer = new FakeElement({
        '[data-commodity-id=supplies]': supplies,
        '[data-commodity-id=alloys]': alloys,
        '[data-commodity-id=medicines]': medicines
    });
    const root = new FakeElement({
        '#cargo-transfer': modal,
        '#cargo-transfer-title': title,
        '#cargo-transfer-cargo-header': cargoHeader,
        '#cargo-transfer-commodity-header': commodityHeader,
        '#cargo-transfer-ship-header': shipHeader,
        '#cargo-transfer-cargo-usage': cargoUsage,
        '#cargo-transfer-ship-usage': shipUsage,
        '#cargo-transfer-rows': rowsContainer,
        '#cargo-transfer-warning': warning,
        '#cargo-transfer-close': close
    });
    let listener = null;
    const transfers = [];
    const port = {
        subscribe: next => { listener = next; return () => {}; },
        transfer: (commodityId, direction, amount) => { transfers.push({ commodityId, direction, amount }); },
        close: () => {}, destroy: () => {}
    };
    const handle = mountCargoTransfer(root, port);
    listener({
        visible: true, cargoId: 'cargo-1',
        rows: [
            { commodityId: 'supplies', cargoQuantity: 2, shipQuantity: 1 },
            { commodityId: 'alloys', cargoQuantity: 0, shipQuantity: 3 }
        ],
        cargoUsed: 2, cargoCapacity: 20, shipUsed: 4, shipCapacity: 20, warning: null
    });
    assert.equal(modal.hidden, false);
    assert.equal(title.textContent, displayLabels.cargoTransferTitle);
    assert.equal(cargoHeader.textContent, displayLabels.cargoTransferCargoHeader);
    assert.equal(commodityHeader.textContent, displayLabels.cargoTransferCommodityHeader);
    assert.equal(shipHeader.textContent, displayLabels.cargoTransferShipHeader);
    assert.equal(cargoUsage.textContent, '2/20');
    assert.equal(shipUsage.textContent, '4/20');
    const suppliesCargoQuantity = supplies.querySelector('.cargo-transfer-row-cargo-quantity');
    const suppliesShipQuantity = supplies.querySelector('.cargo-transfer-row-ship-quantity');
    const suppliesIcon = supplies.querySelector('.cargo-transfer-row-icon');
    const suppliesName = supplies.querySelector('.cargo-transfer-row-name');
    const suppliesToShipOne = supplies.querySelector('.cargo-transfer-to-ship-one');
    const suppliesToShipMax = supplies.querySelector('.cargo-transfer-to-ship-max');
    const suppliesToCargoOne = supplies.querySelector('.cargo-transfer-to-cargo-one');
    const suppliesToCargoMax = supplies.querySelector('.cargo-transfer-to-cargo-max');
    assert.equal(suppliesCargoQuantity.textContent, '2');
    assert.equal(suppliesShipQuantity.textContent, '1');
    assert.equal(suppliesIcon.textContent, 'S');
    assert.equal(suppliesIcon.attributes['aria-label'], `${displayLabels.supplies} commodity icon`);
    assert.equal(suppliesName.textContent, displayLabels.supplies);
    assert.equal(suppliesToShipOne.textContent, displayLabels.toShipOne);
    assert.equal(suppliesToShipMax.textContent, displayLabels.toShipMax);
    assert.equal(suppliesToCargoOne.textContent, displayLabels.toCargoOne);
    assert.equal(suppliesToCargoMax.textContent, displayLabels.toCargoMax);
    assert.equal(suppliesToShipOne.disabled, false);
    assert.equal(suppliesToCargoOne.disabled, false);
    const alloysToShipOne = alloys.querySelector('.cargo-transfer-to-ship-one');
    const alloysToCargoOne = alloys.querySelector('.cargo-transfer-to-cargo-one');
    assert.equal(alloysToShipOne.disabled, true, 'zero orbital quantity disables the to-ship control');
    assert.equal(alloysToCargoOne.disabled, false);
    assert.equal(medicines.hidden, true, 'commodities absent from both inventories stay hidden');
    assert.equal(close.textContent, displayLabels.cargoTransferConfirm);
    const rendered = [cargoUsage, shipUsage, suppliesCargoQuantity, suppliesShipQuantity, suppliesToShipOne, suppliesToShipMax, suppliesToCargoOne, suppliesToCargoMax]
        .map(element => element.textContent).join(' ');
    assert(!rendered.includes(displayLabels.averageBuyPrice), 'transfer view never shows the market average price');
    suppliesToShipMax.click();
    assert.deepEqual(transfers, [{ commodityId: 'supplies', direction: 'to-ship', amount: 'max' }]);
    suppliesToCargoOne.click();
    assert.deepEqual(transfers, [
        { commodityId: 'supplies', direction: 'to-ship', amount: 'max' },
        { commodityId: 'supplies', direction: 'to-orbit', amount: 'one' }
    ]);
    listener({ visible: true, cargoId: 'cargo-1', rows: [{ commodityId: 'supplies', cargoQuantity: 5, shipQuantity: 3 }], cargoUsed: 20, cargoCapacity: 20, shipUsed: 20, shipCapacity: 20, warning: 'WARNING - CARGO IS FULL' });
    assert.equal(suppliesToShipOne.disabled, true, 'a full ship cannot receive cargo');
    assert.equal(suppliesToCargoOne.disabled, true, 'a full orbital manifest cannot receive cargo');
    assert.equal(warning.hidden, false);
    assert.equal(warning.textContent, 'WARNING - CARGO IS FULL');
    listener({ visible: true, cargoId: 'cargo-1', rows: [{ commodityId: 'supplies', cargoQuantity: 0, shipQuantity: 3 }], cargoUsed: 0, cargoCapacity: 20, shipUsed: 3, shipCapacity: 20, warning: null });
    assert.equal(suppliesToShipOne.disabled, true, 'an emptied orbital manifest has nothing left to send');
    assert.equal(suppliesToCargoOne.disabled, false, 'an emptied orbital manifest can still receive ship cargo');
    handle.destroy();
    handle.destroy();
});
