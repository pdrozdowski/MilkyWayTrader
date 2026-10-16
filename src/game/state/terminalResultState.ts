export type TerminalOutcome = 'death' | 'freedom' | 'imprisonment';

export interface TerminalResultState
{
    readonly runId: string;
    readonly outcome: TerminalOutcome;
    readonly activeElapsedMs: number;
    readonly finalCredits: number;
}
