import type { GameOverReturnPort } from '../../game/application/results/gameOverReturn';
import type { TerminalResultState } from '../../game/state/terminalResultState';

const storageKey = 'milky-way-trader.game-over-return';

interface SessionStoragePort
{
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}

function isTerminalResult (candidate: unknown): candidate is TerminalResultState
{
    if (typeof candidate !== 'object' || candidate === null) return false;
    const result = candidate as Partial<TerminalResultState>;
    return typeof result.runId === 'string' && result.runId.length > 0 && result.outcome === 'death'
        && typeof result.activeElapsedMs === 'number' && Number.isSafeInteger(result.activeElapsedMs) && result.activeElapsedMs >= 0
        && typeof result.finalCredits === 'number' && Number.isSafeInteger(result.finalCredits) && result.finalCredits >= 0;
}

export function createBrowserGameOverReturnPort (storage: SessionStoragePort | null = window.sessionStorage): GameOverReturnPort
{
    return {
        save: terminalResult => {
            try { storage?.setItem(storageKey, JSON.stringify(terminalResult)); } catch {}
        },
        take: () => {
            try {
                const value = storage?.getItem(storageKey) ?? null;
                storage?.removeItem(storageKey);
                if (value === null) return null;
                const result: unknown = JSON.parse(value);
                return isTerminalResult(result) ? result : null;
            } catch {
                return null;
            }
        }
    };
}
