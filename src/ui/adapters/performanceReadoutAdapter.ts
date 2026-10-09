import type { Game } from 'phaser';
import type { PerformanceMonitor, PerformanceSnapshot } from '../../game/application/performanceMonitor';
import type { PerformanceReadoutPort } from '../contracts';

export function createPerformanceReadoutPort (game: Game): PerformanceReadoutPort
{
    const monitor = game.registry.get('performanceMonitor') as PerformanceMonitor;
    const listeners = new Set<(snapshot: Readonly<PerformanceSnapshot>) => void>();
    let current = monitor.snapshot();
    let key = JSON.stringify(current);
    let destroyed = false;
    const refresh = (): void => {
        if (destroyed) return;
        const next = monitor.snapshot();
        const nextKey = JSON.stringify(next);
        if (nextKey === key) return;
        current = next;
        key = nextKey;
        for (const listener of listeners) listener(current);
    };
    game.events.on('performance-monitor-sample', refresh);
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
            game.events.off('performance-monitor-sample', refresh);
            listeners.clear();
        }
    };
}
