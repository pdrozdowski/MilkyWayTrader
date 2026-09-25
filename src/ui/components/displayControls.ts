import type { DisplayPort, FullscreenResult, UiHandle } from '../contracts';
import { displayLabels } from './displayLabels';

function required<T extends Element> (root: HTMLElement, selector: string): T
{
    const element = root.querySelector<T>(selector);
    if (!element) throw new Error(`Missing display control: ${selector}`);
    return element;
}

export function mountDisplayControls (root: HTMLElement, port: DisplayPort, onFullscreenChange: (active: boolean) => void): UiHandle
{
    const notice = required<HTMLElement>(root, '#orientation-notice');
    const help = required<HTMLElement>(root, '#orientation-help');
    const orientationControls = required<HTMLElement>(root, '#mobile-controls');
    const menuControls = required<HTMLElement>(root, '#menu-display-controls');
    const controls = [
        { button: required<HTMLButtonElement>(root, '#fullscreen-toggle'), status: required<HTMLElement>(root, '#display-status') },
        { button: required<HTMLButtonElement>(root, '#menu-fullscreen-toggle'), status: required<HTMLElement>(root, '#menu-display-status') }
    ];

    const render = (): void => {
        const snapshot = port.getSnapshot();
        orientationControls.hidden = !snapshot.mobile;
        menuControls.hidden = !snapshot.mobile;
        notice.hidden = !(snapshot.mobile && snapshot.portrait);
        for (const control of controls) {
            control.button.hidden = false;
            control.button.textContent = snapshot.fullscreenActive ? displayLabels.closeFullscreen : displayLabels.fullscreen;
            control.button.setAttribute('aria-pressed', String(snapshot.fullscreenActive));
            if (!snapshot.mobile) control.status.textContent = '';
        }
        onFullscreenChange(snapshot.fullscreenActive);
        help.textContent = !snapshot.fullscreenAvailable ? displayLabels.rotateToPlay : displayLabels.rotateOrFullscreen;
        port.refreshScale();
    };
    const showResult = (status: HTMLElement, result: FullscreenResult): void => {
        if (result === 'manual-rotation') status.textContent = displayLabels.rotateToPlay;
        if (result === 'failed') status.textContent = displayLabels.fullscreenFailed;
    };
    const toggle = async (control: typeof controls[number]): Promise<void> => {
        for (const item of controls) item.button.disabled = true;
        control.status.textContent = '';
        try { showResult(control.status, await port.toggleFullscreen()); }
        finally {
            for (const item of controls) item.button.disabled = false;
            render();
        }
    };
    const clicks = controls.map(control => () => { void toggle(control); });
    const unsubscribe = port.subscribe(() => render());
    for (let index = 0; index < controls.length; index++) controls[index].button.addEventListener('click', clicks[index]);
    render();
    let destroyed = false;

    return {
        destroy: () => {
            if (destroyed) return;
            destroyed = true;
            unsubscribe();
            for (let index = 0; index < controls.length; index++) controls[index].button.removeEventListener('click', clicks[index]);
            port.destroy();
        }
    };
}
