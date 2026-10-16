export interface TerminalScoreInput
{
    readonly endingCash: number;
    readonly cargo: readonly { readonly totalCost: number }[];
    readonly shipUpgradeSpend: number;
    readonly facilityUpgradeSpend: number;
}

export const DEBT_SCORE_THRESHOLD = 1_000_000;

export interface TerminalScoreBreakdown
{
    readonly endingCash: number;
    readonly cargoValue: number;
    readonly shipUpgradeSpend: number;
    readonly facilityUpgradeSpend: number;
    readonly finalScore: number;
}

/** Calculates the outcome-independent run score, rounding only the combined total. */
export function calculateTerminalScore (input: TerminalScoreInput): TerminalScoreBreakdown
{
    const cargoValue = input.cargo.reduce((value, stack) => value + stack.totalCost, 0);
    return {
        endingCash: input.endingCash,
        cargoValue,
        shipUpgradeSpend: input.shipUpgradeSpend,
        facilityUpgradeSpend: input.facilityUpgradeSpend,
        finalScore: Math.round(input.endingCash + cargoValue + input.shipUpgradeSpend + input.facilityUpgradeSpend)
    };
}
