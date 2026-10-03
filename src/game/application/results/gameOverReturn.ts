import type { TerminalResultState } from '../../state/terminalResultState';

/** Tab-scoped handoff for returning from OAuth to an already completed run. */
export interface GameOverReturnPort
{
    save(terminalResult: TerminalResultState): void;
    take(): TerminalResultState | null;
}
