import type { ResultHistoryResult } from './resultHistoryStore.ts';

export interface GlobalScoreRecord
{
    readonly rank: number;
    readonly nickname: string;
    readonly achievedAt: string;
    readonly score: number;
}

export interface GlobalScoreStorePort
{
    submit(score: number): Promise<{ readonly error: string | null }>;
    getTop(): Promise<ResultHistoryResult<readonly GlobalScoreRecord[]>>;
    getPersonalBestRank(score: number): Promise<ResultHistoryResult<number | null>>;
}
