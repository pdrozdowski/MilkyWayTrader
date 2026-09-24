export type GamePauseReason = 'background' | 'landed' | 'manual' | 'menu' | 'orientation';

export interface GameClockState
{
    readonly budgetMs: number;
    readonly activeElapsedMs: number;
    readonly pauseReasons: readonly GamePauseReason[];
}
