import { calculateTerminalScore, DEBT_SCORE_THRESHOLD } from '../../domain/finalScore.ts';
import type { GameStateSnapshot } from '../../state/gameStateSnapshot.ts';
import type { TerminalResultState } from '../../state/terminalResultState.ts';

export interface TerminalScoreResult extends TerminalResultState
{
    readonly cargoValue: number;
    readonly shipUpgradeSpend: number;
    readonly facilityUpgradeSpend: number;
    readonly finalScore: number;
}

export type TimeoutOutcome = 'freedom' | 'imprisonment';

export function classifyTimeoutOutcome (state: GameStateSnapshot): TimeoutOutcome
{
    const score = calculateTerminalScore({
        endingCash: state.credits,
        cargo: state.cargo,
        shipUpgradeSpend: state.shipUpgradeSpend,
        facilityUpgradeSpend: state.facilityUpgradeSpend
    });
    return score.finalScore >= DEBT_SCORE_THRESHOLD ? 'freedom' : 'imprisonment';
}

/** Combines authoritative terminal facts with the shared score for delivery and presentation. */
export function createTerminalScoreResult (state: GameStateSnapshot): TerminalScoreResult
{
    const terminalResult = state.terminalResult;
    if (terminalResult === null) throw new Error('A terminal score requires a completed run.');
    const score = calculateTerminalScore({
        endingCash: terminalResult.finalCredits,
        cargo: state.cargo,
        shipUpgradeSpend: state.shipUpgradeSpend,
        facilityUpgradeSpend: state.facilityUpgradeSpend
    });
    return Object.freeze({
        ...terminalResult,
        cargoValue: score.cargoValue,
        shipUpgradeSpend: score.shipUpgradeSpend,
        facilityUpgradeSpend: score.facilityUpgradeSpend,
        finalScore: score.finalScore
    });
}
