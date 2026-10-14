import { expect } from '@playwright/test';
import { displayLabels } from '../../src/ui/components/displayLabels';
import { test } from './testSessionFixture';

test.describe('authenticated global high-score journey', () => {
    test.use({ testSessionMode: 'authenticated' });

    // Player-visible failure: opening GLOBAL HI-SCORE from the main menu fails to show the signed-in player's saved rank row.
    // Component tests with fake ports cannot prove the menu event, authenticated session, browser adapter and local database work together.
    // This uniquely verifies the real main-menu-to-public-board route and the database-backed nickname, date, rank and score.
    test('a signed-in player opens GLOBAL HI-SCORE from the main menu and sees a saved database result', async ({ page, testSession }) => {
        const nickname = await testSession.seedGlobalScore(9_000);
        await page.setViewportSize({ width: 1280, height: 720 });
        await page.goto('/', { waitUntil: 'domcontentloaded' });

        await page.getByRole('button', { name: displayLabels.globalHighScores, exact: true }).click();
        const board = page.getByRole('dialog', { name: displayLabels.globalHighScoresTitle, exact: true });
        await expect(board).toBeVisible();
        const table = board.getByRole('table', { name: 'Global high scores' });
        await expect(table).toBeVisible();
        const savedResult = table.getByRole('row').filter({ hasText: nickname });
        await expect(savedResult).toBeVisible();
        await expect(savedResult.getByRole('cell', { name: nickname, exact: true })).toBeVisible();
        await expect(savedResult.getByRole('cell', { name: '9,000', exact: true })).toBeVisible();
        await expect(board.getByText(`PLAYER: ${nickname}`, { exact: true })).toBeVisible();

        await board.getByRole('button', { name: displayLabels.globalHighScoresClose, exact: true }).click();
        await expect(board).toBeHidden();
        await expect(page.getByRole('button', { name: displayLabels.globalHighScores, exact: true })).toBeFocused();
    });
});
