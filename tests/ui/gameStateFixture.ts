import { expect, type Page } from '@playwright/test';
import { initialGameState } from '../../src/game/definitions/initialGameState';
import type { GameStateSnapshot } from '../../src/game/state/gameStateSnapshot';
import type { PlanetId } from '../../src/game/state/planetState';
import type { SerotonCommodityId } from '../../src/game/state/serotonMarketState';
import { setGameClockPlayerPaused } from '../../src/game/mechanics/clock/gameClock';
import { displayLabels } from '../../src/ui/components/displayLabels';

const storageKey = 'milky-way-trader:playwright-game-state';

export async function completeGameIntro (page: Page): Promise<void>
{
    const next = page.getByRole('button', { name: displayLabels.gameIntroNext, exact: true });
    for (let slide = 0; slide < 4; slide += 1) {
        await expect(next).toBeVisible();
        await next.click();
    }
    await page.getByRole('button', { name: displayLabels.gameIntroStart, exact: true }).click();
}

export interface GameStateFixtureOptions
{
    readonly credits?: number;
    readonly cargo?: readonly Readonly<{ commodityId: SerotonCommodityId; quantity: number; totalCost?: number }> [];
    readonly marketStock?: number;
    readonly marketCommodity?: SerotonCommodityId;
}

/** Start a deterministic run already landed on the selected planet. The full landing journey has a separate smoke test. */
export async function prepareGameState (page: Page, planet: PlanetId, options: GameStateFixtureOptions = {}, timingRecorder?: (name: string, durationMs: number) => void, testRunId?: string): Promise<void>
{
    const recordTiming = timingRecorder ?? (() => {});
    const targetPlanet = initialGameState.planets.find(candidate => candidate.id === planet);
    if (!targetPlanet) throw new Error(`Missing initial state for planet ${planet}.`);
    const state: Partial<GameStateSnapshot> = {
        ...(testRunId ? { runId: testRunId } : {}),
        credits: options.credits ?? 100_000,
        cargo: (options.cargo ?? []).map(stack => ({
            commodityId: stack.commodityId,
            quantity: stack.quantity,
            totalCost: stack.totalCost ?? 0
        })),
        markets: initialGameState.markets.map(market => ({
            ...market,
            facilities: market.facilities.map(facility => ({ ...facility, level: 0, status: 'notBuilt' as const })),
            commodityStocks: market.commodityStocks.map(stock => ({
                ...stock,
                stock: stock.commodityId === (options.marketCommodity ?? 'grain')
                    ? options.marketStock ?? 40
                    : stock.stock
            }))
        })),
        ship: { ...initialGameState.ship, position: targetPlanet.position },
        clock: setGameClockPlayerPaused(initialGameState.clock, true),
        planetLifecycle: { capturedPlanetId: planet, landedPlanetId: planet, relandingLockedPlanetId: null }
    };
    await measure('Navigate to application commit', recordTiming, () => page.goto('/', { waitUntil: 'commit' }).then(() => undefined));
    await measure('Install deterministic game-state fixture', recordTiming, () => page.evaluate(({ key, fixture }) => localStorage.setItem(key, JSON.stringify(fixture)), { key: storageKey, fixture: state }));
    await measure('New Game and run status readiness', recordTiming, async () => {
        await page.getByRole('button', { name: 'New Game', exact: true }).click();
        await completeGameIntro(page);
        await expect(page.getByLabel('Run status')).toBeVisible();
    });
    await measure('Validate prepared landed state', recordTiming, () => expect(page.getByRole('dialog', { name: 'Landed status' })).toBeVisible());
}

async function measure<T> (name: string, recordTiming: (name: string, durationMs: number) => void, action: () => Promise<T>): Promise<T>
{
    const startedAt = performance.now();
    const result = await action();
    recordTiming(name, performance.now() - startedAt);
    return result;
}
