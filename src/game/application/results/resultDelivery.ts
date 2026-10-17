import type { TerminalScoreResult } from './terminalScoreResult';
import type { ResultStorePersistResult, ResultStorePort } from './resultStore';

export type ResultDeliveryStatus = 'pending' | ResultStorePersistResult['status'];

export interface OwnerResultDeliveryNotice
{
    readonly ownerId: string;
    readonly operationId: number;
    readonly status: ResultDeliveryStatus;
    readonly message: string | null;
}

/** Persists terminal data under one owner epoch and suppresses completions after account changes. */
export async function persistOwnerResult (
    store: ResultStorePort | undefined,
    terminalResult: TerminalScoreResult,
    expectedRevision: number,
    ownerId: string,
    operationId: number,
    isCurrent: () => boolean,
    publish: (result: OwnerResultDeliveryNotice) => void
): Promise<ResultStorePersistResult | null>
{
    publish({ ownerId, operationId, status: 'pending', message: null });
    let result: ResultStorePersistResult;
    try {
        result = await (store?.persist(terminalResult, expectedRevision)
            ?? Promise.resolve<ResultStorePersistResult>({ status: 'unsigned', message: null }));
    } catch (error) {
        result = { status: 'failed', message: error instanceof Error ? error.message : 'Unable to save result.' };
    }
    if (!isCurrent()) return null;
    publish({ ownerId, operationId, status: result.status, message: result.message });
    return result;
}

export function createResultDelivery (store: ResultStorePort | undefined, terminalResult: TerminalScoreResult, publish: (result: { status: ResultDeliveryStatus; message: string | null }) => void): { start(): void; retry(): void }
{
    let attempted = false;
    let retryAvailable = false;
    const persist = (): void => {
        if (attempted) return;
        attempted = true;
        publish({ status: 'pending', message: null });
        void (store?.persist(terminalResult) ?? Promise.resolve<ResultStorePersistResult>({ status: 'unsigned', message: null })).then(result => {
            retryAvailable = result.status === 'failed';
            publish(result);
        }).catch(error => {
            retryAvailable = true;
            publish({ status: 'failed', message: error instanceof Error ? error.message : 'Unable to save result.' });
        });
    };
    return { start: persist, retry: () => { if (retryAvailable) { attempted = false; retryAvailable = false; persist(); } } };
}
