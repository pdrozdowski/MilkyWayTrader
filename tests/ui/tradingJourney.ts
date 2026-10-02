import { expect, type Page } from '@playwright/test';
import { displayLabels } from '../../src/ui/components/displayLabels';

async function teleportTo (page: Page, planetName: string): Promise<void>
{
    await page.keyboard.press('d');
    await expect(page.getByRole('dialog', { name: 'Debug menu' })).toBeVisible();
    await page.getByRole('button', { name: `Teleport to ${planetName}`, exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Landed status' })).toBeVisible();
}

async function trade (page: Page, direction: 'buy' | 'sell', quantityUnits: number): Promise<void>
{
    await page.getByRole('button', { name: 'Market', exact: true }).click();
    const quantity = page.getByRole('slider');
    await expect(quantity).toBeVisible();
    for (let unit = 0; unit < quantityUnits; unit += 1) {
        await quantity.press(direction === 'buy' ? 'ArrowRight' : 'ArrowLeft');
    }
    await expect(page.getByText(direction === 'buy' ? `+${quantityUnits} BUY` : `${quantityUnits} SELL`, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'CONFIRM TRADE', exact: true }).click();
}

async function launch (page: Page): Promise<void>
{
    await page.getByRole('button', { name: 'BACK', exact: true }).click();
    await page.getByRole('button', { name: displayLabels.launch, exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Landed status' })).toBeHidden();
}

/** Browser risk: authenticated session, Phaser landing, DOM market controls, and HUD must keep one shared trade outcome. */
export async function completeSignedInTradeJourney (page: Page): Promise<void>
{
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByLabel('Main menu').getByRole('button', { name: /playwright-/ })).toBeVisible();
    await page.getByRole('button', { name: 'New Game', exact: true }).click();
    await expect(page.getByLabel('Run status')).toBeVisible();
    const cashBalance = page.getByLabel('Run status').getByText(/\d[\d,]* cr/);
    await expect(cashBalance).toBeVisible();

    await teleportTo(page, 'Seroton');
    const cashBeforePurchase = await cashBalance.innerText();
    await trade(page, 'buy', 2);
    await expect(page.getByText(/^Credits: \d[\d,]* cr$/)).toBeVisible();
    await expect(page.getByText('Cargo: 2 / 20', { exact: true })).toBeVisible();
    await expect(cashBalance).not.toHaveText(cashBeforePurchase);
    await launch(page);
    await expect(page.getByText('Cargo 2 / 20', { exact: true })).toBeVisible();

    await teleportTo(page, 'Lactozis-7C');
    const cashBeforeFirstSale = await cashBalance.innerText();
    await trade(page, 'sell', 1);
    await expect(page.getByText(/^Credits: \d[\d,]* cr$/)).toBeVisible();
    await expect(page.getByText('Cargo: 1 / 20', { exact: true })).toBeVisible();
    await expect(cashBalance).not.toHaveText(cashBeforeFirstSale);
    await launch(page);
    await expect(page.getByText('Cargo 1 / 20', { exact: true })).toBeVisible();

    await teleportTo(page, 'Maslo-Prime');
    const cashBeforeFinalSale = await cashBalance.innerText();
    await trade(page, 'sell', 1);
    await expect(page.getByText(/^Credits: \d[\d,]* cr$/)).toBeVisible();
    await expect(page.getByText('Cargo: 0 / 20', { exact: true })).toBeVisible();
    await expect(cashBalance).not.toHaveText(cashBeforeFinalSale);
    await expect(page.getByText('Cargo 0 / 20', { exact: true })).toBeVisible();
}
