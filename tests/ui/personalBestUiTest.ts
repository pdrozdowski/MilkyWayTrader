import { expect } from '@playwright/test';
import { displayLabels } from '../../src/ui/components/displayLabels';
import { test } from './testSessionFixture';

test.describe('authenticated Personal Best journey', () => {
    test.use({ testSessionMode: 'authenticated' });

    // Player-visible failure: the nested delete confirmation can obscure Personal Best or trap keyboard focus.
    // A cheaper fake-DOM/component test cannot expose actual browser dialog stacking or keyboard focus traversal.
    // This uniquely verifies accessible dialog semantics and keyboard focus movement in the browser.
    test('a signed-in player confirms result deletion from Personal Best with keyboard access', async ({ page, testSession }) => {
        expect(testSession.mode).toBe('authenticated');
        await page.setViewportSize({ width: 1280, height: 720 });
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await page.getByRole('button', { name: 'New Game', exact: true }).click();
        await expect(page.getByLabel('Run status')).toBeVisible();
        await testSession.seedHistoryResult(77_321);
        await page.getByRole('button', { name: 'Menu', exact: true }).click();
        await page.getByRole('button', { name: displayLabels.personalBest, exact: true }).click();

        const personalBest = page.getByRole('dialog', { name: /PERSONAL BEST/ });
        await expect(personalBest).toBeVisible();
        const deleteButton = personalBest.getByRole('button', { name: /^DELETE / });
        await expect(deleteButton).toBeVisible();

        await deleteButton.click();
        const confirmation = page.getByRole('alertdialog', { name: displayLabels.personalBestConfirmDeleteTitle, exact: true });
        await expect(confirmation).toBeVisible();
        await expect(confirmation).toHaveAttribute('aria-modal', 'true');
        await expect(personalBest).toBeVisible();
        const noButton = confirmation.getByRole('button', { name: displayLabels.personalBestConfirmNo, exact: true });
        const yesButton = confirmation.getByRole('button', { name: displayLabels.personalBestConfirmYes, exact: true });
        await expect(yesButton).toBeFocused();
        await page.keyboard.press('Shift+Tab');
        await expect(noButton).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(yesButton).toBeFocused();

        await noButton.click();
        await expect(confirmation).toBeHidden();
        await expect(deleteButton).toBeFocused();
        await deleteButton.click();
        await expect(confirmation).toBeVisible();
        await confirmation.getByRole('button', { name: displayLabels.personalBestConfirmYes, exact: true }).click();
        await expect(confirmation).toBeHidden();
        await expect(personalBest.getByText(displayLabels.personalBestNoScores, { exact: true })).toBeVisible();
        await expect(deleteButton).toBeHidden();
    });
});
