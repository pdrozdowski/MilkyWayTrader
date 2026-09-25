import type { LandingStatusPort, UiHandle } from '../contracts';
import { displayLabels } from './displayLabels';

function required<T extends Element> (root: HTMLElement, selector: string): T
{
    const element = root.querySelector<T>(selector);
    if (!element) throw new Error(`Missing landing status control: ${selector}`);
    return element;
}

export function mountLandingStatus (root: HTMLElement, port: LandingStatusPort): UiHandle
{
    const modal = required<HTMLElement>(root, '#landing-status');
    const title = required<HTMLElement>(root, '#landing-status-title');
    const paused = required<HTMLElement>(root, '#landing-status-paused');
    const market = required<HTMLElement>(root, '#landing-status-market');
    const shipyard = required<HTMLElement>(root, '#landing-status-shipyard');
    const launch = required<HTMLButtonElement>(root, '#landing-status-launch');
    const render = (snapshot: Readonly<import('../contracts').LandingStatusSnapshot>): void => {
        modal.hidden = !snapshot.visible;
        title.textContent = snapshot.planetName ? `${snapshot.planetName} ${displayLabels.landedSuffix}` : displayLabels.landed;
        paused.textContent = displayLabels.pausedTime;
        market.textContent = displayLabels.marketDeferred;
        shipyard.textContent = displayLabels.shipyardDeferred;
        launch.textContent = displayLabels.launch;
    };
    const unsubscribe = port.subscribe(render);
    launch.addEventListener('click', port.launch);
    let destroyed = false;
    return { destroy: () => {
        if (destroyed) return;
        destroyed = true;
        unsubscribe();
        launch.removeEventListener('click', port.launch);
        port.destroy();
    } };
}
