import type { TerminalScoreResult } from './terminalScoreResult.ts';
import type { GameStateSnapshot } from '../../state/gameStateSnapshot.ts';

export interface PendingRunResultIntent
{
    readonly terminalResult: TerminalScoreResult;
    readonly snapshot: GameStateSnapshot;
    readonly expectedRevision: number;
}

export interface PendingRunResultPort
{
    load(ownerId: string): PendingRunResultIntent | null;
    save(ownerId: string, intent: PendingRunResultIntent): void;
    clear(ownerId: string): void;
}
