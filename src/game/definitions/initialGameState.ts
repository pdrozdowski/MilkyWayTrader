import type { GameStateSnapshot } from '../state/gameStateSnapshot';
import { initialCredits, maximumShipHitPoints } from '../domain/runBalance.ts';
import { planetDefinitions } from './planetDefinitions.ts';
import { projectPlanetPosition } from '../mechanics/planet/orbit.ts';
import { serotonCommodityDefinitions } from './serotonMarketDefinitions.ts';

export const ACTIVE_TIME_BUDGET_MS = 30 * 60 * 1000;

export const initialGameState: GameStateSnapshot = {
    schemaVersion: 6,
    clock: {
        budgetMs: ACTIVE_TIME_BUDGET_MS,
        activeElapsedMs: 0,
        pauseReasons: []
    },
    credits: initialCredits,
    cargo: [],
    markets: [{
        planetId: 'seroton',
        commodityStocks: serotonCommodityDefinitions.map(definition => ({ commodityId: definition.id, stock: definition.initialStock }))
    }],
    ship: {
        position: { x: 0, y: -planetDefinitions[0].orbitRadius },
        velocity: { x: 0, y: 0 },
        rotation: 0,
        enginesOn: false,
        boosting: false,
        boostAcceleration: 0,
        coastDeceleration: 480
    },
    shipStatus: {
        currentHitPoints: maximumShipHitPoints,
        cargoLevel: 1,
        engineLevel: 1,
        weaponLevel: 1,
        boosterUnlocked: false
    },
    planets: planetDefinitions.map(definition => ({
        id: definition.id,
        name: definition.name,
        position: projectPlanetPosition(definition.id, 0),
        radius: definition.radius
    })),
    planetLifecycle: {
        capturedPlanetId: null,
        landedPlanetId: null,
        relandingLockedPlanetId: null
    },
    weapon: {
        nextShotAtMs: null,
        lastShotAtMs: null,
        projectileSequence: 0
    },
    projectiles: []
};
