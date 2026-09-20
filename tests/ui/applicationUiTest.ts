import { expect, test } from '@playwright/test';

test('application boots and persists accessible audio controls without consuming flight keys', async ({ page }) => {
    test.setTimeout(60_000);
    const pageErrors: string[] = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#game-container canvas')).toBeVisible();
    await expect(page.getByRole('group', { name: 'Game audio' })).toBeVisible();
    await page.locator('#audio-volume').fill('67');
    await expect(page.locator('#audio-volume-value')).toHaveText('67%');
    const keyWasNotCancelled = await page.locator('#audio-volume').evaluate(element => {
        element.focus();
        return element.dispatchEvent(new KeyboardEvent('keydown', { code: 'ControlLeft', bubbles: true, cancelable: true }));
    });
    expect(keyWasNotCancelled).toBe(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#audio-volume')).toHaveValue('67');
    expect(pageErrors).toEqual([]);
});
