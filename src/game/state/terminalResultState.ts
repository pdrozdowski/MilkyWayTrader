export type TerminalOutcome = 'death' | 'freedom' | 'imprisonment' | 'abandonment';

export interface TerminalResultState
{
    readonly runId: string;
    readonly outcome: TerminalOutcome;
    readonly activeElapsedMs: number;
    readonly finalCredits: number;
}
