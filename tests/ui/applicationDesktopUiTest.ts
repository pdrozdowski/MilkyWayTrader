import { expect, test, type Page } from '@playwright/test';
import { displayLabels } from '../../src/ui/components/displayLabels';

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
