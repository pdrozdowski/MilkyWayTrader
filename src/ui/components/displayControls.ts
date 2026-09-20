import type { DisplayPort, FullscreenResult, UiHandle } from '../contracts';

function required<T extends Element> (root: HTMLElement, selector: string): T
{
    const element = root.querySelector<T>(selector);
    if (!element) throw new Error(`Missing display control: ${selector}`);
    return element;
}

export function mountDisplayControls (root: HTMLElement, port: DisplayPort): UiHandle
{
    const notice = required<HTMLElement>(root, '#orientation-notice');
    const help = required<HTMLElement>(root, '#orientation-help');
    const controls = required<HTMLElement>(root, '#mobile-controls');
    const button = required<HTMLButtonElement>(root, '#fullscreen-toggle');
    const status = required<HTMLElement>(root, '#display-status');

    const render = (): void => {
        const snapshot = port.getSnapshot();
        controls.hidden = !snapshot.mobile;
        notice.hidden = !(snapshot.mobile && snapshot.portrait);
        button.hidden = !snapshot.fullscreenAvailable;
        help.textContent = button.hidden ? 'Obróć urządzenie, aby grać.' : 'Obróć urządzenie lub wybierz „Pełny ekran”.';
        button.textContent = snapshot.fullscreenActive ? 'X' : 'Pełny ekran';
        button.setAttribute('aria-pressed', String(snapshot.fullscreenActive));
        if (!snapshot.mobile) status.textContent = '';
        port.refreshScale();
    };
    const showResult = (result: FullscreenResult): void => {
        if (result === 'manual-rotation') status.textContent = 'Obróć telefon do poziomu, aby grać.';
        if (result === 'failed') status.textContent = 'Nie udało się włączyć pełnego ekranu. Możesz grać po obróceniu telefonu do poziomu.';
    };
    const toggle = async (): Promise<void> => {
        button.disabled = true;
        status.textContent = '';
        try { showResult(await port.toggleFullscreen()); }
        finally { button.disabled = false; render(); }
    };
    const click = (): void => { void toggle(); };
    const unsubscribe = port.subscribe(() => render());
    button.addEventListener('click', click);
    render();
    let destroyed = false;

    return {
        destroy: () => {
            if (destroyed) return;
            destroyed = true;
            unsubscribe();
            button.removeEventListener('click', click);
            port.destroy();
        }
    };
}
