import type { RunStatusSnapshot } from '../contracts';
import { displayLabels } from './displayLabels';

type RunState = RunStatusSnapshot['runState'];

export interface IntervalScheduler
{
    setInterval(callback: () => void, delayMs: number): number;
    clearInterval(intervalId: number): void;
}

export interface RunStatusClockSnapshot
{
    readonly imageSource: string;
    readonly value: string;
    readonly accessibleName: string;
}

const runningImageSource = '/assets/icons/clock_32x32.png';
const pausedImageSources = ['/assets/icons/clock_paused_1_32x32.png', '/assets/icons/clock_paused_2_32x32.png'] as const;

export class RunStatusClock
{
    private remainingSeconds = 0;
    private runState: RunState = 'RUNNING';
    private visible = false;
    private pausedFrame = 0;
    private intervalId: number | null = null;
    private destroyed = false;
    private readonly scheduler: IntervalScheduler;
    private readonly onChange: () => void;

    public constructor (scheduler: IntervalScheduler, onChange: () => void)
    {
        this.scheduler = scheduler;
        this.onChange = onChange;
    }

    public update (remainingSeconds: number, runState: RunState, visible: boolean): void
    {
        if (this.destroyed) return;
        const wasPaused = this.runState === 'PAUSED';
        this.remainingSeconds = remainingSeconds;
        this.runState = runState;
        this.visible = visible;
        if (!visible || runState === 'RUNNING') {
            this.stopInterval();
            this.pausedFrame = 0;
        } else if (!wasPaused) {
            this.pausedFrame = 0;
            this.startInterval();
        } else this.startInterval();
        this.onChange();
    }

    public snapshot (): RunStatusClockSnapshot
    {
        const value = formatClock(this.remainingSeconds);
        const stateLabel = this.runState === 'RUNNING' ? displayLabels.clockRunning : displayLabels.clockPaused;
        return {
            imageSource: this.runState === 'RUNNING' ? runningImageSource : pausedImageSources[this.pausedFrame],
            value,
            accessibleName: `${value} · ${stateLabel}`
        };
    }

    public destroy (): void
    {
        if (this.destroyed) return;
        this.destroyed = true;
        this.stopInterval();
    }

    private startInterval (): void
    {
        if (this.intervalId !== null || !this.visible || this.runState !== 'PAUSED') return;
        this.intervalId = this.scheduler.setInterval(() => {
            if (this.destroyed || !this.visible || this.runState !== 'PAUSED') return;
            this.pausedFrame = this.pausedFrame === 0 ? 1 : 0;
            this.onChange();
        }, 500);
    }

    private stopInterval (): void
    {
        if (this.intervalId === null) return;
        this.scheduler.clearInterval(this.intervalId);
        this.intervalId = null;
    }
}

export function formatClock (seconds: number): string
{
    return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}
