import { displayLabels } from './displayLabels';

export interface LandingClockState
{
    readonly remainingSeconds: number;
    readonly runState: string;
}

export interface LandingClockHandle
{
    render(clock: LandingClockState): void;
    destroy(): void;
}

export function mountLandingClock (element: HTMLElement, isActive: () => boolean): LandingClockHandle
{
    const image = element.querySelector<HTMLImageElement>('[data-landing-clock-image]');
    const value = element.querySelector<HTMLElement>('[data-landing-clock-value]');
    if (!image || !value) throw new Error('Missing landing clock image or value.');
    let runState: string = 'RUNNING';
    let pausedFrame = 0;
    let destroyed = false;
    const renderImage = (): void => {
        image.src = runState === 'PAUSED'
            ? `/assets/icons/clock_paused_${pausedFrame + 1}_32x32.png`
            : '/assets/icons/clock_32x32.png';
    };
    const interval = window.setInterval(() => {
        if (destroyed || runState !== 'PAUSED' || !isActive()) return;
        pausedFrame = pausedFrame === 0 ? 1 : 0;
        renderImage();
    }, 500);
    return {
        render: clock => {
            if (destroyed) return;
            if (runState !== clock.runState) pausedFrame = 0;
            runState = clock.runState;
            const time = `${String(Math.floor(clock.remainingSeconds / 60)).padStart(2, '0')}:${String(Math.floor(clock.remainingSeconds % 60)).padStart(2, '0')}`;
            value.textContent = `${time} · ${runState === 'PAUSED' ? displayLabels.clockPaused : displayLabels.clockRunning}`;
            element.setAttribute('aria-label', value.textContent);
            renderImage();
        },
        destroy: () => {
            if (destroyed) return;
            destroyed = true;
            window.clearInterval(interval);
        }
    };
}
