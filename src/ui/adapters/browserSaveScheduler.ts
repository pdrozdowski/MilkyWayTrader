import type { SaveSchedulerPort } from '../../game/application/saves/runSaveCoordinator.ts';

export function createBrowserSaveScheduler (): SaveSchedulerPort
{
    return {
        now: () => performance.now(),
        setTimeout: (callback, delayMs) => window.setTimeout(callback, delayMs),
        clearTimeout: handle => window.clearTimeout(handle as number)
    };
}
