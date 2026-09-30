import { expect, test } from '@playwright/test';
import { displayLabels } from '../../src/ui/components/displayLabels';

test.beforeEach(async ({ page }) => {
    await page.goto('/tests/ui/fixtures/uiHarness.html', { waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.evaluate(() => Boolean(window.uiHarness))).toBe(true);
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
    expect(await page.evaluate(() => window.uiHarness.listeners())).toEqual({ audio: 0, display: 0, runStatus: 0, landingStatus: 0, auth: 0 });
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
    expect(await page.evaluate(() => window.uiHarness.listeners())).toEqual({ audio: 1, display: 1, runStatus: 1, landingStatus: 1, auth: 1 });
});

test('auth controls expose unsigned, unavailable, signed-in and teardown states', async ({ page }) => {
    await expect(page.getByText('Unsigned', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Sign in with Google' }).click();
    expect(await page.evaluate(() => window.uiHarness.authActions())).toEqual({ signInAttempts: 1, signOutAttempts: 0 });
    await page.evaluate(() => window.uiHarness.setAuth({ status: 'unavailable', message: 'missing configuration' }));
    await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeDisabled();
    await page.evaluate(() => window.uiHarness.setAuth({ status: 'error', message: 'OAuth popup was cancelled' }));
    await expect(page.getByText('Sign-in failed. Please try again.', { exact: true })).toBeVisible();
    await page.evaluate(() => window.uiHarness.setAuth({ status: 'signed-in', email: 'pilot@example.com', message: null }));
    await expect(page.locator('#run-status-auth')).toHaveText('pilot@example.com');
    await expect(page.locator('#run-status-auth')).toHaveClass(/run-status-auth--signed-in/);
    await expect(page.getByRole('button', { name: '👤 pilot@example.com · Sign out' })).toBeVisible();
    await page.getByRole('button', { name: '👤 pilot@example.com · Sign out' }).click();
    expect(await page.evaluate(() => window.uiHarness.authActions())).toEqual({ signInAttempts: 1, signOutAttempts: 1 });
    await page.locator('#game-menu-toggle').click();
    await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    expect(await page.evaluate(() => window.uiHarness.authActions())).toEqual({ signInAttempts: 1, signOutAttempts: 2 });
    await page.evaluate(() => window.uiHarness.destroy());
    expect(await page.evaluate(() => window.uiHarness.listeners().auth)).toBe(0);
});

test('landing hub enters and leaves the shared market, preserves landing, traps focus and returns it on launch', async ({ page }) => {
    await page.evaluate(() => window.uiHarness.setLandingStatus({
        visible: true, eligible: true, planetName: 'Seroton', credits: 500, cargoUsed: 3, cargoCapacity: 20,
        commodities: [
            { commodityId: 'supplies', stock: 100, carriedQuantity: 3, unitPrice: 1_000, averageBuyPrice: 950, productionPerSecond: 4, consumptionPerSecond: 2 },
            { commodityId: 'alloys', stock: 60, carriedQuantity: 0, unitPrice: 5_000, averageBuyPrice: 0, productionPerSecond: 1, consumptionPerSecond: 2 },
            { commodityId: 'medicines', stock: 20, carriedQuantity: 0, unitPrice: 15_000, averageBuyPrice: 0, productionPerSecond: 0, consumptionPerSecond: 1 }
        ], selectedCommodityId: 'supplies', selectedCommodity: { commodityId: 'supplies', stock: 100, carriedQuantity: 3, unitPrice: 1_000, averageBuyPrice: 950, productionPerSecond: 4, consumptionPerSecond: 2 }, tradeQuantity: 2, plannedStockDelta: -2, plannedCargoDelta: 2,
        quote: { quantity: 2, total: 2_000, failure: 'insufficient-credits', postTradeStock: 98, nextUnitPrice: 1_020 }
    }));
    const modal = page.getByRole('dialog', { name: 'Landed status' });
    await expect(modal).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Landed on Seroton' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Shipyard unavailable' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Market' })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(page.getByRole('button', { name: 'LAUNCH', exact: true })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Market' })).toBeFocused();
    await page.getByRole('button', { name: 'Market' }).click();
    await expect(page.getByRole('heading', { name: 'Market' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Supplies/ })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(page.getByRole('button', { name: 'BACK', exact: true })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: /Supplies/ })).toBeFocused();
    await expect(page.locator('#landing-status-trade > :nth-child(1)')).toHaveAttribute('aria-label', 'Planet stock');
    await expect(page.locator('#landing-status-trade > :nth-child(2)')).toHaveClass(/market-trade-control/);
    await expect(page.locator('#landing-status-trade > :nth-child(3)')).toHaveAttribute('aria-label', 'Ship inventory');
    await expect(page.locator('#landing-status-commodity-name')).toHaveText(displayLabels.supplies);
    await expect(page.locator('#landing-status-supply')).toHaveText('Supply: Medium');
    await expect(page.getByRole('button', { name: /Supplies/ })).toHaveText('Supplies · 3');
    await expect(page.getByRole('button', { name: /Alloys/ })).toHaveText('Alloys');
    await expect(modal).not.toContainText('Time is paused while landed.');
    await expect(page.locator('#landing-status-quantity')).toHaveAttribute('min', '-3');
    await expect(page.locator('#landing-status-quantity')).toHaveAttribute('max', '17');
    await expect(page.locator('#landing-status-quantity-label')).toHaveText('Trading: Supplies');
    await expect(page.locator('#landing-status-planet-stock')).toHaveText('98 (-2)');
    await expect(page.locator('#landing-status-planet-stock .market-stock-delta')).toHaveClass(/market-stock-delta--negative/);
    await expect(page.locator('#landing-status-player-stock')).toHaveText('5 (+2)');
    await expect(page.locator('#landing-status-player-stock .market-stock-delta')).toHaveClass(/market-stock-delta--positive/);
    await expect(page.locator('#landing-status-average-buy-price')).toHaveText('Average buy price: 970 cr');
    await expect(page.locator('.market-commodity-icon')).toHaveAttribute('aria-label', 'Supplies commodity icon');
    await expect(page.locator('#landing-status-unit-price')).toHaveText('Price: 1,020 cr');
    await expect(page.locator('#landing-status-quantity-value')).toHaveText('+2 BUY');
    await expect(modal).toContainText('Total trade value: 2,000 cr');
    await expect(page.locator('#landing-status-budget')).toHaveText(`${displayLabels.outOfBudget} — ${displayLabels.marketCashShortfall} 1,500 cr`);
    await expect(page.locator('#landing-status-budget')).toHaveClass(/market-budget--warning/);
    await expect(page.locator('#landing-status-impact')).toHaveCount(0);
    await expect(page.locator('#landing-status-cash-shortfall')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'CONFIRM TRADE' })).toBeDisabled();
    await page.evaluate(() => window.uiHarness.setLandingStatus({ tradeQuantity: -2, plannedStockDelta: 2, plannedCargoDelta: -2, quote: { quantity: -2, total: 1_800, failure: null, postTradeStock: 102, nextUnitPrice: 1_000 } }));
    await expect(page.locator('#landing-status-average-buy-price')).toHaveText('Average buy price: 950 cr');
    await expect(page.locator('#landing-status-trade-result-label')).toHaveText('Trade result:');
    await expect(page.locator('#landing-status-trade-result')).toHaveText('LOSS -100 cr');
    await expect(page.locator('#landing-status-trade-result')).toHaveClass(/market-trade-result--loss/);
    await page.evaluate(() => window.uiHarness.setLandingStatus({ supplyLevel: 'Low' }));
    await expect(page.locator('#landing-status-supply')).toHaveText('Supply: Low');
    await page.evaluate(() => window.uiHarness.setLandingStatus({ supplyLevel: 'High' }));
    await expect(page.locator('#landing-status-supply')).toHaveText('Supply: High');
    await page.getByRole('button', { name: /Alloys/ }).click();
    await page.locator('#landing-status-quantity').fill('4');
    expect(await page.evaluate(() => window.uiHarness.marketActions())).toEqual({ selectedCommodities: ['supplies', 'alloys'], tradeQuantities: [0, 4], confirmations: 0 });
    await page.evaluate(() => window.uiHarness.setLandingStatus({ selectedCommodityId: 'alloys', tradeQuantity: -1, quote: { quantity: -1, total: 5_000, failure: null, postTradeStock: 61, nextUnitPrice: 4_950 } }));
    await page.getByRole('button', { name: 'CONFIRM TRADE' }).click();
    expect(await page.evaluate(() => window.uiHarness.marketActions())).toEqual({ selectedCommodities: ['supplies', 'alloys'], tradeQuantities: [0, 4], confirmations: 1 });
    await page.getByRole('button', { name: 'BACK', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Landed on Seroton' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Market' })).toBeFocused();
    await page.getByRole('button', { name: 'LAUNCH', exact: true }).focus();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Market' })).toBeFocused();
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
    await expect(page.locator('#run-status-cargo-contents')).toHaveText('Cargo contents:');
    await expect(page.locator('#run-status-cargo-rows tr')).toHaveCount(0);
    await page.evaluate(() => window.uiHarness.setRunStatus({ cargo: [{ commodityId: 'supplies', quantity: 6 }, { commodityId: 'alloys', quantity: 2 }] }));
    await expect(page.locator('#run-status-cargo-table tr')).toHaveCount(3);
    await expect(page.locator('#run-status-cargo-rows tr').nth(0)).toHaveText('SSupplies6');
    await expect(page.locator('#run-status-cargo-rows tr').nth(1)).toHaveText('AAlloys2');
    await expect(page.locator('#run-status-cargo-rows tr td')).toHaveCount(6);
    await expect(page.locator('#run-status-cargo-rows .cargo-commodity-icon').nth(0)).toHaveCSS('width', '32px');
    await expect(page.locator('#run-status-cargo-rows .cargo-commodity-icon').nth(0)).toHaveCSS('height', '32px');
    await page.evaluate(() => window.uiHarness.setRunStatus({ credits: 123_456, currentHitPoints: 42, visible: false }));
    await expect(page.getByLabel('Run status')).toBeHidden();
    await expect(page.locator('#run-status-credits')).toHaveText('123,456 cr');
    await expect(page.locator('#run-status-hp')).toHaveJSProperty('value', 42);
});
