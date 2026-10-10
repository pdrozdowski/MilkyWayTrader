import { displayLabels } from './displayLabels';
import { formatCredits } from './formatCredits';
import { mountLandingClock, type LandingClockHandle, type LandingClockState } from './landingClock';

export interface LandingMenuHeaderSnapshot
{
    readonly clock: LandingClockState;
    readonly credits: number;
    readonly cargoUsed: number;
    readonly cargoCapacity: number;
}

export interface LandingMenuHeaderHandle
{
    readonly backButton: HTMLButtonElement | null;
    render(snapshot: LandingMenuHeaderSnapshot): void;
    destroy(): void;
}

export function mountLandingMenuHeader (
    backButton: HTMLButtonElement | null,
    clockElement: HTMLElement,
    credits: HTMLElement,
    cargo: HTMLElement,
    timeControl: HTMLButtonElement,
    isActive: () => boolean,
    onBack: () => void,
    onToggleTime: () => void
): LandingMenuHeaderHandle
{
    const clock: LandingClockHandle = mountLandingClock(clockElement, isActive);
    backButton?.addEventListener('click', onBack);
    timeControl.addEventListener('click', onToggleTime);
    return {
        backButton,
        render: snapshot => {
            if (backButton) {
                backButton.textContent = displayLabels.facilitiesBackToPlanet;
                backButton.setAttribute('aria-label', displayLabels.facilitiesBackToPlanet);
            }
            clock.render(snapshot.clock);
            credits.textContent = formatCredits(snapshot.credits);
            cargo.textContent = `${snapshot.cargoUsed} / ${snapshot.cargoCapacity}`;
            timeControl.textContent = snapshot.clock.playerPaused ? displayLabels.timePlay : displayLabels.timePause;
            timeControl.setAttribute('aria-label', timeControl.textContent);
            timeControl.setAttribute('aria-pressed', String(!snapshot.clock.playerPaused));
            timeControl.dataset.playerPaused = String(snapshot.clock.playerPaused);
        },
        destroy: () => {
            backButton?.removeEventListener('click', onBack);
            timeControl.removeEventListener('click', onToggleTime);
            clock.destroy();
        }
    };
}
