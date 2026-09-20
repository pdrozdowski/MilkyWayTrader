import type { AudioSettingsPort, UiHandle } from '../contracts';

function required<T extends Element> (root: HTMLElement, selector: string): T
{
    const element = root.querySelector<T>(selector);
    if (!element) throw new Error(`Missing audio control: ${selector}`);
    return element;
}

export function mountAudioControls (root: HTMLElement, port: AudioSettingsPort): UiHandle
{
    const button = required<HTMLButtonElement>(root, '#audio-mute');
    const slider = required<HTMLInputElement>(root, '#audio-volume');
    const output = required<HTMLOutputElement>(root, '#audio-volume-value');
    const unsubscribe = port.subscribe(settings => {
        button.textContent = settings.muted ? 'Unmute' : 'Mute';
        button.setAttribute('aria-pressed', String(settings.muted));
        slider.value = String(Math.round(settings.masterVolume * 100));
        output.value = `${slider.value}%`;
    });
    const toggle = (): void => port.setMuted(!port.getSettings().muted);
    const volume = (): void => port.setMasterVolume(Number(slider.value) / 100);
    button.addEventListener('click', toggle);
    slider.addEventListener('input', volume);
    let destroyed = false;

    return {
        destroy: () => {
            if (destroyed) return;
            destroyed = true;
            unsubscribe();
            button.removeEventListener('click', toggle);
            slider.removeEventListener('input', volume);
        }
    };
}
