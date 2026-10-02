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
