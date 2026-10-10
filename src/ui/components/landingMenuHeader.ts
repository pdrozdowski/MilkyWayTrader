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
    readonly backButton: HTMLButtonElement;
    render(snapshot: LandingMenuHeaderSnapshot): void;
    destroy(): void;
}

export function mountLandingMenuHeader (
    backButton: HTMLButtonElement,
    clockElement: HTMLElement,
    credits: HTMLElement,
    cargo: HTMLElement,
    isActive: () => boolean,
    onBack: () => void
): LandingMenuHeaderHandle
{
    const clock: LandingClockHandle = mountLandingClock(clockElement, isActive);
    backButton.addEventListener('click', onBack);
    return {
        backButton,
        render: snapshot => {
            backButton.textContent = displayLabels.facilitiesBackToPlanet;
            backButton.setAttribute('aria-label', displayLabels.facilitiesBackToPlanet);
            clock.render(snapshot.clock);
            credits.textContent = formatCredits(snapshot.credits);
            cargo.textContent = `${snapshot.cargoUsed} / ${snapshot.cargoCapacity}`;
        },
        destroy: () => {
            backButton.removeEventListener('click', onBack);
            clock.destroy();
        }
    };
}
