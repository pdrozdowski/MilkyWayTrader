export function activeTimeCycle (phase: number, speedPerMs: number, activeElapsedMs: number): number
{
    return (phase + activeElapsedMs * speedPerMs) % 1;
}

export function activeTimeWave (phase: number, angularFrequencyPerMs: number, activeElapsedMs: number): number
{
    return Math.sin(phase + activeElapsedMs * angularFrequencyPerMs);
}
