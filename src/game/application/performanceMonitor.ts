export const performanceStepIds = [
    'input-intent',
    'state-snapshot',
    'state-commit',
    'feedback-and-ship-sync',
    'planets',
    'weapon-asteroids',
    'removals-effects',
    'cargo-commodities'
] as const;

export type PerformanceStepId = (typeof performanceStepIds)[number];

export interface PerformanceDurationSummary
{
    readonly averageMs: number;
    readonly minimumMs: number;
    readonly maximumMs: number;
    readonly sampleCount: number;
}

export interface PerformanceStepSummary extends PerformanceDurationSummary
{
    readonly id: PerformanceStepId;
}

export interface PerformanceSnapshot
{
    readonly enabled: boolean;
    readonly windowMs: number;
    readonly loopsPerSecond: number;
    readonly frameCount: number;
    readonly frameInterval: PerformanceDurationSummary;
    readonly updatePhase: PerformanceDurationSummary;
    readonly sceneRender: PerformanceDurationSummary;
    readonly unaccounted: PerformanceDurationSummary;
    readonly steps: readonly PerformanceStepSummary[];
}

export interface PerformanceMonitorOptions
{
    readonly now: () => number;
    readonly windowMs?: number;
}

export interface PerformanceMonitor
{
    setEnabled(enabled: boolean): void;
    isEnabled(): boolean;
    frameStarted(): void;
    stepStarted(id: PerformanceStepId): void;
    stepEnded(): void;
    updatePhaseEnded(): void;
    renderStarted(): void;
    renderEnded(): void;
    snapshot(): PerformanceSnapshot;
}

interface PerformanceStepSample
{
    id: PerformanceStepId;
    durationMs: number;
}

interface PerformanceFrameSample
{
    startedAt: number;
    intervalMs: number | null;
    updateMs: number | null;
    renderMs: number | null;
    steps: PerformanceStepSample[];
}

function summarizeDurations (samples: readonly number[]): PerformanceDurationSummary
{
    if (samples.length === 0) return { averageMs: 0, minimumMs: 0, maximumMs: 0, sampleCount: 0 };
    let total = 0;
    let minimum = samples[0];
    let maximum = samples[0];
    for (const sample of samples)
    {
        total += sample;
        if (sample < minimum) minimum = sample;
        if (sample > maximum) maximum = sample;
    }
    return { averageMs: total / samples.length, minimumMs: minimum, maximumMs: maximum, sampleCount: samples.length };
}

/**
 * Pure rolling measurement of the gameplay frame: eight named update-step durations plus
 * frame-level pacing, summarized over a fixed retention span.
 *
 * The scene feeds markers in frame order. Every recording call returns immediately while
 * disabled, so the disabled path costs one boolean read per marker, and enabling always
 * starts from an empty span.
 */
export function createPerformanceMonitor ({ now, windowMs = 5000 }: PerformanceMonitorOptions): PerformanceMonitor
{
    const frames: PerformanceFrameSample[] = [];
    let enabled = false;
    let previousFrameStartedAt: number | null = null;
    let openStepId: PerformanceStepId | null = null;
    let openStepStartedAtMs = 0;
    let renderStartedAtMs: number | null = null;

    const currentFrame = (): PerformanceFrameSample | null => frames.length > 0 ? frames[frames.length - 1] : null;

    const closeOpenStep = (endedAtMs: number) =>
    {
        if (openStepId === null) return;
        const frame = currentFrame();
        if (frame !== null) frame.steps.push({ id: openStepId, durationMs: endedAtMs - openStepStartedAtMs });
        openStepId = null;
    };

    const dropExpiredFrames = (newestStartMs: number) =>
    {
        while (frames.length > 0 && frames[0].startedAt < newestStartMs - windowMs) frames.shift();
    };

    const loopsPerSecond = (): number =>
    {
        if (frames.length < 2) return 0;
        const elapsedMs = frames[frames.length - 1].startedAt - frames[0].startedAt;
        if (elapsedMs <= 0) return 0;
        return (frames.length - 1) / (elapsedMs / 1000);
    };

    return {
        setEnabled (value: boolean): void
        {
            enabled = value;
            frames.length = 0;
            previousFrameStartedAt = null;
            openStepId = null;
            renderStartedAtMs = null;
        },

        isEnabled: () => enabled,

        frameStarted (): void
        {
            if (!enabled) return;
            const startedAtMs = now();
            const previousStartedAtMs = previousFrameStartedAt;
            previousFrameStartedAt = startedAtMs;
            // A step or render left open by a malformed sequence belongs to no frame in the span.
            openStepId = null;
            renderStartedAtMs = null;
            dropExpiredFrames(startedAtMs);
            frames.push({
                startedAt: startedAtMs,
                intervalMs: previousStartedAtMs === null ? null : startedAtMs - previousStartedAtMs,
                updateMs: null,
                renderMs: null,
                steps: []
            });
        },

        stepStarted (id: PerformanceStepId): void
        {
            if (!enabled) return;
            const startedAtMs = now();
            closeOpenStep(startedAtMs);
            openStepId = id;
            openStepStartedAtMs = startedAtMs;
        },

        stepEnded (): void
        {
            if (!enabled) return;
            closeOpenStep(now());
        },

        updatePhaseEnded (): void
        {
            if (!enabled) return;
            const endedAtMs = now();
            closeOpenStep(endedAtMs);
            const frame = currentFrame();
            if (frame !== null) frame.updateMs = endedAtMs - frame.startedAt;
        },

        renderStarted (): void
        {
            if (!enabled) return;
            renderStartedAtMs = now();
        },

        renderEnded (): void
        {
            if (!enabled) return;
            const endedAtMs = now();
            const frame = currentFrame();
            if (frame !== null && renderStartedAtMs !== null) frame.renderMs = endedAtMs - renderStartedAtMs;
            renderStartedAtMs = null;
        },

        snapshot (): PerformanceSnapshot
        {
            const intervals: number[] = [];
            const updatePhases: number[] = [];
            const sceneRenders: number[] = [];
            const unaccounted: number[] = [];
            const stepDurations = new Map<PerformanceStepId, number[]>();
            for (const id of performanceStepIds) stepDurations.set(id, []);
            for (const frame of frames)
            {
                if (frame.intervalMs !== null) intervals.push(frame.intervalMs);
                if (frame.updateMs !== null) updatePhases.push(frame.updateMs);
                if (frame.renderMs !== null) sceneRenders.push(frame.renderMs);
                // Only a frame that reported all three spans has a meaningful remainder.
                if (frame.intervalMs !== null && frame.updateMs !== null && frame.renderMs !== null)
                {
                    unaccounted.push(Math.max(0, frame.intervalMs - frame.updateMs - frame.renderMs));
                }
                for (const step of frame.steps) stepDurations.get(step.id)?.push(step.durationMs);
            }
            return {
                enabled,
                windowMs,
                loopsPerSecond: loopsPerSecond(),
                frameCount: frames.length,
                frameInterval: summarizeDurations(intervals),
                updatePhase: summarizeDurations(updatePhases),
                sceneRender: summarizeDurations(sceneRenders),
                unaccounted: summarizeDurations(unaccounted),
                steps: performanceStepIds.map(id => ({ id, ...summarizeDurations(stepDurations.get(id) ?? []) }))
            };
        }
    };
}
