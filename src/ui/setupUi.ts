import type { Game } from 'phaser';
import { createAudioSettingsPort } from './adapters/audioSettingsAdapter';
import { createDisplayPort } from './adapters/displayAdapter';
import { createRunStatusPort } from './adapters/runStatusAdapter';
import { mountAudioControls } from './components/audioControls';
import { mountDisplayControls } from './components/displayControls';
import { mountRunStatus } from './components/runStatus';
import type { UiHandle } from './contracts';

export function setupApplicationUi (root: HTMLElement, game: Game): UiHandle
{
    const container = root.querySelector<HTMLElement>('#game-container');
    if (!container) throw new Error('Missing game container.');
    const audio = mountAudioControls(root, createAudioSettingsPort(game));
    const display = mountDisplayControls(root, createDisplayPort(game, root, container));
    const runStatus = mountRunStatus(root, createRunStatusPort(game));
    const menu = root.querySelector<HTMLElement>('#game-menu');
    const menuToggle = root.querySelector<HTMLButtonElement>('#game-menu-toggle');
    const menuClose = root.querySelector<HTMLButtonElement>('#game-menu-close');
    const returnToMenu = root.querySelector<HTMLButtonElement>('#return-to-menu');
    if (!menu || !menuToggle || !menuClose || !returnToMenu) throw new Error('Missing game menu controls.');
    const closeMenu = (): void => { menu.hidden = true; menuToggle.setAttribute('aria-expanded', 'false'); game.events.emit('menu-close'); menuToggle.focus(); };
    const openMenu = (): void => { menu.hidden = false; menuToggle.setAttribute('aria-expanded', 'true'); game.events.emit('menu-open'); menuClose.focus(); };
    menuToggle.addEventListener('click', openMenu);
    menuClose.addEventListener('click', closeMenu);
    const leaveGame = (): void => { closeMenu(); game.events.emit('return-to-menu'); };
    returnToMenu.addEventListener('click', leaveGame);
    const returnToGame = (): void => {
        const focused = document.activeElement;
        if (focused instanceof HTMLElement && focused.closest('[data-game-input="ignore"]')) focused.blur();
    };
    game.canvas.addEventListener('pointerdown', returnToGame);
    let destroyed = false;
    const handle: UiHandle = {
        destroy: () => {
            if (destroyed) return;
            destroyed = true;
            audio.destroy();
            display.destroy();
            runStatus.destroy();
            menuToggle.removeEventListener('click', openMenu);
            menuClose.removeEventListener('click', closeMenu);
            returnToMenu.removeEventListener('click', leaveGame);
            game.canvas.removeEventListener('pointerdown', returnToGame);
            game.events.off('destroy', handle.destroy);
        }
    };
    game.events.once('destroy', handle.destroy);
    return handle;
}
