import type { GameStateSnapshot } from '../../state/gameStateSnapshot.ts';

export const DEBUG_CASH_AMOUNT = 250_000;

export function addDebugCash (state: GameStateSnapshot): GameStateSnapshot
{
    if (state.terminalResult !== null || state.credits === Number.MAX_SAFE_INTEGER) return state;
    return { ...state, credits: Math.min(Number.MAX_SAFE_INTEGER, state.credits + DEBUG_CASH_AMOUNT) };
}
