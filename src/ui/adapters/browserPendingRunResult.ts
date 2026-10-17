import type { PendingRunResultPort } from '../../game/application/results/pendingRunResult.ts';
import type { TerminalScoreResult } from '../../game/application/results/terminalScoreResult.ts';
import { decodeGameState } from '../../game/application/gameStateCodec.ts';

const storageKeyPrefix = 'milky-way-trader.pending-run-result.';

export function createBrowserPendingRunResult (storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>): PendingRunResultPort
{
    return {
        load: ownerId => {
            try {
                const value = getStorage(storage).getItem(`${storageKeyPrefix}${ownerId}`);
                if (value === null) return null;
                const result: unknown = JSON.parse(value);
                if (!isRecord(result) || !isTerminalScoreResult(result.terminalResult) || !Number.isSafeInteger(result.expectedRevision) || Number(result.expectedRevision) < 0) throw new Error('Terminal recovery data is incompatible.');
                const snapshot = decodeGameState(result.snapshot);
                if (!snapshot.terminalResult || snapshot.runId !== result.terminalResult.runId) throw new Error('Terminal recovery data does not match its run.');
                return Object.freeze({ terminalResult: Object.freeze(result.terminalResult), snapshot, expectedRevision: Number(result.expectedRevision) });
            } catch (error) { throw new Error(error instanceof Error ? `Terminal recovery data could not be read: ${error.message}` : 'Terminal recovery data could not be read.'); }
        },
        save: (ownerId, intent) => {
            if (!ownerId || !isTerminalScoreResult(intent.terminalResult) || !Number.isSafeInteger(intent.expectedRevision) || intent.expectedRevision < 0) throw new Error('Terminal recovery data is invalid.');
            const snapshot = decodeGameState(intent.snapshot);
            if (!snapshot.terminalResult || snapshot.runId !== intent.terminalResult.runId) throw new Error('Terminal recovery data does not match its run.');
            getStorage(storage).setItem(`${storageKeyPrefix}${ownerId}`, JSON.stringify({ ...intent, snapshot }));
        },
        clear: ownerId => getStorage(storage).removeItem(`${storageKeyPrefix}${ownerId}`)
    };
}

function isRecord (value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function getStorage (storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
{
    try { return storage ?? window.localStorage; }
    catch (error) { throw new Error(error instanceof Error ? `Terminal recovery storage is unavailable: ${error.message}` : 'Terminal recovery storage is unavailable.'); }
}

function isTerminalScoreResult (value: unknown): value is TerminalScoreResult
{
    if (!value || typeof value !== 'object') return false;
    const result = value as Record<string, unknown>;
    return typeof result.runId === 'string'
        && ['death', 'freedom', 'imprisonment', 'abandonment'].includes(String(result.outcome))
        && Number.isSafeInteger(result.activeElapsedMs) && Number(result.activeElapsedMs) >= 0
        && Number.isSafeInteger(result.finalCredits) && Number(result.finalCredits) >= 0
        && Number.isSafeInteger(result.cargoValue) && Number(result.cargoValue) >= 0
        && Number.isSafeInteger(result.shipUpgradeSpend) && Number(result.shipUpgradeSpend) >= 0
        && Number.isSafeInteger(result.facilityUpgradeSpend) && Number(result.facilityUpgradeSpend) >= 0
        && Number.isSafeInteger(result.finalScore) && Number(result.finalScore) >= 0;
}
