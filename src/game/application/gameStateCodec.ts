import type { GamePauseReason } from '../state/gameClockState';
import type { GameStateSnapshot } from '../state/gameStateSnapshot';
import { maximumShipHitPoints } from '../domain/runBalance.ts';

const PAUSE_REASONS: readonly GamePauseReason[] = ['background', 'landed', 'manual', 'menu'];
const keys = (value: object): string[] => Object.keys(value).sort();

function isRecord (value: unknown): value is Record<string, unknown>
{
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireRecord (value: unknown, path: string, expectedKeys: readonly string[]): Record<string, unknown>
{
    if (!isRecord(value)) throw new Error(`${path} must be an object.`);
    if (keys(value).join('|') !== [...expectedKeys].sort().join('|')) throw new Error(`${path} has unexpected or missing fields.`);
    return value;
}

function finiteNumber (value: unknown, path: string): number
{
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${path} must be a finite number.`);
    return value;
}

function nonNegativeNumber (value: unknown, path: string): number
{
    const number = finiteNumber(value, path);
    if (number < 0) throw new Error(`${path} must not be negative.`);
    return number;
}

function nonNegativeSafeInteger (value: unknown, path: string): number
{
    const number = nonNegativeNumber(value, path);
    if (!Number.isSafeInteger(number)) throw new Error(`${path} must be a safe integer.`);
    return number;
}

function positiveSafeInteger (value: unknown, path: string): number
{
    const number = nonNegativeSafeInteger(value, path);
    if (number === 0) throw new Error(`${path} must be positive.`);
    return number;
}

function nonEmptyString (value: unknown, path: string): string
{
    if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${path} must be a non-empty string.`);
    return value;
}

function nullableTime (value: unknown, path: string): number | null
{
    return value === null ? null : nonNegativeNumber(value, path);
}

function vector2 (value: unknown, path: string): Readonly<{ x: number; y: number }>
{
    const vector = requireRecord(value, path, ['x', 'y']);
    return { x: finiteNumber(vector.x, `${path}.x`), y: finiteNumber(vector.y, `${path}.y`) };
}

function cloneAndFreeze<T> (value: T): T
{
    if (Array.isArray(value)) {
        for (const item of value) cloneAndFreeze(item);
        return Object.freeze(value) as T;
    }
    if (isRecord(value)) {
        for (const item of Object.values(value)) cloneAndFreeze(item);
        return Object.freeze(value) as T;
    }
    return value;
}

export function decodeGameState (candidate: unknown): GameStateSnapshot
{
    let source = candidate;
    if (typeof source === 'string') {
        try { source = JSON.parse(source) as unknown; }
        catch { throw new Error('Game state is not valid JSON.'); }
    }
    const root = requireRecord(source, 'state', ['schemaVersion', 'clock', 'credits', 'cargo', 'ship', 'shipStatus', 'planets', 'weapon', 'projectiles']);
    if (root.schemaVersion !== 3) throw new Error('Unsupported game-state schema version.');

    const credits = nonNegativeSafeInteger(root.credits, 'state.credits');
    if (!Array.isArray(root.cargo)) throw new Error('state.cargo must be an array.');
    const commodityIds = new Set<string>();
    const cargo = root.cargo.map((candidateCargo, index) => {
        const path = `state.cargo[${index}]`;
        const stack = requireRecord(candidateCargo, path, ['commodityId', 'quantity']);
        const commodityId = nonEmptyString(stack.commodityId, `${path}.commodityId`);
        if (commodityIds.has(commodityId)) throw new Error(`Duplicate commodity id: ${commodityId}.`);
        commodityIds.add(commodityId);
        return { commodityId, quantity: nonNegativeSafeInteger(stack.quantity, `${path}.quantity`) };
    });

    const clock = requireRecord(root.clock, 'state.clock', ['budgetMs', 'activeElapsedMs', 'pauseReasons']);
    const budgetMs = nonNegativeNumber(clock.budgetMs, 'state.clock.budgetMs');
    if (budgetMs === 0) throw new Error('state.clock.budgetMs must be positive.');
    const activeElapsedMs = nonNegativeNumber(clock.activeElapsedMs, 'state.clock.activeElapsedMs');
    if (activeElapsedMs > budgetMs) throw new Error('state.clock.activeElapsedMs exceeds its budget.');
    if (!Array.isArray(clock.pauseReasons)) throw new Error('state.clock.pauseReasons must be an array.');
    const pauseReasons = clock.pauseReasons.map((reason, index) => {
        if (typeof reason !== 'string' || !PAUSE_REASONS.includes(reason as GamePauseReason)) {
            throw new Error(`state.clock.pauseReasons[${index}] is unknown.`);
        }
        return reason as GamePauseReason;
    });
    if (new Set(pauseReasons).size !== pauseReasons.length) throw new Error('state.clock.pauseReasons contains duplicates.');

    const ship = requireRecord(root.ship, 'state.ship', [
        'position', 'velocity', 'rotation', 'enginesOn', 'boosting', 'boostAcceleration', 'coastDeceleration'
    ]);
    if (typeof ship.enginesOn !== 'boolean' || typeof ship.boosting !== 'boolean') throw new Error('Ship activity flags must be boolean.');

    const shipStatus = requireRecord(root.shipStatus, 'state.shipStatus', [
        'currentHitPoints', 'cargoLevel', 'engineLevel', 'weaponLevel', 'boosterUnlocked'
    ]);
    const currentHitPoints = nonNegativeSafeInteger(shipStatus.currentHitPoints, 'state.shipStatus.currentHitPoints');
    if (currentHitPoints > maximumShipHitPoints) throw new Error('state.shipStatus.currentHitPoints exceeds the configured maximum.');
    if (typeof shipStatus.boosterUnlocked !== 'boolean') throw new Error('state.shipStatus.boosterUnlocked must be boolean.');
    if (!shipStatus.boosterUnlocked && ship.boosting) throw new Error('state.ship.boosting requires an unlocked booster.');

    if (!Array.isArray(root.planets)) throw new Error('state.planets must be an array.');
    const planetIds = new Set<string>();
    const planets = root.planets.map((candidatePlanet, index) => {
        const path = `state.planets[${index}]`;
        const planet = requireRecord(candidatePlanet, path, ['id', 'name', 'position', 'radius']);
        const id = nonEmptyString(planet.id, `${path}.id`);
        if (planetIds.has(id)) throw new Error(`Duplicate planet id: ${id}.`);
        planetIds.add(id);
        const radius = nonNegativeNumber(planet.radius, `${path}.radius`);
        if (radius === 0) throw new Error(`${path}.radius must be positive.`);
        return { id, name: nonEmptyString(planet.name, `${path}.name`), position: vector2(planet.position, `${path}.position`), radius };
    });

    const weapon = requireRecord(root.weapon, 'state.weapon', ['nextShotAtMs', 'lastShotAtMs', 'projectileSequence']);
    const projectileSequence = nonNegativeNumber(weapon.projectileSequence, 'state.weapon.projectileSequence');
    if (!Number.isInteger(projectileSequence)) throw new Error('state.weapon.projectileSequence must be an integer.');

    if (!Array.isArray(root.projectiles)) throw new Error('state.projectiles must be an array.');
    const projectileIds = new Set<string>();
    const projectiles = root.projectiles.map((candidateProjectile, index) => {
        const path = `state.projectiles[${index}]`;
        const projectile = requireRecord(candidateProjectile, path, ['id', 'position', 'velocity', 'bornAtActiveMs']);
        const id = nonEmptyString(projectile.id, `${path}.id`);
        if (projectileIds.has(id)) throw new Error(`Duplicate projectile id: ${id}.`);
        projectileIds.add(id);
        return {
            id,
            position: vector2(projectile.position, `${path}.position`),
            velocity: vector2(projectile.velocity, `${path}.velocity`),
            bornAtActiveMs: nonNegativeNumber(projectile.bornAtActiveMs, `${path}.bornAtActiveMs`)
        };
    });

    return cloneAndFreeze({
        schemaVersion: 3,
        clock: { budgetMs, activeElapsedMs, pauseReasons },
        credits,
        cargo,
        ship: {
            position: vector2(ship.position, 'state.ship.position'),
            velocity: vector2(ship.velocity, 'state.ship.velocity'),
            rotation: finiteNumber(ship.rotation, 'state.ship.rotation'),
            enginesOn: ship.enginesOn,
            boosting: ship.boosting,
            boostAcceleration: nonNegativeNumber(ship.boostAcceleration, 'state.ship.boostAcceleration'),
            coastDeceleration: nonNegativeNumber(ship.coastDeceleration, 'state.ship.coastDeceleration')
        },
        shipStatus: {
            currentHitPoints,
            cargoLevel: positiveSafeInteger(shipStatus.cargoLevel, 'state.shipStatus.cargoLevel'),
            engineLevel: positiveSafeInteger(shipStatus.engineLevel, 'state.shipStatus.engineLevel'),
            weaponLevel: positiveSafeInteger(shipStatus.weaponLevel, 'state.shipStatus.weaponLevel'),
            boosterUnlocked: shipStatus.boosterUnlocked
        },
        planets,
        weapon: {
            nextShotAtMs: nullableTime(weapon.nextShotAtMs, 'state.weapon.nextShotAtMs'),
            lastShotAtMs: nullableTime(weapon.lastShotAtMs, 'state.weapon.lastShotAtMs'),
            projectileSequence
        },
        projectiles
    });
}

export function encodeGameState (snapshot: GameStateSnapshot): string
{
    return JSON.stringify(decodeGameState(snapshot));
}
