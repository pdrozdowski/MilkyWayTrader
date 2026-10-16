import { createClient } from '@supabase/supabase-js';
import type { ResultHistoryMutationResult, ResultHistoryOutcome, ResultHistoryPage, ResultHistoryRecord, ResultHistoryResult, ResultHistoryStorePort } from '../../game/application/results/resultHistoryStore.ts';
import { resultHistoryPageSize } from '../../game/application/results/resultHistoryStore.ts';
import { browserAuthConfiguration, type PublicAuthConfiguration } from '../../game/application/auth/configuration.ts';

interface HistoryRow
{
    readonly run_id: string;
    readonly active_elapsed_ms: number;
    readonly final_credits: number;
    readonly final_score: number | null;
    readonly outcome: ResultHistoryOutcome;
    readonly created_at: string;
}

interface HistoryQuery extends PromiseLike<{ data: HistoryRow[] | null; count?: number | null; error: { message: string } | null }>
{
    select(columns: string, options: { count: 'exact' }): HistoryQuery;
    order(column: string, options: { ascending: boolean; nullsFirst?: boolean }): HistoryQuery;
    range(from: number, to: number): HistoryQuery;
    limit(count: number): HistoryQuery;
    not(column: string, operator: string, value: unknown): HistoryQuery;
}

interface DeleteQuery extends PromiseLike<{ error: { message: string } | null }>
{
    eq(column: string, value: string): DeleteQuery;
}

interface HistoryClient
{
    readonly auth: { getSession(): PromiseLike<{ data: { session: { user: { id: string } } | null }; error: { message: string } | null }> };
    from(table: 'run_results'): {
        select(columns: string, options: { count: 'exact' }): HistoryQuery;
        delete(): DeleteQuery;
    };
}

type ClientFactory = (url: string, key: string) => HistoryClient;
const createHistoryClient: ClientFactory = (url, key) => createClient(url, key) as unknown as HistoryClient;

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

function mapRecord (row: HistoryRow): ResultHistoryRecord
{
    return Object.freeze({ runId: row.run_id, activeElapsedMs: row.active_elapsed_ms, finalCredits: row.final_credits, finalScore: row.final_score, outcome: row.outcome, savedAt: row.created_at });
}

function failed<T> (message: string): ResultHistoryResult<T>
{
    return Object.freeze({ data: null, error: message });
}

function mutationFailed (message: string): ResultHistoryMutationResult
{
    return Object.freeze({ success: false, error: message });
}

async function authenticatedUserId (client: HistoryClient): Promise<{ userId: string | null; error: string | null }>
{
    try {
        const { data, error } = await client.auth.getSession();
        if (error) return { userId: null, error: error.message };
        if (!data.session) return { userId: null, error: 'Sign in to manage result history.' };
        return { userId: data.session.user.id, error: null };
    } catch (error) {
        return { userId: null, error: error instanceof Error ? error.message : 'Unable to verify the active session.' };
    }
}

export function createBrowserResultHistoryStore (configuration = browserAuthConfiguration(), clientFactory: ClientFactory = createHistoryClient): ResultHistoryStorePort
{
    if (!validConfiguration(configuration)) return unavailableResultHistoryStore;
    const client = clientFactory(configuration.url, configuration.publishableKey);
    return {
        getPage: async page => {
            if (!Number.isInteger(page) || page < 0) return failed('Invalid result history page.');
            try {
                const from = page * resultHistoryPageSize;
                const { data, count, error } = await client.from('run_results')
                    .select('run_id, active_elapsed_ms, final_credits, final_score, outcome, created_at', { count: 'exact' })
                    .order('final_score', { ascending: false, nullsFirst: false })
                    .order('final_credits', { ascending: false })
                    .order('created_at', { ascending: false })
                    .order('run_id', { ascending: true })
                    .range(from, from + resultHistoryPageSize - 1);
                if (error) return failed(error.message);
                const result: ResultHistoryPage = Object.freeze({ records: Object.freeze((data ?? []).map(mapRecord)), totalCount: count ?? 0 });
                return Object.freeze({ data: result, error: null });
            } catch (error) {
                return failed(error instanceof Error ? error.message : 'Unable to load result history.');
            }
        },
        getBest: async () => {
            try {
                const { data, error } = await client.from('run_results')
                    .select('run_id, active_elapsed_ms, final_credits, final_score, outcome, created_at', { count: 'exact' })
                    .not('final_score', 'is', null)
                    .order('final_score', { ascending: false })
                    .order('created_at', { ascending: true })
                    .order('run_id', { ascending: true })
                    .limit(1);
                if (error) return failed(error.message);
                const result = data?.[0] ? mapRecord(data[0]) : null;
                return Object.freeze({ data: result, error: null });
            } catch (error) {
                return failed(error instanceof Error ? error.message : 'Unable to load best result.');
            }
        },
        deleteResult: async runId => {
            if (!runId) return mutationFailed('Invalid result id.');
            try {
                const session = await authenticatedUserId(client);
                if (session.error || !session.userId) return mutationFailed(session.error ?? 'Sign in to manage result history.');
                const { error } = await client.from('run_results').delete().eq('run_id', runId).eq('user_id', session.userId);
                if (error) return mutationFailed(error.message);
                return Object.freeze({ success: true, error: null });
            } catch (error) {
                return mutationFailed(error instanceof Error ? error.message : 'Unable to delete result.');
            }
        },
        clearHistory: async () => {
            try {
                const session = await authenticatedUserId(client);
                if (session.error || !session.userId) return mutationFailed(session.error ?? 'Sign in to manage result history.');
                const { error } = await client.from('run_results').delete().eq('user_id', session.userId);
                if (error) return mutationFailed(error.message);
                return Object.freeze({ success: true, error: null });
            } catch (error) {
                return mutationFailed(error instanceof Error ? error.message : 'Unable to clear result history.');
            }
        }
    };
}

const unavailableResultHistoryStore: ResultHistoryStorePort = Object.freeze({
    getPage: async () => failed<ResultHistoryPage>('Result history is unavailable.'),
    getBest: async () => failed<ResultHistoryRecord>('Result history is unavailable.'),
    deleteResult: async () => mutationFailed('Result history is unavailable.'),
    clearHistory: async () => mutationFailed('Result history is unavailable.')
});
