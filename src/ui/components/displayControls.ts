import type { Game } from 'phaser';
import type { DisplayPort, FullscreenResult, UiHandle } from '../contracts';

function required<T extends Element> (root: HTMLElement, selector: string): T
{
    const element = root.querySelector<T>(selector);
    if (!element) throw new Error(`Missing display control: ${selector}`);
    return element;
}

export function mountDisplayControls (root: HTMLElement, port: DisplayPort, game: Game): UiHandle
{
    const notice = required<HTMLElement>(root, '#orientation-notice');
    const help = required<HTMLElement>(root, '#orientation-help');
    const menuControls = required<HTMLElement>(root, '#menu-display-controls');
    const controls = [
        { button: required<HTMLButtonElement>(root, '#menu-fullscreen-toggle'), status: required<HTMLElement>(root, '#menu-display-status') }
    ];

    const render = (): void => {
        const snapshot = port.getSnapshot();
        menuControls.hidden = !snapshot.mobile;
        notice.hidden = !(snapshot.mobile && snapshot.portrait);
        for (const control of controls) {
            control.button.hidden = false;
            control.button.textContent = snapshot.fullscreenActive ? 'X' : 'Pełny ekran';
            control.button.setAttribute('aria-pressed', String(snapshot.fullscreenActive));
            if (!snapshot.mobile) control.status.textContent = '';
        }
        game.events.emit('fullscreen-change', snapshot.fullscreenActive);
        help.textContent = !snapshot.fullscreenAvailable ? 'Obróć urządzenie, aby grać.' : 'Obróć urządzenie lub wybierz „Pełny ekran”.';
        port.refreshScale();
    };
    const showResult = (status: HTMLElement, result: FullscreenResult): void => {
        if (result === 'manual-rotation') status.textContent = 'Obróć telefon do poziomu, aby grać.';
        if (result === 'failed') status.textContent = 'Nie udało się włączyć pełnego ekranu. Możesz grać po obróceniu telefonu do poziomu.';
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
    const toggleFromMainMenu = (): void => { void toggle(controls[0]); };
    const unsubscribe = port.subscribe(() => render());
    for (let index = 0; index < controls.length; index++) controls[index].button.addEventListener('click', clicks[index]);
    game.events.on('toggle-fullscreen', toggleFromMainMenu);
    render();
    let destroyed = false;

    return {
        destroy: () => {
            if (destroyed) return;
            destroyed = true;
            unsubscribe();
            for (let index = 0; index < controls.length; index++) controls[index].button.removeEventListener('click', clicks[index]);
            game.events.off('toggle-fullscreen', toggleFromMainMenu);
            port.destroy();
        }
    };
}
