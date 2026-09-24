import type { GameControlsPort, UiHandle } from '../contracts';

function required<T extends Element> (root: HTMLElement, selector: string): T
{
    const element = root.querySelector<T>(selector);
    if (!element) throw new Error(`Missing game menu control: ${selector}`);
    return element;
}

export function mountGameMenu (root: HTMLElement, port: GameControlsPort): UiHandle
{
    const menu = required<HTMLElement>(root, '#game-menu');
    const toggle = required<HTMLButtonElement>(root, '#game-menu-toggle');
    const close = required<HTMLButtonElement>(root, '#game-menu-close');
    const resume = required<HTMLButtonElement>(root, '#game-menu-resume');
    const exit = required<HTMLButtonElement>(root, '#return-to-menu');
    let returnFocus: HTMLElement | null = null;
    const focusable = (): HTMLElement[] => Array.from(menu.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])'));
    const open = (): void => {
        if (port.isMenuOpen()) return;
        returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : toggle;
        menu.hidden = false;
        toggle.setAttribute('aria-expanded', 'true');
        port.openMenu();
        close.focus();
    };
    const closeMenu = (): void => {
        if (!port.isMenuOpen()) return;
        menu.hidden = true;
        toggle.setAttribute('aria-expanded', 'false');
        port.closeMenu();
        (returnFocus ?? toggle).focus();
        returnFocus = null;
    };
    const keydown = (event: KeyboardEvent): void => {
        if (event.key === 'Escape') { event.preventDefault(); port.isMenuOpen() ? closeMenu() : open(); return; }
        if (event.key !== 'Tab' || !port.isMenuOpen()) return;
        const controls = focusable();
        const first = controls[0]; const last = controls[controls.length - 1];
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    const exitToMainMenu = (): void => { menu.hidden = true; toggle.setAttribute('aria-expanded', 'false'); port.exitToMainMenu(); };
    toggle.addEventListener('click', open); close.addEventListener('click', closeMenu); resume.addEventListener('click', closeMenu); exit.addEventListener('click', exitToMainMenu); window.addEventListener('keydown', keydown);
    let destroyed = false;
    return { destroy: () => { if (destroyed) return; destroyed = true; toggle.removeEventListener('click', open); close.removeEventListener('click', closeMenu); resume.removeEventListener('click', closeMenu); exit.removeEventListener('click', exitToMainMenu); window.removeEventListener('keydown', keydown); port.destroy(); } };
}
