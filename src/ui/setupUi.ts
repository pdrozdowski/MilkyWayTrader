import type { Game } from 'phaser';
import { createAudioSettingsPort } from './adapters/audioSettingsAdapter';
import { createDisplayPort } from './adapters/displayAdapter';
import { mountAudioControls } from './components/audioControls';
import { mountDisplayControls } from './components/displayControls';
import type { UiHandle } from './contracts';

export function setupApplicationUi (root: HTMLElement, game: Game): UiHandle
{
    const container = root.querySelector<HTMLElement>('#game-container');
    if (!container) throw new Error('Missing game container.');
    const audio = mountAudioControls(root, createAudioSettingsPort(game));
    const display = mountDisplayControls(root, createDisplayPort(game, root, container));
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
            game.canvas.removeEventListener('pointerdown', returnToGame);
            game.events.off('destroy', handle.destroy);
        }
    };
    game.events.once('destroy', handle.destroy);
    return handle;
}
