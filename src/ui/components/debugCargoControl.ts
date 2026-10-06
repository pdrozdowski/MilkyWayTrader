export interface DebugCargoButton
{
    textContent: string | null;
    addEventListener (type: 'click', listener: () => void): void;
    removeEventListener (type: 'click', listener: () => void): void;
}

export interface DebugCargoEvents
{
    emit (event: 'debug-spawn-cargo'): void;
}

/** Binds the debug cargo intent without giving the DOM control state ownership. */
export function bindDebugCargoControl (
    button: DebugCargoButton,
    events: DebugCargoEvents,
    label: string,
    canSpawn: () => boolean,
    close: () => void
): () => void
{
    const spawn = (): void => {
        if (!canSpawn()) return;
        events.emit('debug-spawn-cargo');
        close();
    };
    button.textContent = label;
    button.addEventListener('click', spawn);
    return () => button.removeEventListener('click', spawn);
}
