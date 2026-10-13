export type ResultHistoryOutcome = 'freedom' | 'imprisonment' | 'death' | 'abandoned';

export interface ResultHistoryRecord
{
    readonly runId: string;
    readonly finalCredits: number;
    readonly outcome: ResultHistoryOutcome;
    readonly savedAt: string;
}

export interface ResultHistoryPage
{
    readonly records: readonly ResultHistoryRecord[];
    readonly totalCount: number;
}

export interface ResultHistoryResult<T>
{
    readonly data: T | null;
    readonly error: string | null;
}

export interface ResultHistoryStorePort
{
    getPage(page: number): Promise<ResultHistoryResult<ResultHistoryPage>>;
    getBest(): Promise<ResultHistoryResult<ResultHistoryRecord>>;
}

export const resultHistoryPageSize = 5;
