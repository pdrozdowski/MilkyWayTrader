import type { AuthReturnContext, AuthReturnPort, AccountOrigin } from '../../game/application/auth/authReturn';
import { decodeGameState, encodeGameState } from '../../game/application/gameStateCodec.ts';
import type { GameStateSnapshot } from '../../game/state/gameStateSnapshot';
import type { TerminalResultState } from '../../game/state/terminalResultState';

const storageKey = 'milky-way-trader.auth-return';
interface SessionStoragePort { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void; }

function browserSessionStorage (): SessionStoragePort | null
{
    try { return window.sessionStorage; }
    catch { return null; }
}

function isRecord (value: unknown): value is Record<string, unknown>
{
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function terminalResult (value: unknown): TerminalResultState | null
{
    if (value === null) return null;
    if (!isRecord(value) || typeof value.runId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.runId) || value.outcome !== 'death' || !Number.isSafeInteger(value.activeElapsedMs) || (value.activeElapsedMs as number) < 0 || !Number.isSafeInteger(value.finalCredits) || (value.finalCredits as number) < 0) throw new Error('Invalid terminal result.');
    return value as unknown as TerminalResultState;
}

function decodeContext (candidate: unknown): Readonly<AuthReturnContext>
{
    if (!isRecord(candidate) || !['main-menu', 'game-over', 'game-menu'].includes(String(candidate.origin))) throw new Error('Invalid account return context.');
    let snapshot: GameStateSnapshot | null = null;
    if (candidate.snapshot !== null) snapshot = decodeGameState(candidate.snapshot);
    let telemetryContext: AuthReturnContext['telemetryContext'] = null;
    if (candidate.telemetryContext !== null) {
        if (!isRecord(candidate.telemetryContext) || typeof candidate.telemetryContext.sessionId !== 'string' || candidate.telemetryContext.sessionId.length === 0 || typeof candidate.telemetryContext.sessionStartedAt !== 'number' || !Number.isFinite(candidate.telemetryContext.sessionStartedAt) || candidate.telemetryContext.sessionStartedAt < 0) throw new Error('Invalid telemetry return context.');
        telemetryContext = Object.freeze({ sessionId: candidate.telemetryContext.sessionId, sessionStartedAt: candidate.telemetryContext.sessionStartedAt });
    }
    const origin = candidate.origin as AccountOrigin;
    const result = terminalResult(candidate.terminalResult);
    if (origin === 'main-menu' && (snapshot !== null || result !== null)) throw new Error('Invalid Main Menu account return context.');
    if (origin === 'game-menu' && (snapshot === null || snapshot.terminalResult !== null || result !== null)) throw new Error('Invalid in-game account return context.');
    if (origin === 'game-over' && (!snapshot || !result || !snapshot.terminalResult || snapshot.terminalResult.runId !== result.runId || snapshot.terminalResult.outcome !== result.outcome || snapshot.terminalResult.activeElapsedMs !== result.activeElapsedMs || snapshot.terminalResult.finalCredits !== result.finalCredits)) throw new Error('Invalid Game Over account return context.');
    return Object.freeze({ snapshot, telemetryContext, origin, terminalResult: result });
}

export function createBrowserAuthReturnPort (storage: SessionStoragePort | null = browserSessionStorage()): AuthReturnPort
{
    let lastError: string | null = null;
    return {
        save: context => {
            try {
                storage?.setItem(storageKey, JSON.stringify({ ...context, snapshot: context.snapshot ? encodeGameState(context.snapshot) : null }));
                lastError = null;
                return Boolean(storage);
            } catch { lastError = 'Unable to preserve the active run for sign-in.'; return false; }
        },
        take: () => {
            try {
                const value = storage?.getItem(storageKey) ?? null;
                storage?.removeItem(storageKey);
                if (!value) return null;
                const parsed: unknown = JSON.parse(value);
                if (isRecord(parsed) && typeof parsed.snapshot === 'string') parsed.snapshot = JSON.parse(parsed.snapshot) as unknown;
                return decodeContext(parsed);
            } catch {
                try { storage?.removeItem(storageKey); } catch {}
                lastError = 'The previous run could not be restored. Start a new run from the Main Menu.';
                return null;
            }
        },
        clear: () => { try { storage?.removeItem(storageKey); } catch {} lastError = null; },
        getError: () => lastError
    };
}
