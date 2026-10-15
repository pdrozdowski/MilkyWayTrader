import { expect, type Locator, type Page } from '@playwright/test';
import { displayLabels } from '../../src/ui/components/displayLabels';
import { resultLabels } from '../../src/game/application/results/resultLabels';
import type { GameStateFixtureOptions } from './gameStateFixture';
import { test } from './testSessionFixture';

const clockName = (state: typeof displayLabels.clockRunning | typeof displayLabels.clockPaused): RegExp => new RegExp(`^\\d{2}:\\d{2} · ${state}$`);

function runStatusClock (page: Page): ReturnType<Page['getByLabel']>
{
    return page.getByLabel('Run status').getByLabel(clockName(displayLabels.clockRunning));
}

type AsteroidCollisionOutcome = 'damaged' | 'terminal';

async function hitPoints (healthBar: Locator): Promise<number>
{
    return healthBar.evaluate(element => (element as HTMLProgressElement).value);
}

async function waitForAsteroidCollisionOutcome (
    runStatus: Locator, resultStatus: Locator, healthBar: Locator, hitPointsBefore: number, attempt: number
): Promise<AsteroidCollisionOutcome>
{
    let outcome: AsteroidCollisionOutcome | null = null;
    const collisionObserved = await expect.poll(async () => {
        if (!await runStatus.isVisible()) {
            outcome = 'terminal';
            return true;
        }
        if (await resultStatus.isVisible()) {
            outcome = 'terminal';
            return true;
        }
        if (await hitPoints(healthBar) < hitPointsBefore) {
            outcome = 'damaged';
            return true;
        }
        return false;
    }, {
        timeout: 5_000,
        intervals: [100, 250, 500],
        message: `Asteroid teleport attempt ${attempt} did not damage the ship or begin the terminal transition.`
    }).toBe(true).then(() => true).catch(() => false);
    if (!collisionObserved && (await resultStatus.isVisible() || !await runStatus.isVisible())) {
        return 'terminal';
    }
    if (!outcome) throw new Error(`Asteroid teleport attempt ${attempt} completed without a collision outcome.`);
    return outcome;
}

async function expectSavedDeathResult (runStatus: Locator, resultStatus: Locator): Promise<void>
{
    await expect(runStatus).toBeHidden();
    await expect(resultStatus).toBeVisible({ timeout: 10_000 });
    await expect(resultStatus).toContainText(resultLabels.saved);
}

async function startRun (page: Page): Promise<void>
{
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: 'New Game', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'New Game', exact: true }).click();
    await expect(page.getByLabel('Run status')).toBeVisible();
    await expect(runStatusClock(page)).toBeVisible();
}

test('an anonymous player can start a new game, pause from the menu, resume, and return to the main menu', async ({ page }) => {
    await startRun(page);

    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Game menu' })).toBeVisible();
    await expect(page.getByLabel(clockName(displayLabels.clockPaused))).toBeVisible();
    await page.getByRole('button', { name: 'Resume' }).click();
    await expect(page.getByRole('dialog', { name: 'Game menu' })).toBeHidden();
    await expect(runStatusClock(page)).toBeVisible();

    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    await page.getByRole('button', { name: 'Return to Main Menu' }).click();
    await expect(page.getByLabel('Main menu')).toBeVisible();
    await expect(page.getByLabel('Run status')).toBeHidden();
});

// Player-visible risk: normal New Game startup or real planet landing can fail, preventing a player from reaching planetary services.
// Lower-level tests cannot prove the Main Menu, Phaser controls, simulation landing transition, and DOM landing panel work together in Chromium.
// This uniquely preserves the complete New Game → Debug Menu teleport → simulated landing browser journey while trade tests use deterministic state bootstrap.
test('an anonymous player can start a new game and land on Seroton', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'New Game', exact: true }).click();
    await expect(page.getByLabel('Run status')).toBeVisible();
    await page.keyboard.press('d');
    await expect(page.getByRole('dialog', { name: 'Debug menu' })).toBeVisible();
    await page.getByRole('button', { name: 'Teleport to Seroton', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Landed status' })).toBeVisible();
});

test.describe('authenticated trading journey', () => {
    test.use({ testSessionMode: 'authenticated' });

    // Player-visible risk: a signed-in player must trade at each planet and see matching cargo, credits, and market stock.
    // Lower-level tests cannot prove authentication bootstrap, Phaser landing, DOM market controls, and HUD projection share the real UI trade result.
    // Each case uniquely verifies one accessible Buy or Sell operation on its real planetary market.
    const tradingCases: readonly (GameStateFixtureOptions & { readonly planet: 'seroton' | 'lactozis-7c' | 'maslo-prime'; readonly name: string; readonly direction: 'buy' | 'sell'; readonly initialQuantity: number })[] = [
        { planet: 'seroton', name: 'Seroton', direction: 'buy', initialQuantity: 0 },
        { planet: 'lactozis-7c', name: 'Lactozis-7C', direction: 'buy', initialQuantity: 0 },
        { planet: 'maslo-prime', name: 'Maslo-Prime', direction: 'buy', initialQuantity: 0 },
        { planet: 'seroton', name: 'Seroton', direction: 'sell', initialQuantity: 3 },
        { planet: 'lactozis-7c', name: 'Lactozis-7C', direction: 'sell', initialQuantity: 3 },
        { planet: 'maslo-prime', name: 'Maslo-Prime', direction: 'sell', initialQuantity: 3, marketStock: 40 }
    ] as const;

    for (const tradingCase of tradingCases) {
        test.describe(`${tradingCase.direction} grain at ${tradingCase.name}`, () => {
            test.use({ initialGameState: {
                planet: tradingCase.planet,
                credits: tradingCase.credits ?? 100_000,
                cargo: tradingCase.initialQuantity === 0 ? [] : [{ commodityId: 'grain', quantity: tradingCase.initialQuantity, totalCost: 3_000 }],
                marketCommodity: 'grain',
                marketStock: tradingCase.marketStock ?? 40
            } });
        test(`${tradingCase.direction === 'buy' ? 'buys' : 'sells'} grain at ${tradingCase.name} with updated cargo, cash, and stock`, async ({ page, testSession }) => {
            expect(testSession.mode).toBe('authenticated');
            const runStatus = page.getByLabel('Run status');
            const cash = runStatus.getByLabel('Credits', { exact: true });
            const cashBefore = await cash.innerText();
            const initialQuantity = tradingCase.initialQuantity;
            const startingStock = tradingCase.marketStock ?? 40;
            const direction = tradingCase.direction;
            const tradeQuantity = direction === 'buy' ? 2 : 1;
            const expectedQuantity = initialQuantity + (direction === 'buy' ? tradeQuantity : -tradeQuantity);
            const expectedStock = startingStock + (direction === 'buy' ? -tradeQuantity : tradeQuantity);

            const stepTimings: { name: string; durationMs: number }[] = [];
            const measureStep = async (name: string, action: () => Promise<void>): Promise<void> => {
                const startedAt = performance.now();
                await test.step(name, action);
                stepTimings.push({ name, durationMs: performance.now() - startedAt });
            };

            await measureStep('Open market and select grain', async () => {
                await page.getByRole('button', { name: 'Market', exact: true }).click();
                await page.getByRole('button', { name: /^Grain/ }).click();
            });
            const quantity = page.getByRole('slider');
            const stockBar = page.getByRole('progressbar', { name: 'Planet stock: Grain' });
            await measureStep('Set trade quantity and verify quote', async () => {
                await expect(quantity).toBeVisible();
                for (let unit = 0; unit < tradeQuantity; unit += 1) await quantity.press(direction === 'buy' ? 'ArrowRight' : 'ArrowLeft');
                await expect(page.getByText(direction === 'buy' ? '+2 BUY' : '1 SELL', { exact: true })).toBeVisible();
                await expect(stockBar).toHaveAttribute('aria-valuenow', String(expectedStock));
            });
            const confirmTrade = page.getByRole('button', { name: /^CONFIRM TRADE:/ });
            await expect(confirmTrade).toBeEnabled();
            await measureStep('Confirm trade and verify updated cargo, credits, and stock', async () => {
                await confirmTrade.click();
                await expect(cash).not.toHaveText(cashBefore);
                await expect(page.getByRole('region', { name: 'Ship inventory' }).getByText(`${expectedQuantity} (0)`, { exact: true })).toBeVisible();
                await expect(stockBar).toHaveAttribute('aria-valuenow', String(expectedStock));
            });
            console.log(`Trading step timings: ${JSON.stringify(stepTimings)}`);
        });
        });
    }

    // Player-visible risk: the accessible debug control could fail to route through Phaser, leaving a signed-in player unable to die, see the final result, or retain it.
    // Lower-level tests cannot prove browser input, Phaser event routing, DOM HP projection, the timed scene transition, and authenticated local Supabase persistence together.
    // This uniquely verifies that an accessible browser control drives all of those real boundaries without direct state mutation.
    test('a signed-in player reaches a retained death result through bounded live-asteroid collisions', async ({ page, testSession }) => {
        expect(testSession.mode).toBe('authenticated');
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await page.getByRole('button', { name: 'New Game', exact: true }).click();
        const runStatus = page.getByLabel('Run status');
        await expect(runStatus).toBeVisible();
        const healthBar = runStatus.getByRole('progressbar', { name: /HP/ });
        await expect(healthBar).toBeVisible();

        const resultStatus = page.getByLabel('Result delivery status');
        const finishIfTerminal = async (): Promise<boolean> => {
            if (!await resultStatus.isVisible() && await runStatus.isVisible()) return false;
            await expectSavedDeathResult(runStatus, resultStatus);
            return true;
        };
        for (let attempt = 1; attempt <= 7; attempt += 1) {
            if (await finishIfTerminal()) return;
            await expect(runStatus).toBeVisible();
            const hitPointsBefore = await hitPoints(healthBar);
            if (hitPointsBefore === 0) {
                await expectSavedDeathResult(runStatus, resultStatus);
                return;
            }

            await page.keyboard.press('d');
            const debugMenu = page.getByRole('dialog', { name: 'Debug menu' });
            try {
                await expect(debugMenu).toBeVisible({ timeout: 2_000 });
            } catch (error) {
                if (await finishIfTerminal()) return;
                throw error;
            }
            try {
                await page.getByRole('button', { name: displayLabels.teleportToAsteroid, exact: true }).click({ timeout: 2_000 });
            } catch (error) {
                if (await finishIfTerminal()) return;
                throw error;
            }

            if (await waitForAsteroidCollisionOutcome(runStatus, resultStatus, healthBar, hitPointsBefore, attempt) === 'terminal') {
                await expectSavedDeathResult(runStatus, resultStatus);
                return;
            }
        }
        throw new Error('Expected HP to reach zero within seven confirmed big-asteroid collisions.');
    });
});
