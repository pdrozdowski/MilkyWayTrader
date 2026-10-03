import type { TerminalResultState } from '../../state/terminalResultState';
import type { ResultStorePersistResult, ResultStorePort } from './resultStore';

export type ResultDeliveryStatus = 'pending' | ResultStorePersistResult['status'];

export function createResultDelivery (store: ResultStorePort | undefined, terminalResult: TerminalResultState, publish: (result: { status: ResultDeliveryStatus; message: string | null }) => void): { start(): void; retry(): void }
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
