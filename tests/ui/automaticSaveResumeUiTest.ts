import { expect } from '@playwright/test';
import { mainMenuSaveLabels } from '../../src/game/scenes/mainMenuLabels';
import { displayLabels } from '../../src/ui/components/displayLabels';
import { test } from './testSessionFixture';

// seed: tests/ui/testSessionFixture.ts and tests/ui/gameStateFixture.ts.
// Player-visible failure: a landed run cannot be launched and saved, or Continue fails to restore its gameplay controls after reload.
// Lower-level tests cannot expose the browser storage, authenticated startup, save adapter, and Phaser scene restore wiring together.
// This uniquely verifies browser storage, authenticated startup, and Phaser restore keep the run's credits and controls through reload.
// The fixture seeds once before first navigation; page.reload() must read the server save and never re-inject fixture state.
test.describe('authenticated automatic save and resume', () => {
    test.use({
        testSessionMode: 'authenticated',
        initialGameState: {
            planet: 'seroton',
            credits: 87_500,
            cargo: [{ commodityId: 'grain', quantity: 2, totalCost: 3_000 }]
        }
    });

    test('a landed run can be launched, saved across reload, and resumed with usable gameplay', async ({ page, testSession }) => {
        expect(testSession.mode).toBe('authenticated');
        const runStatus = page.getByLabel('Run status');
        await expect(runStatus).toBeVisible();
        await expect(page.getByRole('dialog', { name: 'Landed status' })).toBeVisible();
        await expect(runStatus.getByLabel('Credits', { exact: true })).toContainText('87,500');

        await page.getByRole('button', { name: 'LAUNCH', exact: true }).click();
        await expect(page.getByRole('dialog', { name: 'Landed status' })).toBeHidden();

        // Returning to the Main Menu is a qualifying save action. Wait until the account save is discoverable there.
        await page.getByRole('button', { name: 'Menu', exact: true }).click();
        await expect(page.getByRole('dialog', { name: 'Game menu' })).toBeVisible();
        await page.getByRole('button', { name: 'Return to Main Menu', exact: true }).click();
        const mainMenu = page.getByLabel('Main menu');
        const continueGame = mainMenu.getByRole('button', { name: mainMenuSaveLabels.continueButton, exact: true });
        await expect(mainMenu).toBeVisible();
        await expect(continueGame).toBeEnabled();

        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(mainMenu).toBeVisible();
        await expect(continueGame).toBeEnabled();
        await continueGame.click();

        await expect(runStatus).toBeVisible();
        await expect(page.getByRole('dialog', { name: 'Landed status' })).toBeHidden();
        await expect(runStatus.getByLabel('Credits', { exact: true })).toContainText('87,500');
        await expect(runStatus.getByRole('button', { name: 'Cargo Info', exact: true })).toBeVisible();
        await expect(runStatus.getByRole('button', { name: 'Menu', exact: true })).toBeVisible();
    });

    // Player-visible failure: cancelling New Game can destroy the only saved progress, or confirmation can start the introduction before finalization.
    // Component tests cannot prove the real Phaser menu listener, accessible confirmation dialog, and intro transition use the same save completion.
    // This uniquely verifies that the browser preserves Continue after cancellation and opens the introduction after confirmed abandonment.
    test('New Game cancellation preserves a saved run and confirmation opens the introduction', async ({ page, testSession }) => {
        expect(testSession.mode).toBe('authenticated');
        await expect(page.getByRole('dialog', { name: 'Landed status' })).toBeVisible();

        await page.getByRole('button', { name: 'LAUNCH', exact: true }).click();
        await expect(page.getByRole('dialog', { name: 'Landed status' })).toBeHidden();

        await page.getByRole('button', { name: 'Menu', exact: true }).click();
        await expect(page.getByRole('dialog', { name: 'Game menu' })).toBeVisible();
        await page.getByRole('button', { name: 'Return to Main Menu', exact: true }).click();

        const mainMenu = page.getByLabel('Main menu');
        const newGame = mainMenu.getByRole('button', { name: mainMenuSaveLabels.newGameButton, exact: true });
        const continueGame = mainMenu.getByRole('button', { name: mainMenuSaveLabels.continueButton, exact: true });
        await expect(continueGame).toBeEnabled();
        await newGame.click();

        const confirmation = page.getByRole('alertdialog', { name: displayLabels.runSaveNewGameTitle });
        await expect(confirmation).toBeVisible();
        await confirmation.getByRole('button', { name: displayLabels.runSaveCancel, exact: true }).click();
        await expect(confirmation).toBeHidden();
        await expect(page.getByRole('dialog', { name: 'Introduction' })).toBeHidden();
        await expect(continueGame).toBeEnabled();

        // Reload proves cancellation left the server-owned run intact, independent of the current menu projection.
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(mainMenu).toBeVisible();
        await expect(continueGame).toBeEnabled();
        await newGame.click();
        await expect(confirmation).toBeVisible();

        const finalizationResponse = page.waitForResponse(response =>
            response.url().includes('/rpc/finalize_active_run') && response.request().method() === 'POST'
        );
        await confirmation.getByRole('button', { name: displayLabels.runSaveConfirm, exact: true }).click();
        const finalized = await finalizationResponse;
        expect(finalized.ok()).toBe(true);
        await expect(confirmation).toBeHidden();
        await expect(page.getByRole('dialog', { name: 'Introduction' })).toBeVisible();
    });
});
