import type { GameClockState, GamePauseReason } from '../../state/gameClockState';

export function advanceGameClock (clock: GameClockState, deltaMs: number): GameClockState
{
    if (!Number.isFinite(deltaMs) || deltaMs < 0) throw new Error('Clock delta must be a non-negative finite number.');
    if (clock.pauseReasons.length > 0 || deltaMs === 0) return clock;
    return { ...clock, activeElapsedMs: Math.min(clock.budgetMs, clock.activeElapsedMs + deltaMs) };
}

export function pauseGameClock (clock: GameClockState, reason: GamePauseReason): GameClockState
{
    if (clock.pauseReasons.includes(reason)) return clock;
    return { ...clock, pauseReasons: [...clock.pauseReasons, reason].sort() };
}

export function resumeGameClock (clock: GameClockState, reason: GamePauseReason): GameClockState
{
    if (!clock.pauseReasons.includes(reason)) return clock;
    return { ...clock, pauseReasons: clock.pauseReasons.filter(candidate => candidate !== reason) };
}
