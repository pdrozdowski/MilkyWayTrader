import { expect, test, type Locator, type Page } from '@playwright/test';

async function startRun (page: Page): Promise<Locator>
{
    const canvas = page.locator('#game-container canvas');
    const runStatus = page.getByLabel('Run status');
    await expect(canvas).toBeVisible();
    await page.getByRole('button', { name: 'New Game', exact: true }).click();
    await expect(runStatus).toBeVisible();
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(page.locator('#run-status-clock')).toContainText('RUNNING');
    return canvas;
}

test('application boots and persists accessible audio controls without consuming flight keys', async ({ page }) => {
    test.setTimeout(60_000);
    const pageErrors: string[] = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await startRun(page);
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    await expect(page.getByRole('group', { name: 'Game audio' })).toBeVisible();
    await page.locator('#audio-volume').fill('67');
    await expect(page.locator('#audio-volume-value')).toHaveText('67%');
    const keyWasNotCancelled = await page.locator('#audio-volume').evaluate(element => {
        element.focus();
        return element.dispatchEvent(new KeyboardEvent('keydown', { code: 'ControlLeft', bubbles: true, cancelable: true }));
    });
    expect(keyWasNotCancelled).toBe(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await startRun(page);
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    await expect(page.locator('#audio-volume')).toHaveValue('67');
    expect(pageErrors).toEqual([]);
});

test('main-menu fullscreen control and empty canvas do not start a run', async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    test.skip(testInfo.project.name === 'chromium-touch', 'Desktop coordinate coverage for the Phaser main menu.');
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const canvas = page.locator('#game-container canvas');
    await expect(canvas).toBeVisible();
    await page.getByRole('button', { name: /Fullscreen Mode:/ }).click();
    await expect(page.getByLabel('Run status')).toBeHidden();
    const bounds = await canvas.boundingBox();
    expect(bounds).not.toBeNull();
    if (!bounds) throw new Error('Missing canvas bounds.');
    await page.mouse.click(bounds.x + bounds.width * 0.1, bounds.y + bounds.height * 0.1);
    await expect(page.getByLabel('Run status')).toBeHidden();
});

test('main-menu DOM logo leaves every control visible below it', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const menu = page.getByLabel('Main menu');
    const logo = page.getByRole('img', { name: 'MilkyWayTrader' });
    const controls = [
        page.getByRole('button', { name: 'New Game', exact: true }),
        page.getByRole('button', { name: 'Continue Game', exact: true }),
        page.getByRole('button', { name: /Fullscreen Mode:/ })
    ];
    await expect(menu).toBeVisible();
    await expect(logo).toBeVisible();
    for (const control of controls) await expect(control).toBeVisible();
    const layout = await page.evaluate(() => {
        const logoBounds = document.querySelector('#main-menu-logo')?.getBoundingClientRect();
        const buttonBounds = [...document.querySelectorAll('#main-menu-controls button')].map(button => button.getBoundingClientRect());
        return { logoBounds, buttonBounds, viewportHeight: window.innerHeight, viewportWidth: window.innerWidth };
    });
    expect(layout.logoBounds).not.toBeNull();
    expect(layout.logoBounds?.width).toBeGreaterThanOrEqual(layout.viewportWidth - 1);
    expect(layout.buttonBounds).toHaveLength(3);
    for (const button of layout.buttonBounds) {
        expect(button.top).toBeGreaterThanOrEqual(layout.logoBounds?.bottom ?? 0);
        expect(button.bottom).toBeLessThanOrEqual(layout.viewportHeight);
    }
    const menuContentCenter = ((layout.logoBounds?.top ?? 0) + layout.buttonBounds[2].bottom) / 2;
    expect(Math.abs(menuContentCenter - layout.viewportHeight / 2)).toBeLessThanOrEqual(1);
});

test('a new run exposes status, accepts flight input, and survives focus and scene transitions', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-desktop', 'Desktop flight and scene-transition coverage.');
    test.setTimeout(60_000);
    const pageErrors: string[] = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const canvas = page.locator('#game-container canvas');
    const runStatus = page.getByLabel('Run status');
    await expect(canvas).toBeVisible();
    await expect(runStatus).toBeHidden();
    const menu = await canvas.screenshot();
    await startRun(page);
    await expect(runStatus).toBeVisible();
    await expect(page.locator('#run-status-clock')).toHaveText('30:00 · RUNNING');
    await expect(page.locator('#run-status-credits')).toHaveText('100,000 cr');
    await expect(page.locator('#run-status-cargo')).toHaveText('Cargo 0 / 20');
    await expect(page.locator('#run-status-hp-label')).toHaveText('HP 100 / 100');
    await expect(page.locator('#run-status-hp')).toHaveJSProperty('value', 100);
    await expect(page.locator('#run-status-hp')).toHaveJSProperty('max', 100);
    const shipInfo = page.getByRole('button', { name: 'Ship info' });
    const cargo = page.getByRole('button', { name: 'Cargo' });
    await expect(shipInfo).toHaveAttribute('aria-expanded', 'false');
    await expect(cargo).toHaveAttribute('aria-expanded', 'false');
    await shipInfo.click();
    await expect(shipInfo).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByLabel('Ship information')).toContainText('Cargo: Level 1 · Available');
    await expect(page.getByLabel('Ship information')).toContainText('Engine: Level 1 · Available');
    await expect(page.getByLabel('Ship information')).toContainText('Weapon: Level 1 · Available');
    await expect(page.getByLabel('Ship information')).toContainText('Booster: Locked');
    await expect(page.getByLabel('Cargo contents')).toBeHidden();
    await cargo.click();
    await expect(cargo).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByLabel('Cargo contents')).toHaveText('Cargo contents: Empty');
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
    await expect(page.locator('#run-status-clock')).toContainText('PAUSED');
    const pausedClock = await page.locator('#run-status-clock').textContent();
    await page.waitForTimeout(250);
    await expect(page.locator('#run-status-clock')).toHaveText(pausedClock ?? '');
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(page.locator('#run-status-clock')).toContainText('RUNNING');

    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    await page.getByRole('button', { name: 'Return to Main Menu' }).click();
    await page.waitForTimeout(250);
    const gameOver = await canvas.screenshot();
    expect(gameOver.equals(running)).toBe(false);
    await expect(runStatus).toBeHidden();
    expect(pageErrors).toEqual([]);
});

test('desktop flight retains pointer and keyboard actions after a viewport resize', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-desktop', 'Desktop pointer coverage.');
    test.setTimeout(60_000);
    const pageErrors: string[] = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const canvas = await startRun(page);
    await page.setViewportSize({ width: 960, height: 540 });
    await expect(canvas).toBeVisible();
    const resized = await canvas.boundingBox();
    expect(resized).not.toBeNull();
    if (!resized) throw new Error('Missing resized canvas bounds.');
    expect(resized.width).toBeGreaterThan(900);
    expect(resized.height).toBeGreaterThan(500);

    await page.mouse.move(resized.x + resized.width * 0.7, resized.y + resized.height * 0.45);
    await page.mouse.down();
    await page.keyboard.down('ShiftLeft');
    await page.keyboard.down('ControlLeft');
    await page.waitForTimeout(200);
    await page.keyboard.up('ControlLeft');
    await page.keyboard.up('ShiftLeft');
    await page.mouse.up();
    await expect(page.getByLabel('Run status')).toBeVisible();
    expect(pageErrors).toEqual([]);
});

test('touch controls accept joystick and action pointers and clear them on release or cancellation', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-touch', 'Touch-control coverage.');
    test.setTimeout(60_000);
    const pageErrors: string[] = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const canvas = await startRun(page);
    const bounds = await canvas.boundingBox();
    expect(bounds).not.toBeNull();
    if (!bounds) throw new Error('Missing touch canvas bounds.');
    const dispatchTouch = async (type: string, pointerId: number, x: number, y: number): Promise<void> => {
        await canvas.evaluate((element, event) => element.dispatchEvent(new PointerEvent(event.type, {
            bubbles: true, cancelable: true, pointerType: 'touch', pointerId: event.pointerId,
            clientX: event.x, clientY: event.y, buttons: event.type === 'pointerup' ? 0 : 1
        })), { type, pointerId, x, y });
    };
    const joystickX = bounds.x + 108;
    const joystickY = bounds.y + bounds.height - 108;
    await dispatchTouch('pointerdown', 11, joystickX, joystickY);
    await dispatchTouch('pointermove', 11, joystickX + 58, joystickY - 12);
    await dispatchTouch('pointerup', 11, joystickX + 58, joystickY - 12);
    await dispatchTouch('pointerdown', 12, bounds.x + bounds.width - 92, bounds.y + bounds.height - 98);
    await dispatchTouch('pointerup', 12, bounds.x + bounds.width - 92, bounds.y + bounds.height - 98);
    await dispatchTouch('pointerdown', 13, bounds.x + bounds.width - 186, bounds.y + bounds.height - 74);
    await canvas.evaluate((element, point) => {
        const touch = new Touch({ identifier: 13, target: element, clientX: point.x, clientY: point.y });
        element.dispatchEvent(new TouchEvent('touchcancel', { bubbles: true, changedTouches: [touch] }));
    }, { x: bounds.x + bounds.width - 186, y: bounds.y + bounds.height - 74 });
    await page.waitForTimeout(150);
    await expect(page.locator('#run-status-clock')).toContainText('RUNNING');
    expect(pageErrors).toEqual([]);
});
