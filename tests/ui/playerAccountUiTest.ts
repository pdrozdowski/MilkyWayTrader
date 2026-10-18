import { expect, type Locator, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { initialGameState } from '../../src/game/definitions/initialGameState.ts';
import { pauseGameClock } from '../../src/game/mechanics/clock/gameClock.ts';
import { encodeGameState } from '../../src/game/application/gameStateCodec.ts';
import { test } from './testSessionFixture';

// Player-visible failure: Google OAuth reload drops the active run or leaves the account dialog closed.
// Unit tests can validate the serialized context, but cannot cover tab storage surviving a real page reload and Phaser startup consuming it.
// This journey uniquely verifies the browser reload, startup route, restored paused run, and returned account dialog together.
test('an in-game account return reload restores the paused run and reopens Player Account', async ({ page }) => {
    test.setTimeout(240_000);
    const runId = randomUUID();
    const snapshot = { ...initialGameState, runId, clock: pauseGameClock(initialGameState.clock, 'menu') };
    const returnContext = JSON.stringify({
        snapshot: encodeGameState(snapshot),
        telemetryContext: { sessionId: `account-return-${Date.now()}`, sessionStartedAt: 1000 },
        origin: 'game-menu',
        terminalResult: null
    });
    await page.addInitScript(value => window.sessionStorage.setItem('milky-way-trader.auth-return', value), returnContext);
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const account = page.getByRole('dialog', { name: 'PLAYER ACCOUNT' });
    await expect(page.getByLabel('Run status')).toBeVisible({ timeout: 180_000 });
    await expect(account).toBeVisible();
    await expect(account.getByText('NOT SIGNED IN', { exact: true })).toBeHidden();
    await expect(account.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Game menu' })).toBeHidden();

    await page.getByRole('button', { name: 'CLOSE', exact: true }).click();
    await expect(account).toBeHidden();
    await expect(page.getByRole('dialog', { name: 'Game menu' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Run status' }).getByText(/^\d{2}:\d{2}$/)).toBeVisible();
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Game menu' })).toBeHidden();
    await expect(page.getByRole('region', { name: 'Run status' }).getByLabel(/RUNNING/)).toBeVisible();
});

test.describe('signed-in Player Account', () => {
    test.use({ testSessionMode: 'authenticated' });

    // Player-visible failure: a saved nickname disappears after the signed-in player reloads the account screen.
    // A lower-level adapter test cannot prove the real browser session and account UI reload path together.
    // This uniquely verifies profile persistence across a full application reload.
    test('a signed-in player saves a nickname that persists after reload', async ({ page, testSession }) => {
        const account = await openSignedInAccount(page);
        const nickname = account.getByLabel('PLAYER NICKNAME');
        await expect(nickname).toHaveValue(/^spaceTrader\d{5}$/);

        const updatedNickname = `Pilot${testSession.id.replace(/-/gu, '').slice(0, 10)}`;
        await nickname.fill(updatedNickname);
        await account.getByRole('button', { name: 'UPDATE NICKNAME', exact: true }).click();
        await expect(account.getByText('Nickname updated.', { exact: true })).toBeVisible();
        await account.getByRole('button', { name: 'CLOSE', exact: true }).click();

        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.getByLabel('Main menu').getByRole('button', { name: /playwright-/ }).click();
        await expect(account).toBeVisible();
        await expect(account.getByLabel('PLAYER NICKNAME')).toHaveValue(updatedNickname);
    });

    // Player-visible failure: signing out leaves signed-in controls available or hides the sign-in action.
    // Component tests cannot prove the Supabase auth event updates the mounted browser dialog.
    // This uniquely verifies the account UI responds to a real browser sign-out.
    test('signing out hides profile controls and offers sign-in', async ({ page }) => {
        const account = await openSignedInAccount(page);
        await account.getByRole('button', { name: 'SIGN OUT', exact: true }).click();
        await expect(account.getByText('NOT SIGNED IN', { exact: true })).toBeHidden();
        await expect(account.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
        await expect(account.getByLabel('PLAYER NICKNAME')).toBeHidden();
    });
});

async function openSignedInAccount (page: Page): Promise<Locator>
{
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const mainMenu = page.getByLabel('Main menu');
    await expect(mainMenu).toBeVisible({ timeout: 60_000 });
    const openAccount = mainMenu.getByRole('button', { name: /playwright-/ });
    await expect(openAccount).toBeVisible({ timeout: 60_000 });
    await openAccount.click();
    const account = page.getByRole('dialog', { name: 'PLAYER ACCOUNT' });
    await expect(account).toBeVisible();
    await expect(account.getByText(/Signed in/)).toBeVisible();
    await expect(account.getByText(/playwright-/)).toBeVisible();
    await expect(account.getByLabel('PLAYER NICKNAME')).toBeVisible();
    return account;
}
