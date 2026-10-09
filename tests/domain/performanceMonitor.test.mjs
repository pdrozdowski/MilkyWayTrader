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

const { createPerformanceMonitor, performanceStepIds } = transpileModule('src/game/application/performanceMonitor.ts', {});

const declaredStepIds = [
    'input-intent',
    'state-snapshot',
    'state-commit',
    'feedback-and-ship-sync',
    'planets',
    'weapon-asteroids',
    'removals-effects',
    'cargo-commodities'
];
const zeroSummary = { averageMs: 0, minimumMs: 0, maximumMs: 0, sampleCount: 0 };
const summaryOf = step => ({ averageMs: step.averageMs, minimumMs: step.minimumMs, maximumMs: step.maximumMs, sampleCount: step.sampleCount });
const stepOf = (snapshot, id) => snapshot.steps.find(step => step.id === id);

function createFakeClock (startedAtMs = 0)
{
    let currentMs = startedAtMs;
    return {
        now: () => currentMs,
        advance: durationMs => { currentMs += durationMs; }
    };
}

function createMonitor (clock, windowMs)
{
    return createPerformanceMonitor(windowMs === undefined ? { now: () => clock.now() } : { now: () => clock.now(), windowMs });
}

// Feeds one full frame in scene order: frame start, the named steps, the update phase, the render span.
function runFrame (monitor, clock, steps, { updateTailMs = 0, renderMs = 0, frameTailMs = 0 } = {})
{
    monitor.frameStarted();
    for (const [id, durationMs] of steps)
    {
        monitor.stepStarted(id);
        clock.advance(durationMs);
    }
    monitor.stepEnded();
    clock.advance(updateTailMs);
    monitor.updatePhaseEnded();
    if (renderMs !== null)
    {
        monitor.renderStarted();
        clock.advance(renderMs);
        monitor.renderEnded();
    }
    clock.advance(frameTailMs);
}

test('a disabled monitor reports eight zeroed step rows in declared order and no frame samples', () => {
    const monitor = createMonitor(createFakeClock());
    const snapshot = monitor.snapshot();
    assert.equal(monitor.isEnabled(), false);
    assert.equal(snapshot.enabled, false);
    assert.equal(snapshot.windowMs, 5000);
    assert.equal(snapshot.loopsPerSecond, 0);
    assert.equal(snapshot.frameCount, 0);
    for (const metric of ['frameInterval', 'updatePhase', 'sceneRender', 'unaccounted']) assert.deepEqual(snapshot[metric], zeroSummary, `${metric} starts zeroed`);
    assert.deepEqual([...performanceStepIds], declaredStepIds, 'the exported step ids keep their declared order');
    assert.deepEqual(snapshot.steps.map(step => step.id), declaredStepIds, 'every step row is present in declared order');
    for (const step of snapshot.steps) assert.deepEqual(summaryOf(step), zeroSummary);
    assert.equal(createMonitor(createFakeClock(), 250).snapshot().windowMs, 250, 'a custom retention span is reported');
});

test('every recording call is a no-op while the monitor is disabled', () => {
    const clock = createFakeClock();
    const monitor = createMonitor(clock);
    runFrame(monitor, clock, [['state-commit', 4]], { updateTailMs: 1, renderMs: 3, frameTailMs: 2 });
    monitor.stepStarted('planets');
    clock.advance(6);
    monitor.stepEnded();
    monitor.renderStarted();
    clock.advance(7);
    monitor.renderEnded();
    const disabled = monitor.snapshot();
    assert.equal(disabled.frameCount, 0);
    assert.deepEqual(disabled.steps.map(summaryOf), Array(declaredStepIds.length).fill(zeroSummary));
    assert.deepEqual(disabled.frameInterval, zeroSummary);
    monitor.setEnabled(true);
    assert.equal(monitor.isEnabled(), true);
    assert.equal(monitor.snapshot().frameCount, 0, 'nothing recorded while disabled leaks into the span');
    runFrame(monitor, clock, [['state-commit', 4]], { updateTailMs: 1, renderMs: 3, frameTailMs: 2 });
    const enabled = monitor.snapshot();
    assert.equal(enabled.frameCount, 1);
    assert.equal(enabled.frameInterval.sampleCount, 0, 'the first enabled frame records no interval');
    assert.equal(enabled.updatePhase.averageMs, 5);
    assert.equal(enabled.sceneRender.averageMs, 3);
});

test('step durations summarize with unrounded average, minimum, maximum and count', () => {
    const clock = createFakeClock();
    const monitor = createMonitor(clock);
    monitor.setEnabled(true);
    for (const durationMs of [2, 4, 6]) runFrame(monitor, clock, [['state-commit', durationMs]], { updateTailMs: 1, renderMs: 2, frameTailMs: 3 });
    const snapshot = monitor.snapshot();
    assert.deepEqual(summaryOf(stepOf(snapshot, 'state-commit')), { averageMs: 4, minimumMs: 2, maximumMs: 6, sampleCount: 3 });
    assert.deepEqual(summaryOf(stepOf(snapshot, 'planets')), zeroSummary, 'a step without samples stays zeroed');

    const fractionalClock = createFakeClock();
    const fractionalMonitor = createMonitor(fractionalClock);
    fractionalMonitor.setEnabled(true);
    for (const durationMs of [1, 2]) runFrame(fractionalMonitor, fractionalClock, [['planets', durationMs]], { renderMs: 1 });
    assert.equal(summaryOf(stepOf(fractionalMonitor.snapshot(), 'planets')).averageMs, 1.5, 'averages stay unrounded');
});

test('opening the next step attributes the elapsed span to the previous step', () => {
    const clock = createFakeClock();
    const monitor = createMonitor(clock);
    monitor.setEnabled(true);
    monitor.frameStarted();
    monitor.stepStarted('state-snapshot');
    clock.advance(3);
    monitor.stepStarted('state-commit');
    clock.advance(2);
    monitor.stepEnded();
    const snapshot = monitor.snapshot();
    assert.deepEqual(summaryOf(stepOf(snapshot, 'state-snapshot')), { averageMs: 3, minimumMs: 3, maximumMs: 3, sampleCount: 1 });
    assert.deepEqual(summaryOf(stepOf(snapshot, 'state-commit')), { averageMs: 2, minimumMs: 2, maximumMs: 2, sampleCount: 1 });
});

test('a closed step is not counted again when the update phase ends', () => {
    const clock = createFakeClock();
    const monitor = createMonitor(clock);
    monitor.setEnabled(true);
    monitor.frameStarted();
    monitor.stepStarted('input-intent');
    clock.advance(2);
    monitor.stepEnded();
    clock.advance(3);
    monitor.updatePhaseEnded();
    const snapshot = monitor.snapshot();
    assert.deepEqual(summaryOf(stepOf(snapshot, 'input-intent')), { averageMs: 2, minimumMs: 2, maximumMs: 2, sampleCount: 1 });
    assert.equal(snapshot.updatePhase.averageMs, 5, 'the remaining span stays with the update phase');
});

test('a step left open when the update phase ends is closed instead of dropped', () => {
    const clock = createFakeClock();
    const monitor = createMonitor(clock);
    monitor.setEnabled(true);
    monitor.frameStarted();
    monitor.stepStarted('removals-effects');
    clock.advance(5);
    monitor.updatePhaseEnded();
    const snapshot = monitor.snapshot();
    assert.deepEqual(summaryOf(stepOf(snapshot, 'removals-effects')), { averageMs: 5, minimumMs: 5, maximumMs: 5, sampleCount: 1 });
    assert.equal(snapshot.updatePhase.averageMs, 5);
    assert.equal(snapshot.updatePhase.sampleCount, 1);
});

test('samples older than the retention span leave the rolling statistics', () => {
    const clock = createFakeClock();
    const monitor = createMonitor(clock);
    monitor.setEnabled(true);
    for (let index = 0; index < 60; index++)
    {
        runFrame(monitor, clock, [['weapon-asteroids', 5]], { updateTailMs: 1, renderMs: 4 });
        clock.advance(6.67);
    }
    const tallied = monitor.snapshot();
    assert.equal(tallied.frameCount, 60);
    assert.equal(summaryOf(stepOf(tallied, 'weapon-asteroids')).sampleCount, 60);
    assert.ok(Math.abs(tallied.loopsPerSecond - 60) < 0.1, `expected roughly 60 loops per second, got ${tallied.loopsPerSecond}`);

    clock.advance(5000);
    runFrame(monitor, clock, [['weapon-asteroids', 5]], { updateTailMs: 1, renderMs: 4 });
    const pruned = monitor.snapshot();
    assert.equal(pruned.frameCount, 1, 'frames older than the retention span leave the samples');
    assert.deepEqual(summaryOf(stepOf(pruned, 'weapon-asteroids')), { averageMs: 5, minimumMs: 5, maximumMs: 5, sampleCount: 1 },
        'the old step samples leave with their frames');
    assert.ok(pruned.frameInterval.averageMs > 5000, 'the first frame after the gap still measures its interval from the previous start');
    assert.equal(pruned.loopsPerSecond, 0, 'a single sample cannot report a loop rate');
});

test('unaccounted frame time never drops below zero', () => {
    const clock = createFakeClock();
    const monitor = createMonitor(clock);
    monitor.setEnabled(true);
    runFrame(monitor, clock, [['planets', 4]], { renderMs: 6 });
    runFrame(monitor, clock, [['planets', 4]], { updateTailMs: 16, renderMs: 5 });
    runFrame(monitor, clock, [['planets', 4]], { updateTailMs: 1, renderMs: 5 });
    const snapshot = monitor.snapshot();
    assert.equal(snapshot.unaccounted.sampleCount, 2, 'only frames that reported every span carry a remainder');
    assert.equal(snapshot.unaccounted.minimumMs, 0, 'an over-attributed frame is clamped to zero');
    assert.equal(snapshot.unaccounted.maximumMs, 15);
    assert.equal(snapshot.unaccounted.averageMs, 7.5);
    assert.equal(snapshot.frameInterval.averageMs, 17.5);
});

test('re-enabling clears earlier samples and starts a fresh span', () => {
    const clock = createFakeClock();
    const monitor = createMonitor(clock);
    monitor.setEnabled(true);
    for (let index = 0; index < 3; index++) runFrame(monitor, clock, [['planets', 4]], { updateTailMs: 1, renderMs: 2 });
    assert.equal(monitor.snapshot().frameCount, 3);
    monitor.setEnabled(false);
    assert.equal(monitor.isEnabled(), false);
    assert.equal(monitor.snapshot().frameCount, 0, 'disabling clears the samples');
    monitor.setEnabled(true);
    const cleared = monitor.snapshot();
    assert.equal(cleared.frameCount, 0);
    assert.deepEqual(cleared.steps.map(summaryOf), Array(declaredStepIds.length).fill(zeroSummary));
    assert.deepEqual(cleared.unaccounted, zeroSummary);
    runFrame(monitor, clock, [['planets', 4]], { updateTailMs: 1, renderMs: 2 });
    const fresh = monitor.snapshot();
    assert.equal(fresh.frameCount, 1);
    assert.equal(summaryOf(stepOf(fresh, 'planets')).sampleCount, 1);
    assert.equal(fresh.frameInterval.sampleCount, 0, 'the first frame after re-enabling records no interval');
});
