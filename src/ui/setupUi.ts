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
    const displayPort = createDisplayPort(game, root, container);
    const display = mountDisplayControls(root, displayPort, active => game.events.emit('fullscreen-change', active));
    const toggleFullscreen = (): void => { void displayPort.toggleFullscreen(); };
    game.events.on('toggle-fullscreen', toggleFullscreen);
    const runStatus = mountRunStatus(root, createRunStatusPort(game));
    const menu = root.querySelector<HTMLElement>('#game-menu');
    const mainMenu = root.querySelector<HTMLElement>('#main-menu');
    const mainMenuNewGame = root.querySelector<HTMLButtonElement>('#main-menu-new-game');
    const mainMenuFullscreen = root.querySelector<HTMLButtonElement>('#main-menu-fullscreen');
    const menuToggle = root.querySelector<HTMLButtonElement>('#game-menu-toggle');
    const menuClose = root.querySelector<HTMLButtonElement>('#game-menu-close');
    const returnToMenu = root.querySelector<HTMLButtonElement>('#return-to-menu');
    const debugMenu = root.querySelector<HTMLElement>('#debug-menu');
    const debugClose = root.querySelector<HTMLButtonElement>('#debug-menu-close');
    const touchControlsToggle = root.querySelector<HTMLButtonElement>('#debug-touch-controls-toggle');
    const mouseMovementToggle = root.querySelector<HTMLButtonElement>('#debug-mouse-movement-toggle');
    if (!menu || !mainMenu || !mainMenuNewGame || !mainMenuFullscreen || !menuToggle || !menuClose || !returnToMenu || !debugMenu || !debugClose || !touchControlsToggle || !mouseMovementToggle) throw new Error('Missing game menu controls.');
    const showMainMenu = (): void => { mainMenu.hidden = false; };
    const hideMainMenu = (): void => { mainMenu.hidden = true; };
    const startNewGame = (): void => { game.events.emit('start-new-game'); };
    const toggleMainMenuFullscreen = (): void => { game.events.emit('toggle-fullscreen'); };
    const updateMainMenuFullscreen = (active: boolean): void => { mainMenuFullscreen.textContent = `Fullscreen Mode: ${active ? 'ON' : 'OFF'}`; mainMenuFullscreen.setAttribute('aria-pressed', String(active)); };
    mainMenuNewGame.addEventListener('click', startNewGame);
    mainMenuFullscreen.addEventListener('click', toggleMainMenuFullscreen);
    game.events.on('main-menu-open', showMainMenu);
    game.events.on('main-menu-close', hideMainMenu);
    game.events.on('fullscreen-change', updateMainMenuFullscreen);
    const closeMenu = (): void => { menu.hidden = true; menuToggle.setAttribute('aria-expanded', 'false'); game.events.emit('menu-close'); menuToggle.focus(); };
    const openMenu = (): void => { menu.hidden = false; menuToggle.setAttribute('aria-expanded', 'true'); game.events.emit('menu-open'); menuClose.focus(); };
    menuToggle.addEventListener('click', openMenu);
    menuClose.addEventListener('click', closeMenu);
    const leaveGame = (): void => { closeMenu(); game.events.emit('return-to-menu'); };
    returnToMenu.addEventListener('click', leaveGame);
    let touchControlsEnabled = false;
    let mouseMovementEnabled = true;
    const renderDebugToggles = (): void => {
        touchControlsToggle.textContent = `Show touch screen controls: ${touchControlsEnabled ? 'ON' : 'OFF'}`;
        touchControlsToggle.setAttribute('aria-pressed', String(touchControlsEnabled));
        mouseMovementToggle.textContent = `Mouse movement: ${mouseMovementEnabled ? 'ON' : 'OFF'}`;
        mouseMovementToggle.setAttribute('aria-pressed', String(mouseMovementEnabled));
    };
    const closeDebugMenu = (): void => { debugMenu.hidden = true; game.canvas.focus(); };
    const openDebugMenu = (): void => { debugMenu.hidden = false; renderDebugToggles(); debugClose.focus(); };
    const toggleTouchControls = (): void => { touchControlsEnabled = !touchControlsEnabled; game.events.emit('debug-touch-controls', touchControlsEnabled); renderDebugToggles(); };
    const toggleMouseMovement = (): void => { mouseMovementEnabled = !mouseMovementEnabled; game.events.emit('debug-mouse-movement', mouseMovementEnabled); renderDebugToggles(); };
    const resetDebugControls = (): void => {
        touchControlsEnabled = false;
        mouseMovementEnabled = true;
        debugMenu.hidden = true;
        renderDebugToggles();
    };
    const debugKeyDown = (event: KeyboardEvent): void => {
        if (event.key.toLowerCase() !== 'd' || event.repeat || event.target instanceof Element && event.target.closest('[data-game-input="ignore"]')) return;
        if (debugMenu.hidden) openDebugMenu();
        else closeDebugMenu();
    };
    debugClose.addEventListener('click', closeDebugMenu);
    touchControlsToggle.addEventListener('click', toggleTouchControls);
    mouseMovementToggle.addEventListener('click', toggleMouseMovement);
    game.events.on('debug-controls-reset', resetDebugControls);
    window.addEventListener('keydown', debugKeyDown);
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
            mainMenuNewGame.removeEventListener('click', startNewGame);
            mainMenuFullscreen.removeEventListener('click', toggleMainMenuFullscreen);
            game.events.off('main-menu-open', showMainMenu);
            game.events.off('main-menu-close', hideMainMenu);
            game.events.off('fullscreen-change', updateMainMenuFullscreen);
            debugClose.removeEventListener('click', closeDebugMenu);
            touchControlsToggle.removeEventListener('click', toggleTouchControls);
            mouseMovementToggle.removeEventListener('click', toggleMouseMovement);
            game.events.off('debug-controls-reset', resetDebugControls);
            game.events.off('toggle-fullscreen', toggleFullscreen);
            window.removeEventListener('keydown', debugKeyDown);
            game.canvas.removeEventListener('pointerdown', returnToGame);
            game.events.off('destroy', handle.destroy);
        }
    };
    game.events.once('destroy', handle.destroy);
    return handle;
}
