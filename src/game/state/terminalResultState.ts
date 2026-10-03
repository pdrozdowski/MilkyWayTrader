export interface TerminalResultState
{
    readonly runId: string;
    readonly outcome: 'death';
    readonly activeElapsedMs: number;
    readonly finalCredits: number;
}
