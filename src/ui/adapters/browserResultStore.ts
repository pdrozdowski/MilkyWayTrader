import { createClient } from '@supabase/supabase-js';
import type { ResultStorePersistResult, ResultStorePort } from '../../game/application/results/resultStore';
import type { TerminalScoreResult } from '../../game/application/results/terminalScoreResult';
import type { ResultHistoryOutcome } from '../../game/application/results/resultHistoryStore';
import type { GlobalScoreStorePort } from '../../game/application/results/globalScoreStore.ts';
import { createBrowserGlobalScoreStore } from './browserGlobalScoreStore.ts';
import { browserAuthConfiguration, type PublicAuthConfiguration } from '../../game/application/auth/configuration.ts';

interface ResultClient
{
    readonly auth: { getSession(): PromiseLike<{ data: { session: { user: { id: string } } | null }; error: { message: string } | null }> };
    from(table: 'run_results'): { insert(row: ResultRow): PromiseLike<{ error: { code?: string; message: string } | null }> };
}

interface ResultRow
{
    readonly run_id: string;
    readonly user_id: string;
    readonly outcome: ResultHistoryOutcome;
    readonly active_elapsed_ms: number;
    readonly final_credits: number;
    readonly final_score: number;
}

type ClientFactory = (url: string, key: string) => ResultClient;
const createResultClient: ClientFactory = (url, key) => createClient(url, key) as unknown as ResultClient;

function validConfiguration (configuration: PublicAuthConfiguration): configuration is Required<PublicAuthConfiguration>
{
    if (!configuration.url || !configuration.publishableKey || /\s/.test(configuration.publishableKey) || configuration.publishableKey.length < 20) return false;
    try { const url = new URL(configuration.url); return url.protocol === 'https:' || url.hostname === 'localhost' || url.hostname === '127.0.0.1'; }
    catch { return false; }
}

function validTerminalResult (result: TerminalScoreResult): boolean
{
    return typeof result.runId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result.runId)
        && ['death', 'freedom', 'imprisonment', 'abandonment'].includes(String(result.outcome))
        && Number.isSafeInteger(result.activeElapsedMs) && result.activeElapsedMs >= 0
        && Number.isSafeInteger(result.finalCredits) && result.finalCredits >= 0
        && Number.isFinite(result.cargoValue) && result.cargoValue >= 0
        && Number.isSafeInteger(result.shipUpgradeSpend) && result.shipUpgradeSpend >= 0
        && Number.isSafeInteger(result.facilityUpgradeSpend) && result.facilityUpgradeSpend >= 0
        && Number.isSafeInteger(result.finalScore) && result.finalScore >= 0;
}

export function createBrowserResultStore (
    configuration = browserAuthConfiguration(),
    clientFactory: ClientFactory = createResultClient,
    globalScoreStore: GlobalScoreStorePort = createBrowserGlobalScoreStore(configuration)
): ResultStorePort
{
    if (!validConfiguration(configuration)) return unavailableResultStore;
    const client = clientFactory(configuration.url, configuration.publishableKey);
    return {
        persist: async terminalResult => {
            if (!validTerminalResult(terminalResult)) return failed('Invalid terminal score.');
            try {
                const { data, error: sessionError } = await client.auth.getSession();
                if (sessionError) return failed(sessionError.message);
                if (!data.session) return unsigned;
                const userId = data.session.user.id;
                const [privateResult, globalResult] = await Promise.allSettled([
                    Promise.resolve().then(() => client.from('run_results').insert({
                        run_id: terminalResult.runId,
                        user_id: userId,
                        outcome: terminalResult.outcome === 'abandonment' ? 'abandoned' : terminalResult.outcome,
                        active_elapsed_ms: terminalResult.activeElapsedMs,
                        final_credits: terminalResult.finalCredits,
                        final_score: terminalResult.finalScore
                    })),
                    Promise.resolve().then(() => globalScoreStore.submit(terminalResult.finalScore))
                ]);
                const privateError = privateResult.status === 'rejected' ? errorMessage(privateResult.reason) : privateResult.value.error?.code === '23505' ? null : privateResult.value.error?.message ?? null;
                const globalError = globalResult.status === 'rejected' ? errorMessage(globalResult.reason) : globalResult.value.error;
                if (privateError || globalError) return failed([privateError, globalError].filter(Boolean).join(' '));
                return saved;
            } catch (error) { return failed(errorMessage(error)); }
        }
    };
}

function errorMessage (error: unknown): string
{
    return error instanceof Error ? error.message : 'Unable to save result.';
}

const saved: ResultStorePersistResult = Object.freeze({ status: 'saved', message: null });
const unsigned: ResultStorePersistResult = Object.freeze({ status: 'unsigned', message: null });
const unavailableResultStore: ResultStorePort = Object.freeze({ persist: async () => unsigned });

function failed (message: string): ResultStorePersistResult
{
    return Object.freeze({ status: 'failed', message });
}
