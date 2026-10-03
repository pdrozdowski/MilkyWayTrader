import type { TerminalResultState } from '../../state/terminalResultState';

export type ResultStorePersistStatus = 'saved' | 'failed' | 'unsigned';

export interface ResultStorePersistResult
{
    readonly status: ResultStorePersistStatus;
    readonly message: string | null;
}

export interface ResultStorePort
{
    persist(terminalResult: TerminalResultState): Promise<ResultStorePersistResult>;
}
