import { createClient } from '@supabase/supabase-js';
import type { ResultStorePersistResult, ResultStorePort } from '../../game/application/results/resultStore';
import type { TerminalResultState } from '../../game/state/terminalResultState';
import { browserAuthConfiguration, type PublicAuthConfiguration } from '../../game/application/auth/configuration.ts';

interface ResultClient
{
    readonly auth: {
        getSession(): PromiseLike<{ data: { session: { user: { id: string } } | null }; error: { message: string } | null }>;
    };
    from(table: 'run_results'): {
        insert(row: ResultRow): PromiseLike<{ error: { code?: string; message: string } | null }>;
    };
}

interface ResultRow
{
    readonly run_id: string;
    readonly user_id: string;
    readonly outcome: TerminalResultState['outcome'];
    readonly active_elapsed_ms: number;
    readonly final_credits: number;
}

type ClientFactory = (url: string, key: string) => ResultClient;

function validConfiguration (configuration: PublicAuthConfiguration): configuration is Required<PublicAuthConfiguration>
{
    if (!configuration.url || !configuration.publishableKey || /\s/.test(configuration.publishableKey) || configuration.publishableKey.length < 20) return false;
    try {
        const url = new URL(configuration.url);
        return url.protocol === 'https:' || url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    } catch {
        return false;
    }
}

export function createBrowserResultStore (configuration = browserAuthConfiguration(), clientFactory: ClientFactory = createClient): ResultStorePort
{
    if (!validConfiguration(configuration)) return unavailableResultStore;
    const client = clientFactory(configuration.url, configuration.publishableKey);
    return {
        persist: async terminalResult => {
            try {
                const { data, error: sessionError } = await client.auth.getSession();
                if (sessionError) return failed(sessionError.message);
                if (!data.session) return unsigned;
                const { error } = await client.from('run_results').insert({
                    run_id: terminalResult.runId,
                    user_id: data.session.user.id,
                    outcome: terminalResult.outcome,
                    active_elapsed_ms: terminalResult.activeElapsedMs,
                    final_credits: terminalResult.finalCredits
                });
                if (!error || error.code === '23505') return saved;
                return failed(error.message);
            } catch (error) {
                return failed(error instanceof Error ? error.message : 'Unable to save result.');
            }
        }
    };
}

const saved: ResultStorePersistResult = Object.freeze({ status: 'saved', message: null });
const unsigned: ResultStorePersistResult = Object.freeze({ status: 'unsigned', message: null });
const unavailableResultStore: ResultStorePort = Object.freeze({ persist: async () => unsigned });

function failed (message: string): ResultStorePersistResult
{
    return Object.freeze({ status: 'failed', message });
}
