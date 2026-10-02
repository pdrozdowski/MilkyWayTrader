import { expect, type Page } from '@playwright/test';
import { displayLabels } from '../../src/ui/components/displayLabels';
import { test } from './testSessionFixture';

const clockName = (state: typeof displayLabels.clockRunning | typeof displayLabels.clockPaused): RegExp => new RegExp(`^\\d{2}:\\d{2} · ${state}$`);

async function expectClock (page: Page, state: typeof displayLabels.clockRunning | typeof displayLabels.clockPaused): Promise<void>
{
    await expect(page.getByLabel(clockName(state))).toBeVisible();
    const image = state === displayLabels.clockRunning ? /clock_32x32\.png$/ : /clock_paused_[12]_32x32\.png$/;
    await expect(page.locator('#run-status-clock img')).toHaveAttribute('src', image);
}

async function startRun (page: Page): Promise<void>
{
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#game-container canvas')).toBeVisible();
    await page.getByRole('button', { name: 'New Game', exact: true }).click();
    await expect(page.getByLabel('Run status')).toBeVisible();
    await expectClock(page, displayLabels.clockRunning);
}

test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });

test('a touch player is paused in portrait and can resume play on return to landscape', async ({ page }) => {
    await startRun(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('dialog', { name: 'Screen orientation' })).toBeVisible();
    await expectClock(page, displayLabels.clockPaused);

    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.getByRole('dialog', { name: 'Screen orientation' })).toBeHidden();
    await expectClock(page, displayLabels.clockRunning);
});

test('an anonymous player can start a new game, pause from the menu, resume, and return to the main menu', async ({ page }) => {
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
    await expect(page.getByLabel('Run status')).toBeHidden();
});
