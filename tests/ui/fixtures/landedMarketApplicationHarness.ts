import { Events, type Game } from 'phaser';
import { GameStateProvider } from '../../../src/game/application/gameStateProvider';
import { initialGameState } from '../../../src/game/definitions/initialGameState';
import { tryLandAtCapturedPlanet } from '../../../src/game/mechanics/planet/landing';
import { createLandingStatusPort } from '../../../src/ui/adapters/landingStatusAdapter';
import { createRunStatusPort } from '../../../src/ui/adapters/runStatusAdapter';
import { mountLandingStatus } from '../../../src/ui/components/landingStatus';
import { mountRunStatus } from '../../../src/ui/components/runStatus';

const root = document.getElementById('app');
const canvas = root?.querySelector<HTMLCanvasElement>('#game-container canvas');
if (!root || !canvas) throw new Error('Application market harness root is incomplete.');
const seroton = initialGameState.planets.find(planet => planet.id === 'seroton');
if (!seroton) throw new Error('Seroton definition is missing.');
const state = {
    ...structuredClone(initialGameState),
    planetLifecycle: { capturedPlanetId: 'seroton', landedPlanetId: null, relandingLockedPlanetId: null },
    ship: { ...initialGameState.ship, position: { ...seroton.position } }
};
const provider = new GameStateProvider(state);
const events = new Events.EventEmitter();
const game = {
    canvas,
    registry: { get: (key: string): unknown => key === 'gameStateProvider' ? provider : undefined },
    scene: { isActive: (): boolean => true },
    events
} as unknown as Game;
const runStatus = mountRunStatus(root, createRunStatusPort(game));
const landingStatus = mountLandingStatus(root, createLandingStatusPort(game));

window.applicationMarketHarness = {
    land: (): void => { provider.update(current => tryLandAtCapturedPlanet(current, true)); },
    destroy: (): void => { landingStatus.destroy(); runStatus.destroy(); }
};

declare global {
    interface Window {
        applicationMarketHarness: { land(): void; destroy(): void };
    }
}
