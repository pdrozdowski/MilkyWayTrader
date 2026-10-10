import type { GameClockState, GamePauseReason } from '../../state/gameClockState';

export function advanceGameClock (clock: GameClockState, deltaMs: number): GameClockState
{
    if (!Number.isFinite(deltaMs) || deltaMs < 0) throw new Error('Clock delta must be a non-negative finite number.');
    if (clock.playerPaused || clock.pauseReasons.length > 0 || deltaMs === 0) return clock;
    return { ...clock, activeElapsedMs: Math.min(clock.budgetMs, clock.activeElapsedMs + deltaMs) };
}

export function isGameClockPaused (clock: GameClockState): boolean
{
    return clock.playerPaused || clock.pauseReasons.length > 0;
}

export function setGameClockPlayerPaused (clock: GameClockState, playerPaused: boolean): GameClockState
{
    return clock.playerPaused === playerPaused ? clock : { ...clock, playerPaused };
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
