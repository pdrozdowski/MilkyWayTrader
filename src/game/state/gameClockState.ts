export type GamePauseReason = 'background' | 'manual' | 'menu' | 'orientation';

export interface GameClockState
{
    readonly budgetMs: number;
    readonly activeElapsedMs: number;
    readonly playerPaused: boolean;
    readonly pauseReasons: readonly GamePauseReason[];
}
