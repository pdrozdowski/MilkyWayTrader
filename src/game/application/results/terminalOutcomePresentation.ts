import type { TerminalOutcome } from '../../state/terminalResultState';

export type TerminalOutcomeBackgroundKey =
    | 'game-over:destroyed-ship'
    | 'game-over:debt-paid'
    | 'game-over:debt-due';

export function terminalOutcomeBackgroundKey (outcome: TerminalOutcome): TerminalOutcomeBackgroundKey
{
    switch (outcome) {
    case 'death': return 'game-over:destroyed-ship';
    case 'freedom': return 'game-over:debt-paid';
    case 'imprisonment': return 'game-over:debt-due';
    }
}
