import { expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { initialGameState } from '../../src/game/definitions/initialGameState.ts';
import { pauseGameClock } from '../../src/game/mechanics/clock/gameClock.ts';
import { encodeGameState } from '../../src/game/application/gameStateCodec.ts';
import { test } from './testSessionFixture';

// Player-visible failure: Google OAuth reload drops the active run or leaves the account dialog closed.
// Unit tests can validate the serialized context, but cannot cover tab storage surviving a real page reload and Phaser startup consuming it.
// This journey uniquely verifies the browser reload, startup route, restored paused run, and returned account dialog together.
test('an in-game account return reload restores the paused run and reopens Player Account', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const runId = randomUUID();
    const snapshot = { ...initialGameState, runId, clock: pauseGameClock(initialGameState.clock, 'menu') };
    const returnContext = JSON.stringify({
        snapshot: encodeGameState(snapshot),
        telemetryContext: { sessionId: `account-return-${Date.now()}`, sessionStartedAt: 1000 },
        origin: 'game-menu',
        terminalResult: null
    });
    await page.evaluate(value => window.sessionStorage.setItem('milky-way-trader.auth-return', value), returnContext);
    await page.reload({ waitUntil: 'domcontentloaded' });

    const account = page.getByRole('dialog', { name: 'PLAYER ACCOUNT' });
    await expect(page.getByLabel('Run status')).toBeVisible({ timeout: 60_000 });
    await expect(account).toBeVisible();
    await expect(account.getByRole('button', { name: /SIGN IN WITH GOOGLE/ })).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Game menu' })).toBeHidden();

    await page.getByRole('button', { name: 'CLOSE', exact: true }).click();
    await expect(account).toBeHidden();
    await expect(page.getByRole('dialog', { name: 'Game menu' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Run status' }).getByLabel(/PAUSED/)).toBeVisible();
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Game menu' })).toBeHidden();
    await expect(page.getByRole('region', { name: 'Run status' }).getByLabel(/RUNNING/)).toBeVisible();
});

test.describe('signed-in Player Account', () => {
    test.use({ testSessionMode: 'authenticated' });

    test('a player updates a persisted nickname and sees account controls change on sign-out', async ({ page, testSession }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        const openAccount = page.getByLabel('Main menu').getByRole('button', { name: /playwright-/ });
        await expect(openAccount).toBeVisible();
        await openAccount.click();
        const account = page.getByRole('dialog', { name: 'PLAYER ACCOUNT' });
        await expect(account).toBeVisible();
        await expect(account.getByText('Signed in', { exact: true })).toBeVisible();
        await expect(account.getByText(/playwright-/)).toBeVisible();
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
        await account.getByRole('button', { name: 'SIGN OUT', exact: true }).click();
        await expect(account.getByRole('button', { name: /SIGN IN WITH GOOGLE/ })).toBeVisible();
        await expect(account.getByLabel('PLAYER NICKNAME')).toBeHidden();
    });
});
