import type { GamePauseReason } from '../state/gameClockState';
import type { GameStateSnapshot } from '../state/gameStateSnapshot';
import type { PlanetId } from '../state/planetState';
import type { SerotonCommodityId } from '../state/serotonMarketState';
import type { AsteroidSize, AsteroidVariant } from '../state/asteroidState';
import { maximumShipHitPoints, orbitalCargoCapacity } from '../domain/runBalance.ts';
import { planetIds } from '../domain/planetCatalog.ts';
import { serotonCommodityIds } from '../domain/serotonMarketCatalog.ts';

const asteroidMaximumHitPoints: Readonly<Record<AsteroidSize, number>> = { big: 3, medium: 2, small: 1 };

const PAUSE_REASONS: readonly GamePauseReason[] = ['background', 'landed', 'manual', 'menu', 'orientation'];
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

function runId (value: unknown, path: string): string
{
    const id = nonEmptyString(value, path);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
        throw new Error(`${path} must be a UUID.`);
    }
    return id;
}

function uint32 (value: unknown, path: string): number
{
    const number = nonNegativeSafeInteger(value, path);
    if (number > 0xFFFFFFFF) throw new Error(`${path} must be a uint32.`);
    return number;
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
    const root = requireRecord(source, 'state', ['schemaVersion', 'runId', 'randomState', 'cargoSchedule', 'moolarisDamageArmed', 'terminalResult', 'clock', 'credits', 'cargo', 'orbitalCargo', 'looseItems', 'markets', 'ship', 'shipStatus', 'planets', 'planetLifecycle', 'weapon', 'projectiles', 'asteroids']);
    if (root.schemaVersion !== 16) throw new Error('Unsupported game-state schema version.');
    const decodedRunId = runId(root.runId, 'state.runId');
    const randomState = uint32(root.randomState, 'state.randomState');
    if (!Array.isArray(root.cargoSchedule) || root.cargoSchedule.length > 5) {
        throw new Error('state.cargoSchedule must be an unconsumed binary cargo schedule.');
    }
    let cargoMarkers = 0;
    for (let index = 0; index < root.cargoSchedule.length; index++) {
        const entry = root.cargoSchedule[index];
        if (entry !== 0 && entry !== 1) throw new Error('state.cargoSchedule must be an unconsumed binary cargo schedule.');
        if (entry === 1) cargoMarkers++;
    }
    if (cargoMarkers > 1 || root.cargoSchedule.length === 5 && cargoMarkers !== 1) throw new Error('state.cargoSchedule must contain exactly one cargo marker when full.');
    const cargoSchedule = root.cargoSchedule as readonly (0 | 1)[];
    if (typeof root.moolarisDamageArmed !== 'boolean') throw new Error('state.moolarisDamageArmed must be boolean.');

    const credits = nonNegativeSafeInteger(root.credits, 'state.credits');
    if (!Array.isArray(root.cargo)) throw new Error('state.cargo must be an array.');
    const commodityIds = new Set<string>();
    const decodeContainer = (candidateContainer: unknown, path: string) => {
        const container = requireRecord(candidateContainer, path, ['commodityId', 'quantity', 'totalCost']);
        const commodityId = nonEmptyString(container.commodityId, `${path}.commodityId`);
        const quantity = nonNegativeSafeInteger(container.quantity, `${path}.quantity`);
        const totalCost = nonNegativeNumber(container.totalCost, `${path}.totalCost`);
        if (quantity === 0 && totalCost !== 0) throw new Error(`${path}.totalCost must be zero for an empty container.`);
        return { commodityId, quantity, totalCost };
    };
    const decodePositiveContainer = (candidateContainer: unknown, path: string) => {
        const container = requireRecord(candidateContainer, path, ['commodityId', 'quantity', 'totalCost']);
        const commodityId = nonEmptyString(container.commodityId, `${path}.commodityId`);
        if (!(serotonCommodityIds as readonly string[]).includes(commodityId)) throw new Error(`${path}.commodityId is unknown.`);
        const quantity = positiveSafeInteger(container.quantity, `${path}.quantity`);
        const totalCost = nonNegativeNumber(container.totalCost, `${path}.totalCost`);
        return { commodityId, quantity, totalCost };
    };
    const cargo = root.cargo.map((candidateCargo, index) => {
        const path = `state.cargo[${index}]`;
        const container = decodeContainer(candidateCargo, path);
        const commodityId = container.commodityId;
        if (commodityIds.has(commodityId)) throw new Error(`Duplicate commodity id: ${commodityId}.`);
        commodityIds.add(commodityId);
        return container;
    });
    if (!Array.isArray(root.orbitalCargo)) throw new Error('state.orbitalCargo must be an array.');
    const orbitalCargoIds = new Set<string>();
    const orbitalCargo = root.orbitalCargo.map((candidateCargo, index) => {
        const path = `state.orbitalCargo[${index}]`;
        const cargo = requireRecord(candidateCargo, path, ['id', 'position', 'orbit', 'hitPoints', 'manifest']);
        const id = nonEmptyString(cargo.id, `${path}.id`);
        if (orbitalCargoIds.has(id)) throw new Error(`Duplicate orbital cargo id: ${id}.`);
        orbitalCargoIds.add(id);
        const orbit = requireRecord(cargo.orbit, `${path}.orbit`, ['angleRadians', 'radius', 'rotationRadians']);
        const radius = nonNegativeNumber(orbit.radius, `${path}.orbit.radius`);
        if (radius === 0) throw new Error(`${path}.orbit.radius must be positive.`);
        const hitPoints = positiveSafeInteger(cargo.hitPoints, `${path}.hitPoints`);
        if (hitPoints > 2) throw new Error(`${path}.hitPoints exceeds configured durability.`);
        if (!Array.isArray(cargo.manifest)) throw new Error(`${path}.manifest must be an array.`);
        if (cargo.manifest.length === 0) throw new Error(`${path}.manifest must not be empty.`);
        const manifestCommodityIds = new Set<string>();
        let manifestQuantity = 0;
        const manifest = cargo.manifest.map((candidateStack, stackIndex) => {
            const stackPath = `${path}.manifest[${stackIndex}]`;
            const stack = decodePositiveContainer(candidateStack, stackPath);
            if (manifestCommodityIds.has(stack.commodityId)) throw new Error(`Duplicate orbital commodity id: ${stack.commodityId}.`);
            manifestCommodityIds.add(stack.commodityId);
            manifestQuantity += stack.quantity;
            return stack;
        });
        if (manifestQuantity > orbitalCargoCapacity) throw new Error(`${path}.manifest exceeds the orbital cargo capacity.`);
        return {
            id,
            position: vector2(cargo.position, `${path}.position`),
            orbit: { angleRadians: finiteNumber(orbit.angleRadians, `${path}.orbit.angleRadians`), radius, rotationRadians: finiteNumber(orbit.rotationRadians, `${path}.orbit.rotationRadians`) },
            hitPoints,
            manifest
        };
    });
    if (!Array.isArray(root.looseItems)) throw new Error('state.looseItems must be an array.');
    const looseItemIds = new Set<string>();
    const looseItems = root.looseItems.map((candidateItem, index) => {
        const path = `state.looseItems[${index}]`;
        const item = requireRecord(candidateItem, path, ['id', 'position', 'motion', 'container']);
        const id = nonEmptyString(item.id, `${path}.id`);
        if (looseItemIds.has(id) || orbitalCargoIds.has(id)) throw new Error(`Duplicate salvage id: ${id}.`);
        looseItemIds.add(id);
        const motion = requireRecord(item.motion, `${path}.motion`, ['ejectionVelocity', 'sunVelocity', 'createdAtActiveMs']);
        const container = decodeContainer(item.container, `${path}.container`);
        if (container.quantity !== 1) throw new Error(`${path}.container.quantity must be one.`);
        return {
            id,
            position: vector2(item.position, `${path}.position`),
            motion: {
                ejectionVelocity: vector2(motion.ejectionVelocity, `${path}.motion.ejectionVelocity`),
                sunVelocity: vector2(motion.sunVelocity, `${path}.motion.sunVelocity`),
                createdAtActiveMs: nonNegativeNumber(motion.createdAtActiveMs, `${path}.motion.createdAtActiveMs`)
            },
            container
        };
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
        'position', 'velocity', 'rotation', 'enginesOn', 'boosting', 'boostAcceleration', 'coastDeceleration', 'asteroidControlLockedUntilActiveMs', 'asteroidImpactAtActiveMs'
    ]);
    if (typeof ship.enginesOn !== 'boolean' || typeof ship.boosting !== 'boolean') throw new Error('Ship activity flags must be boolean.');

    const shipStatus = requireRecord(root.shipStatus, 'state.shipStatus', [
        'currentHitPoints', 'cargoLevel', 'engineLevel', 'weaponLevel', 'boosterUnlocked'
    ]);
    const currentHitPoints = nonNegativeSafeInteger(shipStatus.currentHitPoints, 'state.shipStatus.currentHitPoints');
    if (currentHitPoints > maximumShipHitPoints) throw new Error('state.shipStatus.currentHitPoints exceeds the configured maximum.');
    if (typeof shipStatus.boosterUnlocked !== 'boolean') throw new Error('state.shipStatus.boosterUnlocked must be boolean.');
    if (!shipStatus.boosterUnlocked && ship.boosting) throw new Error('state.ship.boosting requires an unlocked booster.');
    const terminalResult = root.terminalResult === null ? null : requireRecord(root.terminalResult, 'state.terminalResult', ['runId', 'outcome', 'activeElapsedMs', 'finalCredits']);
    if (terminalResult === null && currentHitPoints === 0) throw new Error('Zero hit points requires a terminal result.');
    if (terminalResult !== null && currentHitPoints !== 0) throw new Error('A terminal result requires zero hit points.');
    if (terminalResult !== null) {
        if (runId(terminalResult.runId, 'state.terminalResult.runId') !== decodedRunId) throw new Error('Terminal result run id must match the run.');
        if (terminalResult.outcome !== 'death') throw new Error('state.terminalResult.outcome is unknown.');
        if (nonNegativeSafeInteger(terminalResult.activeElapsedMs, 'state.terminalResult.activeElapsedMs') !== Math.floor(activeElapsedMs)) throw new Error('Terminal result active time must be the clock rounded down to milliseconds.');
        if (nonNegativeSafeInteger(terminalResult.finalCredits, 'state.terminalResult.finalCredits') !== credits) throw new Error('Terminal result credits must match the run.');
    }

    if (!Array.isArray(root.planets)) throw new Error('state.planets must be an array.');
    const configuredPlanetIds = new Set<string>(planetIds);
    const seenPlanetIds = new Set<string>();
    const planets = root.planets.map((candidatePlanet, index) => {
        const path = `state.planets[${index}]`;
        const planet = requireRecord(candidatePlanet, path, ['id', 'name', 'position', 'radius']);
        const id = nonEmptyString(planet.id, `${path}.id`);
        if (!configuredPlanetIds.has(id)) throw new Error(`${path}.id is not a configured planet.`);
        if (seenPlanetIds.has(id)) throw new Error(`Duplicate planet id: ${id}.`);
        seenPlanetIds.add(id);
        const radius = nonNegativeNumber(planet.radius, `${path}.radius`);
        if (radius === 0) throw new Error(`${path}.radius must be positive.`);
        return { id, name: nonEmptyString(planet.name, `${path}.name`), position: vector2(planet.position, `${path}.position`), radius };
    });

    if (!Array.isArray(root.markets)) throw new Error('state.markets must be an array.');
    const marketPlanetIds = new Set<string>();
    const markets = root.markets.map((candidateMarket, index) => {
        const marketPath = `state.markets[${index}]`;
        const market = requireRecord(candidateMarket, marketPath, ['planetId', 'commodityStocks']);
        const planetId = nonEmptyString(market.planetId, `${marketPath}.planetId`);
        if (!configuredPlanetIds.has(planetId)) throw new Error(`${marketPath}.planetId is not a configured planet.`);
        if (marketPlanetIds.has(planetId)) throw new Error(`Duplicate market planet id: ${planetId}.`);
        marketPlanetIds.add(planetId);
        if (!Array.isArray(market.commodityStocks) || market.commodityStocks.length !== serotonCommodityIds.length) {
            throw new Error(`${marketPath}.commodityStocks must contain every configured commodity.`);
        }
        const expectedCommodityIds = new Set<string>(serotonCommodityIds);
        const seenCommodityIds = new Set<string>();
        const commodityStocks = market.commodityStocks.map((candidateStock, stockIndex) => {
            const stockPath = `${marketPath}.commodityStocks[${stockIndex}]`;
            const stock = requireRecord(candidateStock, stockPath, ['commodityId', 'stock']);
            if (typeof stock.commodityId !== 'string' || !expectedCommodityIds.has(stock.commodityId)) {
                throw new Error(`${stockPath}.commodityId is not a configured commodity.`);
            }
            if (seenCommodityIds.has(stock.commodityId)) throw new Error(`Duplicate commodity id: ${stock.commodityId}.`);
            seenCommodityIds.add(stock.commodityId);
            return { commodityId: stock.commodityId as SerotonCommodityId, stock: nonNegativeSafeInteger(stock.stock, `${stockPath}.stock`) };
        });
        if (seenCommodityIds.size !== expectedCommodityIds.size) throw new Error(`${marketPath}.commodityStocks is missing a configured commodity.`);
        return { planetId: planetId as PlanetId, commodityStocks };
    });
    if (marketPlanetIds.size !== configuredPlanetIds.size) throw new Error('state.markets must contain exactly one market for every configured planet.');
    if (planets.length !== configuredPlanetIds.size) throw new Error('state.planets must contain exactly the configured planets.');

    const lifecycle = requireRecord(root.planetLifecycle, 'state.planetLifecycle', ['capturedPlanetId', 'landedPlanetId', 'relandingLockedPlanetId']);
    const planetIdentity = (value: unknown, path: string): string | null => {
        if (value === null) return null;
        const id = nonEmptyString(value, path);
        if (!configuredPlanetIds.has(id)) throw new Error(`${path} must identify a configured planet.`);
        return id;
    };
    const capturedPlanetId = planetIdentity(lifecycle.capturedPlanetId, 'state.planetLifecycle.capturedPlanetId');
    const landedPlanetId = planetIdentity(lifecycle.landedPlanetId, 'state.planetLifecycle.landedPlanetId');
    const relandingLockedPlanetId = planetIdentity(lifecycle.relandingLockedPlanetId, 'state.planetLifecycle.relandingLockedPlanetId');
    if (landedPlanetId !== null && landedPlanetId !== capturedPlanetId) throw new Error('A landed planet must be captured.');
    if (landedPlanetId !== null && !pauseReasons.includes('landed')) throw new Error('A landed planet requires the landed pause reason.');
    if (landedPlanetId === null && pauseReasons.includes('landed')) throw new Error('The landed pause reason requires a landed planet.');
    if (relandingLockedPlanetId !== null && relandingLockedPlanetId === landedPlanetId) {
        throw new Error('A relanding lock cannot coexist with landing for that planet.');
    }

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

    if (!Array.isArray(root.asteroids)) throw new Error('state.asteroids must be an array.');
    const asteroidIds = new Set<string>();
    const asteroidVariants: readonly AsteroidVariant[] = ['rock', 'ice', 'metal', 'dirt'];
    const asteroidSizes: readonly AsteroidSize[] = ['big', 'medium', 'small'];
    const asteroids = root.asteroids.map((candidateAsteroid, index) => {
        const path = `state.asteroids[${index}]`;
        const asteroid = requireRecord(candidateAsteroid, path, ['id', 'variant', 'size', 'hitPoints', 'position', 'velocity', 'orbit', 'outsideSafeAreaSinceActiveMs']);
        const id = nonEmptyString(asteroid.id, `${path}.id`);
        if (asteroidIds.has(id)) throw new Error(`Duplicate asteroid id: ${id}.`);
        asteroidIds.add(id);
        if (typeof asteroid.variant !== 'string' || !asteroidVariants.includes(asteroid.variant as AsteroidVariant)) {
            throw new Error(`${path}.variant is unknown.`);
        }
        if (typeof asteroid.size !== 'string' || !asteroidSizes.includes(asteroid.size as AsteroidSize)) {
            throw new Error(`${path}.size is unknown.`);
        }
        const size = asteroid.size as AsteroidSize;
        const hitPoints = positiveSafeInteger(asteroid.hitPoints, `${path}.hitPoints`);
        if (hitPoints > asteroidMaximumHitPoints[size]) throw new Error(`${path}.hitPoints exceeds configured durability.`);
        const orbit = asteroid.orbit === null ? null : requireRecord(asteroid.orbit, `${path}.orbit`, ['angleRadians', 'radius', 'rotationRadians']);
        const radius = orbit === null ? null : nonNegativeNumber(orbit.radius, `${path}.orbit.radius`);
        if (radius === 0) throw new Error(`${path}.orbit.radius must be positive.`);
        return {
            id,
            variant: asteroid.variant as AsteroidVariant,
            size,
            hitPoints,
            position: vector2(asteroid.position, `${path}.position`),
            velocity: vector2(asteroid.velocity, `${path}.velocity`),
            orbit: orbit === null ? null : {
                angleRadians: finiteNumber(orbit.angleRadians, `${path}.orbit.angleRadians`),
                radius: radius as number,
                rotationRadians: finiteNumber(orbit.rotationRadians, `${path}.orbit.rotationRadians`)
            },
            outsideSafeAreaSinceActiveMs: nullableTime(asteroid.outsideSafeAreaSinceActiveMs, `${path}.outsideSafeAreaSinceActiveMs`)
        };
    });

    return cloneAndFreeze({
        schemaVersion: 16,
        runId: decodedRunId,
        randomState,
        cargoSchedule,
        moolarisDamageArmed: root.moolarisDamageArmed,
        terminalResult: terminalResult === null ? null : {
            runId: decodedRunId,
            outcome: 'death',
            activeElapsedMs: Math.floor(activeElapsedMs),
            finalCredits: credits
        },
        clock: { budgetMs, activeElapsedMs, pauseReasons },
        credits,
        cargo,
        orbitalCargo,
        looseItems,
        markets,
        ship: {
            position: vector2(ship.position, 'state.ship.position'),
            velocity: vector2(ship.velocity, 'state.ship.velocity'),
            rotation: finiteNumber(ship.rotation, 'state.ship.rotation'),
            enginesOn: ship.enginesOn,
            boosting: ship.boosting,
            boostAcceleration: nonNegativeNumber(ship.boostAcceleration, 'state.ship.boostAcceleration'),
            coastDeceleration: nonNegativeNumber(ship.coastDeceleration, 'state.ship.coastDeceleration'),
            asteroidControlLockedUntilActiveMs: nullableTime(ship.asteroidControlLockedUntilActiveMs, 'state.ship.asteroidControlLockedUntilActiveMs'),
            asteroidImpactAtActiveMs: nullableTime(ship.asteroidImpactAtActiveMs, 'state.ship.asteroidImpactAtActiveMs')
        },
        shipStatus: {
            currentHitPoints,
            cargoLevel: positiveSafeInteger(shipStatus.cargoLevel, 'state.shipStatus.cargoLevel'),
            engineLevel: positiveSafeInteger(shipStatus.engineLevel, 'state.shipStatus.engineLevel'),
            weaponLevel: positiveSafeInteger(shipStatus.weaponLevel, 'state.shipStatus.weaponLevel'),
            boosterUnlocked: shipStatus.boosterUnlocked
        },
        planets,
        planetLifecycle: { capturedPlanetId, landedPlanetId, relandingLockedPlanetId },
        weapon: {
            nextShotAtMs: nullableTime(weapon.nextShotAtMs, 'state.weapon.nextShotAtMs'),
            lastShotAtMs: nullableTime(weapon.lastShotAtMs, 'state.weapon.lastShotAtMs'),
            projectileSequence
        },
        projectiles,
        asteroids
    });
}

export function encodeGameState (snapshot: GameStateSnapshot): string
{
    return JSON.stringify(decodeGameState(snapshot));
}
