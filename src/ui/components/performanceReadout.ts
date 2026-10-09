import type { PerformanceDurationSummary, PerformanceReadoutPort, PerformanceSnapshot, PerformanceStepSummary, UiHandle } from '../contracts';
import { displayLabels } from './displayLabels';

interface ReadoutRow
{
    readonly id: string;
    readonly element: HTMLTableRowElement;
    readonly average: HTMLElement;
    readonly minimum: HTMLElement;
    readonly maximum: HTMLElement;
}

function required<T extends Element> (root: HTMLElement, selector: string): T
{
    const element = root.querySelector<T>(selector);
    if (!element) throw new Error(`Missing performance readout control: ${selector}`);
    return element;
}

function formatMilliseconds (value: number): string
{
    return `${value.toFixed(2)} ${displayLabels.performanceMonitorMillisecondsUnit}`;
}

function formatLoopsPerSecond (value: number): string
{
    return `${value.toFixed(1)} ${displayLabels.performanceMonitorLoopsPerSecondUnit}`;
}

function createRow (id: string, label: string): ReadoutRow
{
    const element = document.createElement('tr');
    element.id = `performance-readout-${id}`;
    const name = document.createElement('th');
    name.scope = 'row';
    name.textContent = label;
    const average = document.createElement('td');
    const minimum = document.createElement('td');
    const maximum = document.createElement('td');
    element.append(name, average, minimum, maximum);
    return { id, element, average, minimum, maximum };
}

export function mountPerformanceReadout (root: HTMLElement, port: PerformanceReadoutPort): UiHandle
{
    const panel = required<HTMLElement>(root, '#performance-readout');
    const rowsContainer = required<HTMLTableSectionElement>(root, '#performance-readout-rows');
    const footer = required<HTMLElement>(root, '#performance-readout-footer');
    const note = required<HTMLElement>(root, '#performance-readout-note');
    required<HTMLElement>(root, '#performance-readout-metric-heading').textContent = displayLabels.performanceMonitorColumnMetric;
    required<HTMLElement>(root, '#performance-readout-average-heading').textContent = displayLabels.performanceMonitorColumnAverage;
    required<HTMLElement>(root, '#performance-readout-minimum-heading').textContent = displayLabels.performanceMonitorColumnMinimum;
    required<HTMLElement>(root, '#performance-readout-maximum-heading').textContent = displayLabels.performanceMonitorColumnMaximum;
    note.textContent = displayLabels.performanceMonitorUpdatePhaseNote;
    const frameRows = {
        loopsPerSecond: createRow('loops-per-second', displayLabels.performanceMonitorLoopsPerSecond),
        frameInterval: createRow('frame-interval', displayLabels.performanceMonitorFrameInterval),
        updatePhase: createRow('update-phase', displayLabels.performanceMonitorUpdatePhase),
        sceneRender: createRow('scene-render', displayLabels.performanceMonitorSceneRender),
        unaccounted: createRow('unaccounted', displayLabels.performanceMonitorUnaccounted)
    };
    const stepRows = new Map<string, ReadoutRow>();
    const stepRow = (step: PerformanceStepSummary): ReadoutRow => {
        const existing = stepRows.get(step.id);
        if (existing) return existing;
        const created = createRow(step.id, displayLabels.performanceMonitorStepLabels[step.id]);
        stepRows.set(step.id, created);
        return created;
    };
    let rowsAttached = false;
    const renderDurations = (row: ReadoutRow, summary: PerformanceDurationSummary, showMinimum: boolean): void => {
        row.average.textContent = formatMilliseconds(summary.averageMs);
        row.minimum.textContent = showMinimum ? formatMilliseconds(summary.minimumMs) : '';
        row.maximum.textContent = formatMilliseconds(summary.maximumMs);
    };
    const render = (snapshot: Readonly<PerformanceSnapshot>): void => {
        panel.hidden = !snapshot.enabled;
        const steps = snapshot.steps.map(stepRow);
        if (!rowsAttached) {
            rowsAttached = true;
            rowsContainer.replaceChildren(...Object.values(frameRows).map(row => row.element), ...steps.map(row => row.element));
        }
        frameRows.loopsPerSecond.average.textContent = formatLoopsPerSecond(snapshot.loopsPerSecond);
        frameRows.loopsPerSecond.maximum.textContent = '';
        renderDurations(frameRows.frameInterval, snapshot.frameInterval, false);
        renderDurations(frameRows.updatePhase, snapshot.updatePhase, false);
        renderDurations(frameRows.sceneRender, snapshot.sceneRender, false);
        renderDurations(frameRows.unaccounted, snapshot.unaccounted, false);
        for (const [index, step] of snapshot.steps.entries()) renderDurations(steps[index], step, true);
        footer.textContent = `${displayLabels.performanceMonitorWindow}: ${(snapshot.windowMs / 1000).toFixed(1)} ${displayLabels.performanceMonitorSecondsUnit}, ${displayLabels.performanceMonitorFrames}: ${snapshot.frameCount}`;
    };
    const unsubscribe = port.subscribe(render);
    let destroyed = false;
    return { destroy: () => {
        if (destroyed) return;
        destroyed = true;
        unsubscribe();
        port.destroy();
    } };
}
