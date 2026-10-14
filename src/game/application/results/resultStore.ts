import type { TerminalScoreResult } from './terminalScoreResult';

export type ResultStorePersistStatus = 'saved' | 'failed' | 'unsigned';

export interface ResultStorePersistResult
{
    readonly status: ResultStorePersistStatus;
    readonly message: string | null;
}

export interface ResultStorePort
{
    persist(terminalResult: TerminalScoreResult): Promise<ResultStorePersistResult>;
}
