export type ResultHistoryOutcome = 'freedom' | 'imprisonment' | 'death' | 'abandoned';

export interface ResultHistoryRecord
{
    readonly runId: string;
    readonly activeElapsedMs: number;
    readonly finalCredits: number;
    readonly finalScore: number | null;
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

export type ResultHistoryMutationResult =
    | { readonly success: true; readonly error: null }
    | { readonly success: false; readonly error: string };

export interface ResultHistoryStorePort
{
    getPage(page: number): Promise<ResultHistoryResult<ResultHistoryPage>>;
    getBest(): Promise<ResultHistoryResult<ResultHistoryRecord>>;
    deleteResult(runId: string): Promise<ResultHistoryMutationResult>;
    clearHistory(): Promise<ResultHistoryMutationResult>;
}

export const resultHistoryPageSize = 5;
