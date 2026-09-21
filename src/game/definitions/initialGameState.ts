import type { GameStateSnapshot } from '../state/gameStateSnapshot';
import { initialCredits, maximumShipHitPoints } from './runBalance.ts';

export const ACTIVE_TIME_BUDGET_MS = 30 * 60 * 1000;

export const initialGameState: GameStateSnapshot = {
    schemaVersion: 3,
    clock: {
        budgetMs: ACTIVE_TIME_BUDGET_MS,
        activeElapsedMs: 0,
        pauseReasons: []
    },
    credits: initialCredits,
    cargo: [],
    ship: {
        position: { x: 1950, y: 600 },
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
    planets: [
        { id: 'seroton', name: 'Seroton', position: { x: 2300, y: 200 }, radius: 144 },
        { id: 'lactozis-7c', name: 'Lactozis-7C', position: { x: -1900, y: 900 }, radius: 240 },
        { id: 'maslo-prime', name: 'Maslo-Prime', position: { x: 600, y: 2100 }, radius: 330 }
    ],
    weapon: {
        nextShotAtMs: null,
        lastShotAtMs: null,
        projectileSequence: 0
    },
    projectiles: []
};
