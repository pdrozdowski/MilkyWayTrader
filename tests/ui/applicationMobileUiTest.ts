import { expect, type Page } from '@playwright/test';
import { displayLabels } from '../../src/ui/components/displayLabels';
import { test } from './testSessionFixture';
import { completeGameIntro } from './gameStateFixture';

const clockName = (state: typeof displayLabels.clockRunning | typeof displayLabels.clockPaused): RegExp => new RegExp(`^\\d{2}:\\d{2} · ${state}$`);

async function expectClock (page: Page, state: typeof displayLabels.clockRunning | typeof displayLabels.clockPaused): Promise<void>
{
    await expect(page.getByRole('region', { name: 'Run status' }).getByLabel(clockName(state))).toBeVisible();
}

async function startRun (page: Page): Promise<void>
{
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: 'New Game', exact: true })).toBeVisible({ timeout: 300_000 });
    await page.getByRole('button', { name: 'New Game', exact: true }).click();
    await completeGameIntro(page);
    await expect(page.getByRole('region', { name: 'Run status' })).toBeVisible();
    await expectClock(page, displayLabels.clockRunning);
}

test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });

test('a touch player is paused in portrait and can resume play on return to landscape', async ({ page }) => {
    test.setTimeout(360_000);
    await startRun(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('dialog', { name: 'Screen orientation' })).toBeVisible();
    await expectClock(page, displayLabels.clockPaused);

    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.getByRole('dialog', { name: 'Screen orientation' })).toBeHidden();
    await expectClock(page, displayLabels.clockRunning);
});

test('an anonymous player can start a new game, pause from the menu, resume, and return to the main menu', async ({ page }) => {
    test.setTimeout(360_000);
    await startRun(page);

    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Game menu' })).toBeVisible();
    await expectClock(page, displayLabels.clockPaused);
    await page.getByRole('button', { name: 'Resume' }).click();
    await expect(page.getByRole('dialog', { name: 'Game menu' })).toBeHidden();
    await expectClock(page, displayLabels.clockRunning);

    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    await page.getByRole('button', { name: 'Return to Main Menu' }).click();
    await expect(page.getByLabel('Main menu')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Run status' })).toBeHidden();
});
