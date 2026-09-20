import type { Game } from 'phaser';
import type { DisplayPort, DisplaySnapshot, FullscreenResult } from '../contracts';

type LockableOrientation = ScreenOrientation & {
    lock?: (orientation: 'landscape') => Promise<void>;
};

export function createDisplayPort (game: Game, app: HTMLElement, container: HTMLElement): DisplayPort
{
    const touchDevice = window.matchMedia('(pointer: coarse)');
    const portrait = window.matchMedia('(orientation: portrait)');
    const listeners = new Set<(snapshot: Readonly<DisplaySnapshot>) => void>();
    const snapshot = (): DisplaySnapshot => ({
        mobile: touchDevice.matches,
        portrait: portrait.matches,
        fullscreenAvailable: document.fullscreenEnabled && typeof app.requestFullscreen === 'function',
        fullscreenActive: Boolean(document.fullscreenElement)
    });
    const notify = (): void => {
        const state = snapshot();
        for (const listener of listeners) listener(state);
    };
    const observer = new ResizeObserver(notify);
    observer.observe(container);
    touchDevice.addEventListener('change', notify);
    portrait.addEventListener('change', notify);
    window.addEventListener('resize', notify);
    document.addEventListener('fullscreenchange', notify);
    let destroyed = false;

    const toggleFullscreen = async (): Promise<FullscreenResult> => {
        try {
            if (document.fullscreenElement) {
                await document.exitFullscreen();
                return 'success';
            }
            await app.requestFullscreen();
            const orientation = screen.orientation as LockableOrientation | undefined;
            if (!portrait.matches) return 'success';
            if (typeof orientation?.lock !== 'function') return 'manual-rotation';
            try { await orientation.lock('landscape'); return 'success'; }
            catch { return 'manual-rotation'; }
        } catch { return 'failed'; }
    };

    return {
        getSnapshot: snapshot,
        subscribe: listener => {
            if (destroyed) return () => {};
            listeners.add(listener);
            listener(snapshot());
            return () => { listeners.delete(listener); };
        },
        toggleFullscreen,
        refreshScale: () => { if (game.isBooted) game.scale.refresh(); },
        destroy: () => {
            if (destroyed) return;
            destroyed = true;
            observer.disconnect();
            touchDevice.removeEventListener('change', notify);
            portrait.removeEventListener('change', notify);
            window.removeEventListener('resize', notify);
            document.removeEventListener('fullscreenchange', notify);
            listeners.clear();
        }
    };
}
