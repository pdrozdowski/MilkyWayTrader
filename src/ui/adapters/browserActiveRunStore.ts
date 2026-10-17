import { createClient } from '@supabase/supabase-js';
import { decodeGameState, encodeGameState } from '../../game/application/gameStateCodec.ts';
import type { ActiveRunFailureKind, ActiveRunLoadResult, ActiveRunMutationResult, ActiveRunStorePort } from '../../game/application/saves/activeRunStore.ts';
import type { GameStateSnapshot } from '../../game/state/gameStateSnapshot.ts';
import { browserAuthConfiguration, type PublicAuthConfiguration } from '../../game/application/auth/configuration.ts';

interface SaveClient
{
    readonly auth: { getSession(): PromiseLike<{ data: { session: { user: { id: string } } | null }; error: { message: string } | null }> };
    rpc(name: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>;
}
type ClientFactory = (url: string, key: string) => SaveClient;
const createSaveClient: ClientFactory = (url, key) => createClient(url, key) as unknown as SaveClient;

function validConfiguration (configuration: PublicAuthConfiguration): configuration is Required<PublicAuthConfiguration>
{
    if (!configuration.url || !configuration.publishableKey || /\s/.test(configuration.publishableKey) || configuration.publishableKey.length < 20) return false;
    try { const url = new URL(configuration.url); return url.protocol === 'https:' || url.hostname === 'localhost' || url.hostname === '127.0.0.1'; }
    catch { return false; }
}

function failureKind (error: { code?: string; message: string }): ActiveRunFailureKind
{
    if (error.code === '40001') return 'conflict';
    if (error.code === '42501') return 'ineligible';
    if (error.code === '22023') return 'incompatible';
    return 'unavailable';
}

export function createBrowserActiveRunStore (configuration = browserAuthConfiguration(), clientFactory: ClientFactory = createSaveClient): ActiveRunStorePort
{
    if (!validConfiguration(configuration)) return Object.freeze({
        load: async () => ({ status: 'unavailable' as const, message: 'Active saves are unavailable.' }),
        create: async () => unavailable(), save: async () => unavailable(), markTerminal: async () => unavailable(), discard: async () => unavailable()
    });
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
    async function currentOwner (captured: { id: string; epoch: number }): Promise<boolean>
    {
        const current = await captureOwner();
        return current?.id === captured.id && current.epoch === captured.epoch;
    }
    async function load (): Promise<ActiveRunLoadResult>
    {
        try {
            const owner = await captureOwner();
            if (!owner) return { status: 'ineligible', message: 'Sign in with a player profile to use saved runs.' };
            const { data, error } = await client.rpc('load_active_run');
            if (error) return { status: failureKind(error) === 'ineligible' ? 'ineligible' : 'unavailable', message: error.message };
            if (!await currentOwner(owner)) return { status: 'unavailable', message: 'Account changed while loading the saved run.' };
            if (!isRecord(data) || typeof data.revision !== 'number' || !Number.isSafeInteger(data.revision)) return { status: 'unavailable', message: 'Invalid active-save response.' };
            if (data.status === 'empty') return { status: 'empty', revision: data.revision };
            if ((data.status !== 'active' && data.status !== 'terminal_pending') || data.snapshot === null) return { status: 'unavailable', message: 'Invalid active-save response.' };
            try {
                const snapshot = decodeGameState(data.snapshot);
                return { status: data.status === 'active' ? 'active' : 'terminal-pending', revision: data.revision, snapshot };
            } catch (error) { return { status: 'incompatible', revision: data.revision, ...(isRecord(data.snapshot) && typeof data.snapshot.runId === 'string' ? { runId: data.snapshot.runId } : {}), message: error instanceof Error ? error.message : 'Saved run is incompatible.' }; }
        } catch (error) { return { status: 'unavailable', message: errorMessage(error) }; }
    }
    async function mutate (operation: string, expectedRunId: string | null, expectedRevision: number, mutationId: string, snapshot?: GameStateSnapshot): Promise<ActiveRunMutationResult>
    {
        try {
            if (snapshot) encodeGameState(snapshot);
            const owner = await captureOwner();
            if (!owner) return { success: false, kind: 'ineligible', message: 'Sign in with a player profile to use saved runs.' };
            const rpcName = operation === 'create' ? 'create_active_run' : operation === 'save' ? 'save_active_run' : operation === 'mark_terminal' ? 'mark_active_run_terminal' : 'discard_active_run';
            const args = operation === 'create'
                ? { expected_revision: expectedRevision, mutation_id: mutationId, next_run_id: snapshot?.runId, next_snapshot: snapshot ? JSON.parse(encodeGameState(snapshot)) as unknown : null, next_schema_version: snapshot?.schemaVersion }
                : operation === 'discard'
                    ? { expected_run_id: expectedRunId, expected_revision: expectedRevision, mutation_id: mutationId, confirmed: true }
                    : { expected_run_id: expectedRunId, expected_revision: expectedRevision, mutation_id: mutationId, next_snapshot: snapshot ? JSON.parse(encodeGameState(snapshot)) as unknown : null, next_schema_version: snapshot?.schemaVersion };
            const { data, error } = await client.rpc(rpcName, args);
            if (error) return { success: false, kind: failureKind(error), message: error.message };
            if (!await currentOwner(owner)) return { success: false, kind: 'conflict', message: 'Account changed while saving.' };
            if (!isRecord(data) || typeof data.revision !== 'number' || !Number.isSafeInteger(data.revision)) return { success: false, kind: 'unavailable', message: 'Invalid save acknowledgement.' };
            return { success: true, acknowledgement: { revision: data.revision } };
        } catch (error) { return { success: false, kind: 'incompatible', message: errorMessage(error) }; }
    }
    return {
        load,
        create: (snapshot, revision, mutationId) => mutate('create', null, revision, mutationId, snapshot),
        save: (snapshot, revision, mutationId) => mutate('save', snapshot.runId, revision, mutationId, snapshot),
        markTerminal: (snapshot, revision, mutationId) => mutate('mark_terminal', snapshot.runId, revision, mutationId, snapshot),
        discard: (runId, revision, mutationId, confirmed) => confirmed ? mutate('discard', runId, revision, mutationId) : Promise.resolve({ success: false, kind: 'incompatible', message: 'Save discard requires confirmation.' })
    };
}

function isRecord (value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function errorMessage (error: unknown): string { return error instanceof Error ? error.message : 'Unable to access active saves.'; }
function unavailable (): ActiveRunMutationResult { return { success: false, kind: 'unavailable', message: 'Active saves are unavailable.' }; }
