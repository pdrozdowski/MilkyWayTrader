import type { Game } from 'phaser';
import type { GameStateProvider } from '../../game/application/gameStateProvider';
import { launchFromPlanet } from '../../game/mechanics/planet/landing';
import type { LandingStatusPort, LandingStatusSnapshot } from '../contracts';

export function createLandingStatusPort (game: Game): LandingStatusPort
{
    const provider = game.registry.get('gameStateProvider') as GameStateProvider;
    const listeners = new Set<(snapshot: Readonly<LandingStatusSnapshot>) => void>();
    let destroyed = false;
    const project = (): LandingStatusSnapshot => {
        const state = provider.snapshot();
        const planetId = state.planetLifecycle.landedPlanetId;
        return { visible: planetId !== null, planetName: state.planets.find(planet => planet.id === planetId)?.name ?? null };
    };
    let snapshot = project();
    const refresh = (): void => {
        if (destroyed) return;
        const next = project();
        if (next.visible === snapshot.visible && next.planetName === snapshot.planetName) return;
        snapshot = next;
        for (const listener of listeners) listener(snapshot);
    };
    const unsubscribe = provider.subscribe(refresh);
    return {
        getSnapshot: () => snapshot,
        subscribe: listener => {
            if (destroyed) return () => {};
            listeners.add(listener);
            listener(snapshot);
            return () => { listeners.delete(listener); };
        },
        launch: () => {
            if (destroyed) return;
            provider.update(launchFromPlanet);
            game.events.emit('landing-modal-transition');
        },
        destroy: () => {
            if (destroyed) return;
            destroyed = true;
            unsubscribe();
            listeners.clear();
        }
    };
}
