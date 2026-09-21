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

test('a run accepts flight, boost and fire input and survives focus and scene transitions', async ({ page }) => {
    test.setTimeout(60_000);
    const pageErrors: string[] = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const canvas = page.locator('#game-container canvas');
    await expect(canvas).toBeVisible();
    const menu = await canvas.screenshot();
    await canvas.click({ position: { x: 100, y: 100 } });
    await page.waitForTimeout(500);
    const running = await canvas.screenshot();
    expect(running.equals(menu)).toBe(false);

    const bounds = await canvas.boundingBox();
    expect(bounds).not.toBeNull();
    if (!bounds) throw new Error('Missing canvas bounds.');
    await page.mouse.move(bounds.x + bounds.width * 0.75, bounds.y + bounds.height * 0.5);
    await page.mouse.down();
    await page.keyboard.down('ShiftLeft');
    await page.waitForTimeout(250);
    await page.keyboard.up('ShiftLeft');
    await page.keyboard.down('ControlLeft');
    await page.waitForTimeout(400);
    await page.keyboard.up('ControlLeft');
    await page.mouse.up();
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await page.waitForTimeout(100);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.waitForTimeout(100);

    await canvas.click({ position: { x: bounds.width * 0.97, y: bounds.height * 0.96 } });
    await page.waitForTimeout(250);
    const gameOver = await canvas.screenshot();
    expect(gameOver.equals(running)).toBe(false);
    expect(pageErrors).toEqual([]);
});
