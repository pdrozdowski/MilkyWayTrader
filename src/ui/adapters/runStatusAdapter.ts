import type { Game } from 'phaser';
import { projectRunStatus, type RunStatusSnapshot } from '../../game/application/runStatus.ts';
import type { GameStateProvider } from '../../game/application/gameStateProvider';
import type { RunStatusPort } from '../contracts';

export function runStatusIsVisible (sceneActive: boolean, terminal: boolean): boolean
{
    return sceneActive && !terminal;
}

export function createRunStatusPort (game: Game): RunStatusPort
{
    const provider = game.registry.get('gameStateProvider') as GameStateProvider;
    const listeners = new Set<(snapshot: Readonly<RunStatusSnapshot>) => void>();
    let current = projectRunStatus(provider.snapshot(), runStatusIsVisible(game.scene.isActive('Game'), provider.snapshot().terminalResult !== null));
    let key = JSON.stringify(current);
    let destroyed = false;
    const refresh = (): void => {
        if (destroyed) return;
        const snapshot = provider.snapshot();
        const next = projectRunStatus(snapshot, runStatusIsVisible(game.scene.isActive('Game'), snapshot.terminalResult !== null));
        const nextKey = JSON.stringify(next);
        if (nextKey === key) return;
        current = next;
        key = nextKey;
        for (const listener of listeners) listener(current);
    };
    const unsubscribe = provider.subscribe(refresh);
    game.events.on('step', refresh);
    return {
        getSnapshot: () => current,
        subscribe: listener => {
            if (destroyed) return () => {};
            listeners.add(listener);
            listener(current);
            return () => { listeners.delete(listener); };
        },
        destroy: () => {
            if (destroyed) return;
            destroyed = true;
            unsubscribe();
            game.events.off('step', refresh);
            listeners.clear();
        }
    };
}
