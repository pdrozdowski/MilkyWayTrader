import type { TerminalScoreResult } from './terminalScoreResult';

/** Tab-scoped handoff for returning from OAuth to an already completed run. */
export interface GameOverReturnPort
{
    save(terminalResult: TerminalScoreResult): void;
    take(): TerminalScoreResult | null;
}
