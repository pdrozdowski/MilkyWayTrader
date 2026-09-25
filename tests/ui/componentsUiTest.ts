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
    expect(await page.evaluate(() => window.uiHarness.listeners())).toEqual({ audio: 0, display: 0, runStatus: 0 });
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
    expect(await page.evaluate(() => window.uiHarness.listeners())).toEqual({ audio: 1, display: 1, runStatus: 1 });
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
