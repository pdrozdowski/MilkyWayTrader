import { decodeGameState, encodeGameState } from './gameStateCodec.ts';
import type { GameStateSnapshot } from '../state/gameStateSnapshot';

export type GameStateReducer = (state: GameStateSnapshot) => GameStateSnapshot;
export type GameStateListener = (state: GameStateSnapshot) => void;

export class GameStateProvider
{
    private state: GameStateSnapshot;
    private readonly initialState: GameStateSnapshot;
    private readonly listeners = new Set<GameStateListener>();

    constructor (initialState: GameStateSnapshot)
    {
        this.initialState = decodeGameState(initialState);
        this.state = this.initialState;
    }

    snapshot (): GameStateSnapshot
    {
        return decodeGameState(encodeGameState(this.state));
    }

    update (reducer: GameStateReducer): GameStateSnapshot
    {
        const next = decodeGameState(reducer(this.state));
        this.state = next;
        return this.publish();
    }

    restore (candidate: unknown): GameStateSnapshot
    {
        const next = decodeGameState(candidate);
        this.state = next;
        return this.publish();
    }

    reset (initialState: GameStateSnapshot = this.initialState): GameStateSnapshot
    {
        const next = decodeGameState(initialState);
        this.state = next;
        return this.publish();
    }

    subscribe (listener: GameStateListener): () => void
    {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private publish (): GameStateSnapshot
    {
        const snapshot = this.snapshot();
        for (const listener of this.listeners) listener(snapshot);
        return snapshot;
    }
}
