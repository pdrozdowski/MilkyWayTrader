import { createClient } from '@supabase/supabase-js';
import type { ResultStorePersistResult, ResultStorePort } from '../../game/application/results/resultStore.ts';
import type { TerminalScoreResult } from '../../game/application/results/terminalScoreResult.ts';
import { browserAuthConfiguration, type PublicAuthConfiguration } from '../../game/application/auth/configuration.ts';

interface ResultClient
{
    readonly auth: { getSession(): PromiseLike<{ data: { session: { user: { id: string } } | null }; error: { message: string } | null }> };
    rpc(name: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>;
}
type ClientFactory = (url: string, key: string) => ResultClient;
const createResultClient: ClientFactory = (url, key) => createClient(url, key) as unknown as ResultClient;

function validConfiguration (configuration: PublicAuthConfiguration): configuration is Required<PublicAuthConfiguration>
{
    if (!configuration.url || !configuration.publishableKey || /\s/.test(configuration.publishableKey) || configuration.publishableKey.length < 20) return false;
    try { const url = new URL(configuration.url); return url.protocol === 'https:' || url.hostname === 'localhost' || url.hostname === '127.0.0.1'; }
    catch { return false; }
}
function validTerminalResult (result: TerminalScoreResult): boolean
{
    return typeof result.runId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result.runId)
        && ['death', 'freedom', 'imprisonment', 'abandonment'].includes(String(result.outcome))
        && Number.isSafeInteger(result.activeElapsedMs) && result.activeElapsedMs >= 0
        && Number.isSafeInteger(result.finalCredits) && result.finalCredits >= 0
        && Number.isFinite(result.cargoValue) && result.cargoValue >= 0
        && Number.isSafeInteger(result.shipUpgradeSpend) && result.shipUpgradeSpend >= 0
        && Number.isSafeInteger(result.facilityUpgradeSpend) && result.facilityUpgradeSpend >= 0
        && Number.isSafeInteger(result.finalScore) && result.finalScore >= 0;
}

export function createBrowserResultStore (configuration = browserAuthConfiguration(), clientFactory: ClientFactory = createResultClient): ResultStorePort
{
    if (!validConfiguration(configuration)) return unavailableResultStore;
    const client = clientFactory(configuration.url, configuration.publishableKey);
    let ownerId: string | null = null;
    let epoch = 0;
    async function captureOwner (): Promise<{ id: string; epoch: number } | null>
    {
        const { data, error } = await client.auth.getSession();
        if (error) throw new Error(error.message);
        const id = data.session?.user.id ?? null;
        if (id !== ownerId) { ownerId = id; epoch++; }
        return id ? { id, epoch } : null;
    }
    async function ownerIsCurrent (captured: { id: string; epoch: number }): Promise<boolean>
    {
        const current = await captureOwner();
        return current?.id === captured.id && current.epoch === captured.epoch;
    }
    return {
        persist: async (terminalResult, expectedRevision) => {
            if (!validTerminalResult(terminalResult)) return failed('Invalid terminal score.');
            try {
                const owner = await captureOwner();
                if (!owner) return unsigned;
                const { data: slot, error: loadError } = await client.rpc('load_active_run');
                if (loadError && expectedRevision === undefined) return failed(loadError.message);
                const revision = expectedRevision ?? (isRecord(slot) && typeof slot.revision === 'number' ? slot.revision : 0);
                const { error } = await client.rpc('finalize_active_run', {
                    expected_run_id: terminalResult.runId,
                    expected_revision: revision,
                    mutation_id: terminalResult.runId,
                    outcome: terminalResult.outcome === 'abandonment' ? 'abandoned' : terminalResult.outcome,
                    active_elapsed_ms: terminalResult.activeElapsedMs,
                    final_credits: terminalResult.finalCredits,
                    final_score: terminalResult.finalScore
                });
                if (error) return failed(error.message);
                if (!await ownerIsCurrent(owner)) return failed('Account changed while saving result.');
                return saved;
            } catch (error) { return failed(errorMessage(error)); }
        }
    };
}

function isRecord (value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function errorMessage (error: unknown): string { return error instanceof Error ? error.message : 'Unable to save result.'; }
const saved: ResultStorePersistResult = Object.freeze({ status: 'saved', message: null });
const unsigned: ResultStorePersistResult = Object.freeze({ status: 'unsigned', message: null });
const unavailableResultStore: ResultStorePort = Object.freeze({ persist: async () => unsigned });
function failed (message: string): ResultStorePersistResult { return Object.freeze({ status: 'failed', message }); }
