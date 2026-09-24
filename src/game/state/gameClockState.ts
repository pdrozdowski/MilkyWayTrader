export type GamePauseReason = 'background' | 'landed' | 'manual' | 'menu';

export interface GameClockState
{
    readonly budgetMs: number;
    readonly activeElapsedMs: number;
    readonly pauseReasons: readonly GamePauseReason[];
}
