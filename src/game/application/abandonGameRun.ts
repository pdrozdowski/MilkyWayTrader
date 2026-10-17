import type { GameStateProvider } from './gameStateProvider';
import type { GameStateSnapshot } from '../state/gameStateSnapshot';

/** Records an explicit player abandonment without requiring a death or timeout condition. */
export function abandonGameRun (state: GameStateSnapshot): GameStateSnapshot
{
    if (state.terminalResult !== null) return state;
    return {
        ...state,
        terminalResult: {
            runId: state.runId,
            outcome: 'abandonment',
            activeElapsedMs: Math.floor(state.clock.activeElapsedMs),
            finalCredits: state.credits
        }
    };
}

/** Applies a confirmed abandonment through the authoritative state owner. */
export function confirmGameRunAbandonment (provider: GameStateProvider): void
{
    provider.update(abandonGameRun);
}
