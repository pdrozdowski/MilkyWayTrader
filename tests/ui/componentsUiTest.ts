import { expect, test } from '@playwright/test';

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
    expect(await page.evaluate(() => window.uiHarness.listeners())).toEqual({ audio: 0, display: 0, runStatus: 0 });
});

test('display controls render responsive state and actionable errors', async ({ page }) => {
    await page.evaluate(() => window.uiHarness.setDisplay({ mobile: true, portrait: true, fullscreenAvailable: true }));
    await expect(page.locator('#orientation-notice')).toBeVisible();
    await expect(page.locator('#mobile-controls')).toBeVisible();
    await page.evaluate(() => window.uiHarness.setFullscreenResult('manual-rotation'));
    await page.locator('#fullscreen-toggle').click();
    await expect(page.locator('#display-status')).toContainText('Obróć telefon');

    await page.evaluate(() => window.uiHarness.setFullscreenResult('failed'));
    await page.locator('#fullscreen-toggle').click();
    await expect(page.locator('#display-status')).toContainText('Nie udało się');
    expect(await page.evaluate(() => window.uiHarness.refreshes())).toBeGreaterThan(0);
});

test('repeated mounting keeps one subscription per component', async ({ page }) => {
    await page.evaluate(() => { window.uiHarness.mount(); window.uiHarness.mount(); });
    expect(await page.evaluate(() => window.uiHarness.listeners())).toEqual({ audio: 1, display: 1, runStatus: 1 });
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
