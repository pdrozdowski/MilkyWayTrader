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

test('every hull-health bar shares one colour-band skin', () => {
    const stylesheet = readFileSync('public/style.css', 'utf8');
    assert.match(stylesheet, /progress\[data-health-band\] \{ --ui-health-fill: var\(--ui-health\);/, 'the shared skin declares the healthy fill once');
    assert.match(stylesheet, /progress\[data-health-band="warning"\] \{ --ui-health-fill: var\(--ui-health-warning\); \}/);
    assert.match(stylesheet, /progress\[data-health-band="critical"\] \{ --ui-health-fill: var\(--ui-health-critical\); \}/);
    assert.match(stylesheet, /progress\[data-health-band\]::-webkit-progress-value \{ background: var\(--ui-health-fill\); \}/);
    assert.match(stylesheet, /progress\[data-health-band\]::-moz-progress-bar \{ background: var\(--ui-health-fill\); \}/);
    assert.equal((stylesheet.match(/--ui-health-fill:/g) ?? []).length, 3, 'each band maps to the fill variable exactly once');
    for (const selector of ['#run-status-hp', '\\.shipyard-repair-bar']) {
        assert(!new RegExp(`${selector}(?:\\[[^\\]]*\\])?::`).test(stylesheet), `${selector} must paint through the shared skin`);
    }
});

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
        this.dataset = {};
        this.className = '';
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

    getAttribute (name) {
        return this.attributes[name] ?? null;
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
    const root = new FakeElement({ '#main-menu-sign-in-preview': signIn });
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

    signIn.click();
    await Promise.resolve();
    assert.equal(signOuts, 1);
    assert.equal(label.textContent, 'Sign In');

    handle.destroy();
    assert(unsubscribed);
    assert.equal(signIn.listeners.size, 0);
});

test('cargo transfer renders cargo/commodity/ship columns, usage, and directional one/max controls for all five commodities without average price', () => {
    const row = () => new FakeElement({
        '.cargo-transfer-row-cargo-quantity': new FakeElement(),
        '.cargo-transfer-row-ship-quantity': new FakeElement(),
        '.cargo-transfer-row-cargo .cargo-transfer-row-icon': new FakeElement(),
        '.cargo-transfer-row-ship .cargo-transfer-row-icon': new FakeElement(),
        '.cargo-transfer-row-name': new FakeElement(),
        ...Object.fromEntries(Object.entries(buttonLabels).map(([selector, label]) => {
            const button = new FakeElement();
            button.setAttribute('aria-label', label);
            return [selector, button];
        }))
    });
    const modal = new FakeElement();
    const title = new FakeElement();
    const cargoHeader = new FakeElement();
    const commodityHeader = new FakeElement();
    const shipHeader = new FakeElement();
    const cargoUsage = new FakeElement();
    const shipUsage = new FakeElement();
    const cargoCapacity = new FakeElement({
        '.cargo-transfer-capacity-fill': new FakeElement(),
        '.cargo-transfer-capacity-state': new FakeElement(),
        '.cargo-transfer-capacity-track': new FakeElement()
    });
    cargoCapacity.children['.cargo-transfer-capacity-fill'].style = {};
    const shipCapacity = new FakeElement({
        '.cargo-transfer-capacity-fill': new FakeElement(),
        '.cargo-transfer-capacity-state': new FakeElement(),
        '.cargo-transfer-capacity-track': new FakeElement()
    });
    shipCapacity.children['.cargo-transfer-capacity-fill'].style = {};
    const warning = new FakeElement();
    const close = new FakeElement();
    const commodityIds = transpileModule('src/game/domain/serotonMarketCatalog.ts', {}).serotonCommodityIds;
    const buttonLabels = {
        '.cargo-transfer-to-ship-one': 'Transfer one unit to ship',
        '.cargo-transfer-to-ship-max': 'Transfer all to ship',
        '.cargo-transfer-to-cargo-one': 'Transfer one unit to cargo',
        '.cargo-transfer-to-cargo-max': 'Transfer all to cargo'
    };
    const quantities = { milk: [2, 1], grain: [0, 3], cheese: [5, 0], bun: [1, 2], spaceRation: [3, 4] };
    assert.deepEqual(Object.keys(quantities), [...commodityIds], 'derived commodity ids stay aligned with the transfer fixtures');
    const rows = Object.fromEntries(commodityIds.map(commodityId => [commodityId, row()]));
    const rowsContainer = new FakeElement(Object.fromEntries(commodityIds.map(commodityId => [`[data-commodity-id=${commodityId}]`, rows[commodityId]])));
    const root = new FakeElement({
        '#cargo-transfer': modal,
        '#cargo-transfer-title': title,
        '#cargo-transfer-cargo-header': cargoHeader,
        '#cargo-transfer-commodity-header': commodityHeader,
        '#cargo-transfer-ship-header': shipHeader,
        '#cargo-transfer-cargo-usage': cargoUsage,
        '#cargo-transfer-ship-usage': shipUsage,
        '#cargo-transfer-cargo-capacity': cargoCapacity,
        '#cargo-transfer-ship-capacity': shipCapacity,
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
        rows: commodityIds.map(commodityId => ({ commodityId, cargoQuantity: quantities[commodityId][0], shipQuantity: quantities[commodityId][1] })),
        cargoUsed: 11, cargoCapacity: 20, shipUsed: 10, shipCapacity: 20, warning: null
    });
    assert.equal(modal.hidden, false);
    assert.equal(title.textContent, displayLabels.cargoTransferTitle);
    assert.equal(cargoHeader.textContent, displayLabels.cargoTransferCargoHeader);
    assert.equal(commodityHeader.textContent, displayLabels.cargoTransferCommodityHeader);
    assert.equal(shipHeader.textContent, displayLabels.cargoTransferShipHeader);
    assert.equal(cargoUsage.textContent, '11/20');
    assert.equal(shipUsage.textContent, '10/20');
    assert(Math.abs(parseFloat(cargoCapacity.children['.cargo-transfer-capacity-fill'].style.width) - 55) < 0.0001);
    assert(Math.abs(parseFloat(shipCapacity.children['.cargo-transfer-capacity-fill'].style.width) - 50) < 0.0001);
    assert.equal(cargoCapacity.children['.cargo-transfer-capacity-track'].attributes['aria-valuenow'], '11');
    assert.equal(shipCapacity.children['.cargo-transfer-capacity-track'].attributes['aria-valuemax'], '20');
    const control = (commodityId, selector) => rows[commodityId].querySelector(selector);
    for (const commodityId of commodityIds) {
        const label = displayLabels.commodityLabels[commodityId];
        assert.equal(rows[commodityId].hidden, false, `${commodityId} row is visible while it appears in the transfer manifest`);
        assert.equal(control(commodityId, '.cargo-transfer-row-cargo-quantity').textContent, String(quantities[commodityId][0]));
        assert.equal(control(commodityId, '.cargo-transfer-row-ship-quantity').textContent, String(quantities[commodityId][1]));
        for (const selector of ['.cargo-transfer-row-cargo .cargo-transfer-row-icon', '.cargo-transfer-row-ship .cargo-transfer-row-icon']) {
            assert.equal(control(commodityId, selector).textContent, '', 'the row icon is an image tile, not a letter');
            assert.equal(control(commodityId, selector).dataset.commodityId, commodityId);
            assert(control(commodityId, selector).className.includes('commodity-icon'));
            assert.equal(control(commodityId, selector).attributes['aria-hidden'], 'true');
        }
        assert.equal(control(commodityId, '.cargo-transfer-row-name').textContent, label);
        for (const [selector, label] of Object.entries(buttonLabels)) {
            assert.equal(control(commodityId, selector).getAttribute('aria-label'), label);
        }
    }
    assert.equal(control('milk', '.cargo-transfer-to-ship-one').disabled, false);
    assert.equal(control('milk', '.cargo-transfer-to-cargo-one').disabled, false);
    assert.equal(control('grain', '.cargo-transfer-to-ship-one').disabled, true, 'zero orbital quantity disables the to-ship control');
    assert.equal(control('grain', '.cargo-transfer-to-cargo-one').disabled, false);
    assert.equal(control('cheese', '.cargo-transfer-to-cargo-one').disabled, true, 'zero ship quantity disables the to-orbit control');
    assert.equal(close.textContent, displayLabels.cargoTransferConfirm);
    const rendered = [cargoUsage, shipUsage, control('milk', '.cargo-transfer-row-cargo-quantity'), control('milk', '.cargo-transfer-row-ship-quantity'), control('milk', '.cargo-transfer-to-ship-one'), control('milk', '.cargo-transfer-to-ship-max'), control('milk', '.cargo-transfer-to-cargo-one'), control('milk', '.cargo-transfer-to-cargo-max')]
        .map(element => element.textContent).join(' ');
    assert(!rendered.includes(displayLabels.averageBuyPrice), 'transfer view never shows the market average price');
    control('milk', '.cargo-transfer-to-ship-max').click();
    assert.deepEqual(transfers, [{ commodityId: 'milk', direction: 'to-ship', amount: 'max' }]);
    control('milk', '.cargo-transfer-to-cargo-one').click();
    assert.deepEqual(transfers, [
        { commodityId: 'milk', direction: 'to-ship', amount: 'max' },
        { commodityId: 'milk', direction: 'to-orbit', amount: 'one' }
    ]);
    listener({ visible: true, cargoId: 'cargo-1', rows: [{ commodityId: 'milk', cargoQuantity: 5, shipQuantity: 3 }], cargoUsed: 20, cargoCapacity: 20, shipUsed: 20, shipCapacity: 20, warning: 'WARNING - CARGO IS FULL' });
    assert.equal(control('milk', '.cargo-transfer-to-ship-one').disabled, true, 'a full ship cannot receive cargo');
    assert.equal(control('milk', '.cargo-transfer-to-cargo-one').disabled, true, 'a full orbital manifest cannot receive cargo');
    assert.equal(rows.grain.hidden, true, 'commodities absent from both inventories stay hidden');
    assert.equal(warning.hidden, false);
    assert.equal(warning.textContent, 'WARNING - CARGO IS FULL');
    listener({ visible: true, cargoId: 'cargo-1', rows: [{ commodityId: 'milk', cargoQuantity: 0, shipQuantity: 3 }], cargoUsed: 0, cargoCapacity: 20, shipUsed: 3, shipCapacity: 20, warning: null });
    assert.equal(control('milk', '.cargo-transfer-to-ship-one').disabled, true, 'an emptied orbital manifest has nothing left to send');
    assert.equal(control('milk', '.cargo-transfer-to-cargo-one').disabled, false, 'an emptied orbital manifest can still receive ship cargo');
    handle.destroy();
    handle.destroy();
});
