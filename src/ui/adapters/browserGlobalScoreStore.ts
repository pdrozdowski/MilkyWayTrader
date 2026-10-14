import { createClient } from '@supabase/supabase-js';
import type { GlobalScoreRecord, GlobalScoreStorePort } from '../../game/application/results/globalScoreStore.ts';
import type { ResultHistoryResult } from '../../game/application/results/resultHistoryStore.ts';
import { browserAuthConfiguration, type PublicAuthConfiguration } from '../../game/application/auth/configuration.ts';

interface ScoreRow
{
    readonly rank: number;
    readonly nickname: string;
    readonly achieved_at: string;
    readonly score: number;
}

interface ScoreClient
{
    readonly auth: { getSession(): PromiseLike<{ data: { session: { user: { id: string } } | null }; error: { message: string } | null }> };
    rpc(name: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

type ClientFactory = (url: string, key: string) => ScoreClient;
const createScoreClient: ClientFactory = (url, key) => createClient(url, key) as unknown as ScoreClient;

function validConfiguration (configuration: PublicAuthConfiguration): configuration is Required<PublicAuthConfiguration>
{
    if (!configuration.url || !configuration.publishableKey || /\s/.test(configuration.publishableKey) || configuration.publishableKey.length < 20) return false;
    try { const url = new URL(configuration.url); return url.protocol === 'https:' || url.hostname === 'localhost' || url.hostname === '127.0.0.1'; }
    catch { return false; }
}

function failed<T> (message: string): ResultHistoryResult<T>
{
    return Object.freeze({ data: null, error: message });
}

function validScore (score: number): boolean
{
    return Number.isSafeInteger(score) && score >= 0;
}

function mapScore (row: ScoreRow): GlobalScoreRecord
{
    return Object.freeze({ rank: row.rank, nickname: row.nickname, achievedAt: row.achieved_at, score: row.score });
}

export function createBrowserGlobalScoreStore (configuration = browserAuthConfiguration(), clientFactory: ClientFactory = createScoreClient): GlobalScoreStorePort
{
    if (!validConfiguration(configuration)) return unavailable;
    const client = clientFactory(configuration.url, configuration.publishableKey);
    return {
        submit: async score => {
            if (!validScore(score)) return { error: 'Invalid global score.' };
            try {
                const { data: session, error: sessionError } = await client.auth.getSession();
                if (sessionError) return { error: sessionError.message };
                if (!session.session) return { error: 'Authentication required.' };
                const { error } = await client.rpc('submit_global_score', { submitted_score: score });
                return { error: error?.message ?? null };
            } catch (error) { return { error: error instanceof Error ? error.message : 'Unable to save global score.' }; }
        },
        getTop: async () => {
            try {
                const { data, error } = await client.rpc('global_high_scores');
                if (error) return failed(error.message);
                if (!Array.isArray(data) || !data.every(row => isScoreRow(row))) return failed('Invalid global score response.');
                return Object.freeze({ data: Object.freeze(data.map(mapScore)), error: null });
            } catch (error) { return failed(error instanceof Error ? error.message : 'Unable to load global scores.'); }
        },
        getPersonalBestRank: async score => {
            if (!validScore(score)) return failed('Invalid global score.');
            try {
                const { data: session, error: sessionError } = await client.auth.getSession();
                if (sessionError) return failed(sessionError.message);
                if (!session.session) return failed('Authentication required.');
                const { data, error } = await client.rpc('global_score_rank', { personal_score: score });
                if (error) return failed(error.message);
                if (typeof data !== 'number' || !Number.isSafeInteger(data) || data < 1) return failed('Invalid global rank response.');
                return Object.freeze({ data, error: null });
            } catch (error) { return failed(error instanceof Error ? error.message : 'Unable to load global rank.'); }
        }
    };
}

function isScoreRow (value: unknown): value is ScoreRow
{
    if (typeof value !== 'object' || value === null) return false;
    const row = value as Partial<ScoreRow>;
    return Number.isSafeInteger(row.rank) && (row.rank as number) > 0 && typeof row.nickname === 'string' && typeof row.achieved_at === 'string' && validScore(row.score as number);
}

const unavailable: GlobalScoreStorePort = Object.freeze({
    submit: async () => ({ error: 'Global scores are unavailable.' }),
    getTop: async () => failed<readonly GlobalScoreRecord[]>('Global scores are unavailable.'),
    getPersonalBestRank: async () => failed<number | null>('Global scores are unavailable.')
});
