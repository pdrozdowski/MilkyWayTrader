import { expect, type Locator, type Page } from '@playwright/test';
import { displayLabels } from '../../src/ui/components/displayLabels';
import { resultLabels } from '../../src/game/application/results/resultLabels';
import { test } from './testSessionFixture';
import { completeSignedInTradeJourney } from './tradingJourney';

const clockName = (state: typeof displayLabels.clockRunning | typeof displayLabels.clockPaused): RegExp => new RegExp(`^\\d{2}:\\d{2} · ${state}$`);

function runStatusClock (page: Page): ReturnType<Page['getByLabel']>
{
    return page.getByLabel('Run status').getByLabel(clockName(displayLabels.clockRunning));
}

type AsteroidCollisionOutcome = 'damaged' | 'terminal';

async function hitPoints (healthBar: Locator): Promise<number>
{
    return await healthBar.evaluate(element => (element as HTMLProgressElement).value);
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
    await expect(page.locator('#game-container canvas')).toBeVisible();
    await page.getByRole('button', { name: 'New Game', exact: true }).click();
    await expect(page.getByLabel('Run status')).toBeVisible();
    await expect(runStatusClock(page)).toBeVisible();
    await expect(page.locator('#run-status-clock img')).toHaveAttribute('src', /clock_32x32\.png$/);
}

test('an anonymous player can start a new game, pause from the menu, resume, and return to the main menu', async ({ page }) => {
    await startRun(page);

    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Game menu' })).toBeVisible();
    await expect(page.getByLabel(clockName(displayLabels.clockPaused))).toBeVisible();
    await expect(page.locator('#run-status-clock img')).toHaveAttribute('src', /clock_paused_[12]_32x32\.png$/);
    await page.getByRole('button', { name: 'Resume' }).click();
    await expect(page.getByRole('dialog', { name: 'Game menu' })).toBeHidden();
    await expect(runStatusClock(page)).toBeVisible();
    await expect(page.locator('#run-status-clock img')).toHaveAttribute('src', /clock_32x32\.png$/);

    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    await page.getByRole('button', { name: 'Return to Main Menu' }).click();
    await expect(page.getByLabel('Main menu')).toBeVisible();
    await expect(page.getByLabel('Run status')).toBeHidden();
});

test.describe('authenticated trading journey', () => {
    test.use({ testSessionMode: 'authenticated' });

    test('a signed-in player trades at Seroton, Lactozis-7C, and Maslo-Prime with updated cargo and cash', async ({ page, testSession }) => {
        test.setTimeout(60_000);
        expect(testSession.mode).toBe('authenticated');
        await completeSignedInTradeJourney(page);
    });

    // Player-visible risk: the accessible debug control could fail to route through Phaser, leaving a signed-in player unable to die, see the final result, or retain it.
    // Lower-level tests cannot prove browser input, Phaser event routing, DOM HP projection, the timed scene transition, and authenticated local Supabase persistence together.
    // This uniquely verifies that an accessible browser control drives all of those real boundaries without direct state mutation.
    test('a signed-in player reaches a retained death result through bounded live-asteroid collisions', async ({ page, testSession }) => {
        test.setTimeout(120_000);
        expect(testSession.mode).toBe('authenticated');
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await page.getByRole('button', { name: 'New Game', exact: true }).click();
        const runStatus = page.getByLabel('Run status');
        await expect(runStatus).toBeVisible();
        const healthBar = runStatus.getByRole('progressbar', { name: /HP/ });
        await expect(healthBar).toBeVisible();

        const resultStatus = page.getByLabel('Result delivery status');
        for (let attempt = 1; attempt <= 7; attempt += 1) {
            if (await resultStatus.isVisible() || !await runStatus.isVisible()) {
                await expectSavedDeathResult(runStatus, resultStatus);
                return;
            }
            await expect(runStatus).toBeVisible();
            const hitPointsBefore = await hitPoints(healthBar);
            if (hitPointsBefore === 0) {
                await expectSavedDeathResult(runStatus, resultStatus);
                return;
            }

            await page.keyboard.press('d');
            await expect(page.getByRole('dialog', { name: 'Debug menu' })).toBeVisible();
            await page.getByRole('button', { name: displayLabels.teleportToAsteroid, exact: true }).click();

            if (await waitForAsteroidCollisionOutcome(runStatus, resultStatus, healthBar, hitPointsBefore, attempt) === 'terminal') {
                await expectSavedDeathResult(runStatus, resultStatus);
                return;
            }
        }
        throw new Error('Expected HP to reach zero within seven confirmed big-asteroid collisions.');
    });
});
