import { createClient } from '@supabase/supabase-js';
import type { ResultHistoryOutcome, ResultHistoryPage, ResultHistoryRecord, ResultHistoryResult, ResultHistoryStorePort } from '../../game/application/results/resultHistoryStore.ts';
import { resultHistoryPageSize } from '../../game/application/results/resultHistoryStore.ts';
import { browserAuthConfiguration, type PublicAuthConfiguration } from '../../game/application/auth/configuration.ts';

interface HistoryRow
{
    readonly run_id: string;
    readonly active_elapsed_ms: number;
    readonly final_credits: number;
    readonly outcome: ResultHistoryOutcome;
    readonly created_at: string;
}

interface HistoryQuery extends PromiseLike<{ data: HistoryRow[] | null; count?: number | null; error: { message: string } | null }>
{
    select(columns: string, options: { count: 'exact' }): HistoryQuery;
    order(column: string, options: { ascending: boolean }): HistoryQuery;
    range(from: number, to: number): HistoryQuery;
    limit(count: number): HistoryQuery;
}

interface HistoryClient
{
    from(table: 'run_results'): {
        select(columns: string, options: { count: 'exact' }): HistoryQuery;
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
    return Object.freeze({ runId: row.run_id, activeElapsedMs: row.active_elapsed_ms, finalCredits: row.final_credits, outcome: row.outcome, savedAt: row.created_at });
}

function failed<T> (message: string): ResultHistoryResult<T>
{
    return Object.freeze({ data: null, error: message });
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
                    .select('run_id, active_elapsed_ms, final_credits, outcome, created_at', { count: 'exact' })
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
                    .select('run_id, active_elapsed_ms, final_credits, outcome, created_at', { count: 'exact' })
                    .order('final_credits', { ascending: false })
                    .order('created_at', { ascending: true })
                    .order('run_id', { ascending: true })
                    .limit(1);
                if (error) return failed(error.message);
                const result = data?.[0] ? mapRecord(data[0]) : null;
                return Object.freeze({ data: result, error: null });
            } catch (error) {
                return failed(error instanceof Error ? error.message : 'Unable to load best result.');
            }
        }
    };
}

const unavailableResultHistoryStore: ResultHistoryStorePort = Object.freeze({
    getPage: async () => failed<ResultHistoryPage>('Result history is unavailable.'),
    getBest: async () => failed<ResultHistoryRecord>('Result history is unavailable.')
});
