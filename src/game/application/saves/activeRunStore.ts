import type { GameStateSnapshot } from '../../state/gameStateSnapshot.ts';

export type ActiveRunFailureKind = 'conflict' | 'ineligible' | 'incompatible' | 'unavailable';
export interface ActiveRunAcknowledgement { readonly revision: number; }
export type ActiveRunMutationResult = { readonly success: true; readonly acknowledgement: ActiveRunAcknowledgement } | { readonly success: false; readonly kind: ActiveRunFailureKind; readonly message: string };
export type ActiveRunLoadResult =
    | { readonly status: 'empty'; readonly revision: number }
    | { readonly status: 'active' | 'terminal-pending'; readonly revision: number; readonly snapshot: GameStateSnapshot }
    | { readonly status: 'incompatible'; readonly revision: number; readonly runId?: string; readonly message: string }
    | { readonly status: 'unavailable' | 'ineligible'; readonly message: string };

export interface ActiveRunStorePort
{
    load(): Promise<ActiveRunLoadResult>;
    create(snapshot: GameStateSnapshot, expectedRevision: number, mutationId: string): Promise<ActiveRunMutationResult>;
    save(snapshot: GameStateSnapshot, expectedRevision: number, mutationId: string): Promise<ActiveRunMutationResult>;
    markTerminal(snapshot: GameStateSnapshot, expectedRevision: number, mutationId: string): Promise<ActiveRunMutationResult>;
    discard(expectedRunId: string, expectedRevision: number, mutationId: string, confirmed: boolean): Promise<ActiveRunMutationResult>;
}
