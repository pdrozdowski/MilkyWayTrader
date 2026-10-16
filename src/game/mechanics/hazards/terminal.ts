import type { GameStateSnapshot } from '../../state/gameStateSnapshot.ts';
import type { TerminalOutcome } from '../../state/terminalResultState.ts';

export type TimeoutClassifier = (state: GameStateSnapshot) => Exclude<TerminalOutcome, 'death'>;

export function resolveTerminalResult (state: GameStateSnapshot, classifyTimeout: TimeoutClassifier): GameStateSnapshot
{
    if (state.terminalResult !== null) return state;
    const timedOut = state.clock.activeElapsedMs >= state.clock.budgetMs;
    if (!timedOut && state.shipStatus.currentHitPoints !== 0) return state;
    return {
        ...state,
        terminalResult: {
            runId: state.runId,
            outcome: timedOut ? classifyTimeout(state) : 'death',
            activeElapsedMs: Math.floor(state.clock.activeElapsedMs),
            finalCredits: state.credits
        }
    };
}
