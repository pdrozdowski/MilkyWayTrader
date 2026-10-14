import { expect } from '@playwright/test';
import { displayLabels } from '../../src/ui/components/displayLabels';
import { test } from './testSessionFixture';

test.describe('authenticated Personal Best journey', () => {
    test.use({ testSessionMode: 'authenticated' });

    // Player-visible failure: the personal-history dialog is clipped, obscured, or unreachable in landscape.
    // Fake-port component tests cannot expose actual viewport/layout stacking in the browser.
    // This uniquely verifies the dialog's real relationship to the Phaser canvas and responsive game UI.
    test('a signed-in player opens and closes Personal Best from the in-game menu in landscape', async ({ page, testSession }) => {
        expect(testSession.mode).toBe('authenticated');
        await page.setViewportSize({ width: 1280, height: 720 });
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await page.getByRole('button', { name: 'New Game', exact: true }).click();
        await expect(page.getByLabel('Run status')).toBeVisible();

        const menuToggle = page.getByRole('button', { name: 'Menu', exact: true });
        await menuToggle.click();
        const gameMenu = page.getByRole('dialog', { name: 'Game menu' });
        await expect(gameMenu).toBeVisible();
        const personalBestButton = gameMenu.getByRole('button', { name: displayLabels.personalBest, exact: true });
        await personalBestButton.click();

        const personalBest = page.getByRole('dialog', { name: /PERSONAL BEST/ });
        await expect(personalBest).toBeVisible();
        await expect(personalBest.getByText(displayLabels.personalBestNoScores, { exact: true })).toBeVisible();
        await expect(gameMenu).toBeHidden();

        const bounds = await personalBest.boundingBox();
        expect(bounds).not.toBeNull();
        if (!bounds) throw new Error('Personal Best dialog has no visible browser bounds.');
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.y).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(1280);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(720);

        await personalBest.getByRole('button', { name: displayLabels.personalBestClose, exact: true }).click();
        await expect(personalBest).toBeHidden();
        await expect(gameMenu).toBeVisible();
        await expect(personalBestButton).toBeFocused();
        await gameMenu.getByRole('button', { name: 'Resume', exact: true }).click();
        await expect(gameMenu).toBeHidden();
        await expect(page.getByLabel('Run status')).toBeVisible();
    });
});
