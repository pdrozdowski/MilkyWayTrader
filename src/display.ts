import type { Game } from 'phaser';

type LockableOrientation = ScreenOrientation & {
    lock?: (orientation: 'landscape') => Promise<void>;
};

export function setupDisplay(game: Game): void {
    const app = document.getElementById('app')!;
    const container = document.getElementById('game-container')!;
    const notice = document.getElementById('orientation-notice')!;
    const help = document.getElementById('orientation-help')!;
    const controls = document.getElementById('mobile-controls')!;
    const button = document.getElementById('fullscreen-toggle') as HTMLButtonElement;
    const status = document.getElementById('display-status')!;
    const touchDevice = window.matchMedia('(pointer: coarse)');
    const portrait = window.matchMedia('(orientation: portrait)');

    function updateDisplay(): void {
        const mobile = touchDevice.matches;
        controls.hidden = !mobile;
        notice.hidden = !(mobile && portrait.matches);
        button.hidden = !document.fullscreenEnabled || typeof app.requestFullscreen !== 'function';
        help.textContent = button.hidden ? 'Obróć urządzenie, aby grać.' : 'Obróć urządzenie lub wybierz „Pełny ekran”.';
        button.textContent = document.fullscreenElement ? 'X' : 'Pełny ekran';
        button.setAttribute('aria-pressed', String(Boolean(document.fullscreenElement)));
        if (!mobile) {
            status.textContent = '';
        }
        if (game.isBooted) {
            game.scale.refresh();
        }
    }

    function requestManualRotation(): void {
        if (portrait.matches) {
            status.textContent = 'Obróć telefon do poziomu, aby grać.';
        }
    }

    async function toggleFullscreen(): Promise<void> {
        button.disabled = true;
        status.textContent = '';
        try {
            if (document.fullscreenElement) {
                await document.exitFullscreen();
                return;
            }

            await app.requestFullscreen();
            const orientation = screen.orientation as LockableOrientation | undefined;
            if (typeof orientation?.lock === 'function') {
                try {
                    await orientation.lock('landscape');
                } catch {
                    requestManualRotation();
                }
            } else {
                requestManualRotation();
            }
        } catch {
            status.textContent = 'Nie udało się włączyć pełnego ekranu. Możesz grać po obróceniu telefonu do poziomu.';
        } finally {
            button.disabled = false;
            updateDisplay();
        }
    }

    const onFullscreenClick = (): void => { void toggleFullscreen(); };
    const onOrientationChange = (): void => {
        status.textContent = '';
        updateDisplay();
    };
    const observer = new ResizeObserver(updateDisplay);
    observer.observe(container);
    touchDevice.addEventListener('change', updateDisplay);
    portrait.addEventListener('change', onOrientationChange);
    window.addEventListener('resize', updateDisplay);
    document.addEventListener('fullscreenchange', updateDisplay);
    button.addEventListener('click', onFullscreenClick);
    updateDisplay();

    game.events.once('destroy', () => {
        observer.disconnect();
        touchDevice.removeEventListener('change', updateDisplay);
        portrait.removeEventListener('change', onOrientationChange);
        window.removeEventListener('resize', updateDisplay);
        document.removeEventListener('fullscreenchange', updateDisplay);
        button.removeEventListener('click', onFullscreenClick);
    });
}
