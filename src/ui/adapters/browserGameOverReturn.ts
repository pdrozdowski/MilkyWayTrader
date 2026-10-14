import type { GameOverReturnPort } from '../../game/application/results/gameOverReturn';
import type { TerminalScoreResult } from '../../game/application/results/terminalScoreResult.ts';

const storageKey = 'milky-way-trader.game-over-return';

interface SessionStoragePort
{
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}

function isTerminalResult (candidate: unknown): candidate is TerminalScoreResult
{
    if (typeof candidate !== 'object' || candidate === null) return false;
    const result = candidate as Partial<TerminalScoreResult>;
    return typeof result.runId === 'string' && result.runId.length > 0 && result.outcome === 'death'
        && typeof result.activeElapsedMs === 'number' && Number.isSafeInteger(result.activeElapsedMs) && result.activeElapsedMs >= 0
        && typeof result.finalCredits === 'number' && Number.isSafeInteger(result.finalCredits) && result.finalCredits >= 0
        && typeof result.cargoValue === 'number' && Number.isFinite(result.cargoValue) && result.cargoValue >= 0
        && typeof result.shipUpgradeSpend === 'number' && Number.isSafeInteger(result.shipUpgradeSpend) && result.shipUpgradeSpend >= 0
        && typeof result.facilityUpgradeSpend === 'number' && Number.isSafeInteger(result.facilityUpgradeSpend) && result.facilityUpgradeSpend >= 0
        && typeof result.finalScore === 'number' && Number.isSafeInteger(result.finalScore) && result.finalScore >= 0;
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
