import type { GameStateSnapshot } from '../../state/gameStateSnapshot.ts';

export function resolveTerminalResult (state: GameStateSnapshot): GameStateSnapshot
{
    if (state.terminalResult !== null || state.shipStatus.currentHitPoints !== 0) return state;
    return {
        ...state,
        terminalResult: {
            runId: state.runId,
            outcome: 'death',
            activeElapsedMs: Math.floor(state.clock.activeElapsedMs),
            finalCredits: state.credits
        }
    };
}
