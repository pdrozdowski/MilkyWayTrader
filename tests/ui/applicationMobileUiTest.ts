import { expect, test, type Page } from '@playwright/test';

async function startRun (page: Page): Promise<void>
{
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#game-container canvas')).toBeVisible();
    await page.getByRole('button', { name: 'New Game', exact: true }).click();
    await expect(page.getByLabel('Run status')).toBeVisible();
    await expect(page.locator('#run-status-clock')).toContainText('RUNNING');
}

test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });

test('a touch player is paused in portrait and can resume play on return to landscape', async ({ page }) => {
    await startRun(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('dialog', { name: 'Screen orientation' })).toBeVisible();
    await expect(page.locator('#run-status-clock')).toContainText('PAUSED');

    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.getByRole('dialog', { name: 'Screen orientation' })).toBeHidden();
    await expect(page.locator('#run-status-clock')).toContainText('RUNNING');
});

test('an anonymous player can start a new game, pause from the menu, resume, and return to the main menu', async ({ page }) => {
    await startRun(page);

    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Game menu' })).toBeVisible();
    await expect(page.locator('#run-status-clock')).toContainText('PAUSED');
    await page.getByRole('button', { name: 'Resume' }).click();
    await expect(page.getByRole('dialog', { name: 'Game menu' })).toBeHidden();
    await expect(page.locator('#run-status-clock')).toContainText('RUNNING');

    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    await page.getByRole('button', { name: 'Return to Main Menu' }).click();
    await expect(page.getByLabel('Main menu')).toBeVisible();
    await expect(page.getByLabel('Run status')).toBeHidden();
});
