import type { Game } from 'phaser';
import type { GameStateProvider } from '../../game/application/gameStateProvider';
import { pauseGameClock, resumeGameClock } from '../../game/mechanics/clock/gameClock';
import type { GamePauseReason } from '../../game/state/gameClockState';
import type { GameControlsPort } from '../contracts';

export function createGameControlsPort (game: Game): GameControlsPort
{
    const provider = game.registry.get('gameStateProvider') as GameStateProvider;
    let menuOpen = false;
    let destroyed = false;
    const setPauseReason = (reason: GamePauseReason, paused: boolean): void => {
        if (destroyed) return;
        const before = provider.snapshot();
        const hasReason = before.clock.pauseReasons.includes(reason);
        if (hasReason === paused) return;
        provider.update(state => ({ ...state, clock: paused ? pauseGameClock(state.clock, reason) : resumeGameClock(state.clock, reason) }));
        if (paused) game.events.emit('game-pause-reason-added', reason);
    };
    return {
        openMenu: () => { if (!menuOpen && !destroyed) { menuOpen = true; setPauseReason('menu', true); } },
        closeMenu: () => { if (menuOpen && !destroyed) { menuOpen = false; setPauseReason('menu', false); } },
        exitToMainMenu: () => { if (!destroyed) { menuOpen = false; setPauseReason('menu', false); game.events.emit('return-to-menu'); } },
        setOrientationPaused: paused => setPauseReason('orientation', paused),
        isMenuOpen: () => menuOpen,
        destroy: () => { destroyed = true; }
    };
}
