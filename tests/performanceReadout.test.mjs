import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function transpileModule (path, imports)
{
    const source = readFileSync(path, 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
    const module = { exports: {} };
    new Function('require', 'module', 'exports', compiled)(name => imports[name], module, module.exports);
    return module.exports;
}

const { displayLabels } = transpileModule('src/ui/components/displayLabels.ts', {});
const { mountPerformanceReadout } = transpileModule('src/ui/components/performanceReadout.ts', {
    '../contracts': {},
    './displayLabels': { displayLabels }
});

// The step ids mirror the exported monitor contract: the readout renders whatever the
// snapshot's `steps` list carries, so this pins the row order the panel must produce.
const stepIds = ['input-intent', 'state-snapshot', 'state-commit', 'feedback-and-ship-sync', 'planets', 'weapon-asteroids', 'removals-effects', 'cargo-commodities'];
const summary = (averageMs, minimumMs, maximumMs, sampleCount) => ({ averageMs, minimumMs, maximumMs, sampleCount });
const snapshotOf = overrides => ({
    enabled: true,
    windowMs: 5000,
    loopsPerSecond: 59.94,
    frameCount: 300,
    frameInterval: summary(16.6667, 15.1, 21.5, 299),
    updatePhase: summary(6.5, 5.25, 9.5, 300),
    sceneRender: summary(4.75, 4, 6.125, 299),
    unaccounted: summary(5.4167, 0, 7.25, 299),
    steps: stepIds.map((id, index) => ({ id, ...summary(index + 1.234, index + 0.5, index + 2.5, 300) })),
    ...overrides
});

class FakeElement {
    constructor (children = {}) {
        this.children = children;
        this.textContent = '';
        this.hidden = false;
        this.id = '';
        this.scope = '';
        this.style = {};
        this.appended = [];
        this.replaceChildrenCalls = 0;
        this.listeners = new Map();
        this.attributes = {};
    }

    querySelector (selector) {
        return this.children[selector] ?? null;
    }

    append (...nodes) {
        this.appended.push(...nodes);
    }

    replaceChildren (...nodes) {
        this.replaceChildrenCalls++;
        this.replacedChildren = nodes;
    }

    setAttribute (name, value) {
        this.attributes[name] = value;
    }
}

globalThis.document = { createElement: () => new FakeElement() };

function mountReadout (snapshot)
{
    const panel = new FakeElement();
    const rows = new FakeElement();
    const footer = new FakeElement();
    const note = new FakeElement();
    const root = new FakeElement({
        '#performance-readout': panel,
        '#performance-readout-rows': rows,
        '#performance-readout-footer': footer,
        '#performance-readout-note': note,
        '#performance-readout-metric-heading': new FakeElement(),
        '#performance-readout-average-heading': new FakeElement(),
        '#performance-readout-minimum-heading': new FakeElement(),
        '#performance-readout-maximum-heading': new FakeElement()
    });
    const state = { current: snapshot, listener: null, unsubscribed: 0, destroyed: 0, active: true };
    const port = {
        getSnapshot: () => state.current,
        subscribe: listener => {
            state.listener = listener;
            listener(state.current);
            return () => { state.active = false; state.unsubscribed++; };
        },
        destroy: () => { state.destroyed++; }
    };
    const handle = mountPerformanceReadout(root, port);
    return {
        root, panel, rows, footer, note, handle, state,
        push: next => { state.current = next; if (state.active) state.listener(next); },
        labelOf: row => row.appended[0].textContent,
        averageOf: row => row.appended[1].textContent,
        minimumOf: row => row.appended[2].textContent,
        maximumOf: row => row.appended[3].textContent
    };
}

test('mounting renders thirteen rows of frame metrics and named steps with formatted values', () => {
    const readout = mountReadout(snapshotOf({}));
    assert.equal(readout.rows.replacedChildren.length, 13, 'five frame metrics plus eight steps');

    const [loops, frameInterval, updatePhase, sceneRender, unaccounted, ...steps] = readout.rows.replacedChildren;
    assert.deepEqual(readout.rows.replacedChildren.map(row => row.id), [
        'performance-readout-loops-per-second',
        'performance-readout-frame-interval',
        'performance-readout-update-phase',
        'performance-readout-scene-render',
        'performance-readout-unaccounted',
        ...stepIds.map(id => `performance-readout-${id}`)
    ], 'the panel keeps the monitor declared order');

    assert.equal(readout.labelOf(loops), displayLabels.performanceMonitorLoopsPerSecond);
    assert.equal(readout.averageOf(loops), `59.9 ${displayLabels.performanceMonitorLoopsPerSecondUnit}`, 'loops per second keep one decimal');
    assert.equal(readout.maximumOf(loops), '', 'a rate has no maximum row');

    assert.equal(readout.labelOf(frameInterval), displayLabels.performanceMonitorFrameInterval);
    assert.equal(readout.averageOf(frameInterval), `16.67 ${displayLabels.performanceMonitorMillisecondsUnit}`, 'milliseconds keep two decimals');
    assert.equal(readout.minimumOf(frameInterval), '', 'frame metrics report average and maximum only');
    assert.equal(readout.maximumOf(frameInterval), `21.50 ${displayLabels.performanceMonitorMillisecondsUnit}`);

    for (const id of ['update-phase', 'scene-render', 'unaccounted']) {
        const row = { 'update-phase': updatePhase, 'scene-render': sceneRender, unaccounted }[id];
        assert.equal(row.id, `performance-readout-${id}`);
        assert.equal(readout.labelOf(row), displayLabels[{
            'update-phase': 'performanceMonitorUpdatePhase',
            'scene-render': 'performanceMonitorSceneRender',
            unaccounted: 'performanceMonitorUnaccounted'
        }[id]]);
    }

    for (const [index, step] of steps.entries()) {
        const expected = snapshotOf({}).steps[index];
        assert.equal(step.id, `performance-readout-${expected.id}`);
        assert.equal(readout.labelOf(step), displayLabels.performanceMonitorStepLabels[expected.id]);
        assert.equal(readout.averageOf(step), `${expected.averageMs.toFixed(2)} ${displayLabels.performanceMonitorMillisecondsUnit}`);
        assert.equal(readout.minimumOf(step), `${expected.minimumMs.toFixed(2)} ${displayLabels.performanceMonitorMillisecondsUnit}`);
        assert.equal(readout.maximumOf(step), `${expected.maximumMs.toFixed(2)} ${displayLabels.performanceMonitorMillisecondsUnit}`);
    }

    assert.equal(readout.footer.textContent, `${displayLabels.performanceMonitorWindow}: 5.0 ${displayLabels.performanceMonitorSecondsUnit}, ${displayLabels.performanceMonitorFrames}: 300`);
    assert.equal(readout.note.textContent, displayLabels.performanceMonitorUpdatePhaseNote, 'the update-phase surplus is documented in the readout');
    assert.equal(readout.root.querySelector('#performance-readout-metric-heading').textContent, displayLabels.performanceMonitorColumnMetric);
    assert.equal(readout.root.querySelector('#performance-readout-average-heading').textContent, displayLabels.performanceMonitorColumnAverage);
    assert.equal(readout.root.querySelector('#performance-readout-minimum-heading').textContent, displayLabels.performanceMonitorColumnMinimum);
    assert.equal(readout.root.querySelector('#performance-readout-maximum-heading').textContent, displayLabels.performanceMonitorColumnMaximum);
});

test('the panel hides while the monitor is disabled and shows as soon as a sample reports it enabled', () => {
    const readout = mountReadout(snapshotOf({ enabled: false, frameCount: 0, loopsPerSecond: 0 }));
    assert.equal(readout.panel.hidden, true, 'a disabled monitor leaves no panel on screen');
    readout.push(snapshotOf({ enabled: true }));
    assert.equal(readout.panel.hidden, false, 'the enabled sample reveals the panel');
    readout.push(snapshotOf({ enabled: false }));
    assert.equal(readout.panel.hidden, true, 'turning the monitor off hides the panel again');
});

test('a pushed snapshot re-renders the existing rows without rebuilding them', () => {
    const readout = mountReadout(snapshotOf({}));
    assert.equal(readout.rows.replaceChildrenCalls, 1);
    readout.push(snapshotOf({
        loopsPerSecond: 30,
        frameCount: 150,
        updatePhase: summary(12.5, 11, 14, 150)
    }));
    const updatePhaseRow = readout.rows.replacedChildren[2];
    assert.equal(readout.averageOf(updatePhaseRow), `12.50 ${displayLabels.performanceMonitorMillisecondsUnit}`);
    assert.equal(readout.maximumOf(updatePhaseRow), `14.00 ${displayLabels.performanceMonitorMillisecondsUnit}`);
    assert.equal(readout.averageOf(readout.rows.replacedChildren[0]), `30.0 ${displayLabels.performanceMonitorLoopsPerSecondUnit}`);
    assert.equal(readout.footer.textContent, `${displayLabels.performanceMonitorWindow}: 5.0 ${displayLabels.performanceMonitorSecondsUnit}, ${displayLabels.performanceMonitorFrames}: 150`);
    assert.equal(readout.rows.replaceChildrenCalls, 1, 'a refresh updates the cells instead of recreating the table');
});

test('destroy unsubscribes once, destroys the port once after a stale push stops re-rendering', () => {
    const readout = mountReadout(snapshotOf({}));
    readout.handle.destroy();
    assert.equal(readout.state.unsubscribed, 1);
    assert.equal(readout.state.destroyed, 1);
    const renderedBefore = readout.averageOf(readout.rows.replacedChildren[0]);
    readout.push(snapshotOf({ loopsPerSecond: 12 }));
    assert.equal(readout.averageOf(readout.rows.replacedChildren[0]), renderedBefore, 'a sample after teardown never touches the panel');
    readout.handle.destroy();
    assert.equal(readout.state.unsubscribed, 1, 'destroy stays idempotent');
    assert.equal(readout.state.destroyed, 1, 'the port is destroyed exactly once');
});
