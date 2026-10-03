import { expect, type Page } from '@playwright/test';
import { displayLabels } from '../../src/ui/components/displayLabels';
import { resultLabels } from '../../src/game/application/results/resultLabels';
import { test } from './testSessionFixture';
import { completeSignedInTradeJourney } from './tradingJourney';

const clockName = (state: typeof displayLabels.clockRunning | typeof displayLabels.clockPaused): RegExp => new RegExp(`^\\d{2}:\\d{2} · ${state}$`);

async function startRun (page: Page): Promise<void>
{
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#game-container canvas')).toBeVisible();
    await page.getByRole('button', { name: 'New Game', exact: true }).click();
    await expect(page.getByLabel('Run status')).toBeVisible();
    await expect(page.getByLabel(clockName(displayLabels.clockRunning))).toBeVisible();
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
    await expect(page.getByLabel(clockName(displayLabels.clockRunning))).toBeVisible();
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
        const healthBar = page.getByRole('progressbar');
        await expect(healthBar).toBeVisible();

        const resultStatus = page.getByLabel('Result delivery status');
        for (let attempt = 1; attempt <= 5; attempt += 1) {
            if (await runStatus.isHidden()) {
                await expect.poll(async () => await resultStatus.isVisible(), {
                    timeout: 5_000,
                    intervals: [1_000],
                    message: 'Game-over result screen did not report result delivery after five one-second checks.'
                }).toBe(true);
                await expect(healthBar).toBeHidden();
                await expect(resultStatus).toContainText(resultLabels.saved);
                return;
            }
            const hitPointsBefore = await healthBar.evaluate(element => (element as HTMLProgressElement).value);
            if (hitPointsBefore > 0) {
                await page.keyboard.press('d');
                await expect(page.getByRole('dialog', { name: 'Debug menu' })).toBeVisible();
                await page.waitForTimeout(500);
                await page.getByRole('button', { name: displayLabels.teleportToAsteroid, exact: true }).click();
                await expect.poll(async () => {
                    if (await runStatus.isHidden()) return 'game-over';
                    if (await resultStatus.isVisible()) return 'game-over';
                    const hitPointsAfter = await healthBar.evaluate(element => (element as HTMLProgressElement).value, undefined, { timeout: 100 }).catch(() => null);
                    if (hitPointsAfter === null) return 'game-over';
                    return hitPointsAfter < hitPointsBefore ? 'damaged' : 'waiting';
                }, {
                    timeout: 1_000,
                    intervals: [1_000],
                    message: `Asteroid teleport attempt ${attempt} did not cause an immediate collision.`
                }).not.toBe('waiting');
                continue;
            }

            await expect.poll(async () => await resultStatus.isVisible(), {
                timeout: 5_000,
                intervals: [1_000],
                message: 'Game-over result screen did not appear after five one-second checks.'
            }).toBe(true);
            await expect(healthBar).toBeHidden();
            await expect(resultStatus).toContainText(resultLabels.saved);
            return;
        }
        throw new Error('Expected HP to reach zero within five immediate asteroid collisions.');
    });
});
