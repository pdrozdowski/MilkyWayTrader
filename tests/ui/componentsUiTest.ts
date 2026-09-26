import { expect, test } from '@playwright/test';
import { displayLabels } from '../../src/ui/components/displayLabels';

test.beforeEach(async ({ page }) => {
    await page.goto('/tests/ui/fixtures/uiHarness.html', { waitUntil: 'domcontentloaded' });
});

test('audio controls render state, emit actions and release listeners', async ({ page }) => {
    const mute = page.getByRole('button', { name: 'Mute' });
    await expect(mute).toHaveAttribute('aria-pressed', 'false');
    await mute.click();
    await expect(page.getByRole('button', { name: 'Unmute' })).toHaveAttribute('aria-pressed', 'true');
    await page.locator('#audio-volume').fill('73');
    await expect(page.locator('#audio-volume-value')).toHaveText('73%');
    await expect.poll(() => page.evaluate(() => window.uiHarness.audio())).toEqual({ muted: true, masterVolume: 0.73 });

    await page.evaluate(() => window.uiHarness.setAudio({ muted: false, masterVolume: 0.25 }));
    await expect(mute).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#audio-volume')).toHaveValue('25');
    await page.evaluate(() => window.uiHarness.destroy());
    expect(await page.evaluate(() => window.uiHarness.listeners())).toEqual({ audio: 0, display: 0, runStatus: 0, landingStatus: 0 });
});

test('display controls render responsive state and actionable errors', async ({ page }) => {
    await page.evaluate(() => window.uiHarness.setDisplay({ mobile: true, portrait: true, fullscreenAvailable: true }));
    await expect(page.locator('#orientation-notice')).toBeVisible();
    await expect(page.locator('#mobile-controls')).toBeVisible();
    await expect(page.locator('#menu-display-controls')).toBeVisible();
    await expect(page.locator('#menu-fullscreen-toggle')).toHaveAttribute('aria-pressed', 'false');
    await page.evaluate(() => window.uiHarness.setFullscreenResult('manual-rotation'));
    await page.locator('#menu-fullscreen-toggle').click();
    await expect(page.locator('#menu-display-status')).toContainText(displayLabels.rotateToPlay);
    await expect(page.locator('#display-status')).toBeEmpty();

    await page.evaluate(() => window.uiHarness.setFullscreenResult('failed'));
    await page.locator('#fullscreen-toggle').click();
    await expect(page.locator('#display-status')).toContainText(displayLabels.fullscreenFailed);
    expect(await page.evaluate(() => window.uiHarness.refreshes())).toBeGreaterThan(0);
});

test('repeated mounting keeps one subscription per component', async ({ page }) => {
    await page.evaluate(() => { window.uiHarness.mount(); window.uiHarness.mount(); });
    expect(await page.evaluate(() => window.uiHarness.listeners())).toEqual({ audio: 1, display: 1, runStatus: 1, landingStatus: 1 });
});

test('landing market renders bounded quotes, emits semantic actions, traps focus and returns it on launch', async ({ page }) => {
    await page.evaluate(() => window.uiHarness.setLandingStatus({
        visible: true, eligible: true, planetName: 'Seroton', credits: 500, cargoUsed: 3, cargoCapacity: 20,
        commodities: [
            { commodityId: 'supplies', stock: 100, carriedQuantity: 3, unitPrice: 1_000 },
            { commodityId: 'alloys', stock: 60, carriedQuantity: 0, unitPrice: 5_000 },
            { commodityId: 'medicines', stock: 20, carriedQuantity: 0, unitPrice: 15_000 }
        ], selectedCommodityId: 'supplies', tradeQuantity: 2,
        quote: { quantity: 2, total: 2_000, failure: 'insufficient-credits', postTradeStock: 98, nextUnitPrice: 1_020 }
    }));
    const modal = page.getByRole('dialog', { name: 'Landed status' });
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('Seroton — LANDED');
    await expect(modal).toContainText('Time is paused while landed.');
    await expect(page.locator('#landing-status-quantity')).toHaveAttribute('min', '-3');
    await expect(page.locator('#landing-status-quantity')).toHaveAttribute('max', '17');
    await expect(modal).toContainText('Quote: 2,000 cr');
    await expect(modal).toContainText('Stock after trade: 98');
    await expect(modal).toContainText('Insufficient credits: 1,500 cr');
    await expect(page.getByRole('button', { name: 'CONFIRM TRADE' })).toBeDisabled();
    await page.getByRole('button', { name: /Alloys/ }).click();
    await page.locator('#landing-status-quantity').fill('4');
    expect(await page.evaluate(() => window.uiHarness.marketActions())).toEqual({ selectedCommodities: ['alloys'], tradeQuantities: [4], confirmations: 0 });
    await page.evaluate(() => window.uiHarness.setLandingStatus({ selectedCommodityId: 'alloys', tradeQuantity: -1, quote: { quantity: -1, total: 5_000, failure: null, postTradeStock: 61, nextUnitPrice: 4_950 } }));
    await page.getByRole('button', { name: 'CONFIRM TRADE' }).click();
    expect(await page.evaluate(() => window.uiHarness.marketActions())).toEqual({ selectedCommodities: ['alloys'], tradeQuantities: [4], confirmations: 1 });
    await page.getByRole('button', { name: 'LAUNCH', exact: true }).focus();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: /Supplies/ })).toBeFocused();
    await page.getByRole('button', { name: 'LAUNCH', exact: true }).click();
    expect(await page.evaluate(() => window.uiHarness.launches())).toBe(1);
    await expect(page.locator('#game-container canvas')).toBeFocused();
});

test('pause menu traps focus, resumes and restores its trigger focus', async ({ page }) => {
    const toggle = page.locator('#game-menu-toggle');
    await toggle.focus();
    await page.keyboard.press('Escape');
    await expect(page.locator('#game-menu')).toBeVisible();
    expect(await page.evaluate(() => window.uiHarness.gameControls().menuOpen)).toBe(true);
    await page.getByRole('button', { name: 'Resume' }).click();
    await expect(page.locator('#game-menu')).toBeHidden();
    await expect(toggle).toBeFocused();
    expect(await page.evaluate(() => window.uiHarness.gameControls().menuOpen)).toBe(false);
});

test('game controls fixture reports orientation pauses and exits through its port', async ({ page }) => {
    await page.evaluate(() => window.uiHarness.setOrientationPaused(true));
    expect(await page.evaluate(() => window.uiHarness.gameControls())).toEqual({ menuOpen: false, orientationPaused: true, exits: 0 });
    await page.locator('#game-menu-toggle').click();
    await page.getByRole('button', { name: 'Exit to Main Menu' }).click();
    expect(await page.evaluate(() => window.uiHarness.gameControls())).toEqual({ menuOpen: false, orientationPaused: true, exits: 1 });
});

test('run status renders updates and independently toggles Ship info and Cargo', async ({ page }) => {
    await expect(page.getByLabel('Run status')).toBeVisible();
    await expect(page.locator('#run-status-clock')).toHaveText('30:00 · RUNNING');
    await expect(page.locator('#run-status-credits')).toHaveText('100,000 cr');
    await expect(page.locator('#run-status-cargo')).toHaveText('Cargo 0 / 20');
    await expect(page.locator('#run-status-hp-label')).toHaveText('HP 100 / 100');
    await expect(page.locator('#run-status-hp')).toHaveJSProperty('value', 100);
    await page.getByRole('button', { name: 'Ship info' }).click();
    await expect(page.locator('#run-status-ship-details')).toBeVisible();
    await expect(page.locator('#run-status-cargo-details')).toBeHidden();
    await expect(page.locator('#run-status-booster')).toHaveText('Booster: Locked');
    await page.getByRole('button', { name: 'Cargo' }).click();
    await expect(page.locator('#run-status-cargo-details')).toBeVisible();
    await expect(page.locator('#run-status-cargo-contents')).toHaveText('Cargo contents: Empty');
    await page.evaluate(() => window.uiHarness.setRunStatus({ credits: 123_456, currentHitPoints: 42, visible: false }));
    await expect(page.getByLabel('Run status')).toBeHidden();
    await expect(page.locator('#run-status-credits')).toHaveText('123,456 cr');
    await expect(page.locator('#run-status-hp')).toHaveJSProperty('value', 42);
});
