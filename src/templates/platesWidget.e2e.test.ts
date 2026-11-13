import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { generatePlatesWidgetHtml } from './platesWidget';

function getChromiumExecutablePath(): string | undefined {
  const localAppData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Local');
  const msPlaywright = path.join(localAppData, 'ms-playwright');
  if (fs.existsSync(msPlaywright)) {
    const entries = fs.readdirSync(msPlaywright).sort().reverse();
    for (const entry of entries) {
      const cand1 = path.join(msPlaywright, entry, 'chrome-win64', 'chrome.exe');
      if (fs.existsSync(cand1)) return cand1;
      const cand2 = path.join(msPlaywright, entry, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
      if (fs.existsSync(cand2)) return cand2;
    }
  }
  return undefined;
}

test('Playwright E2E: Plates Calculator Widget interactions and Olympic plates rendering', async () => {
  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;

  try {
    const executablePath = getChromiumExecutablePath();
    browser = await chromium.launch({
      headless: true,
      ...(executablePath ? { executablePath } : {}),
    });
    context = await browser.newContext({
      viewport: { width: 390, height: 844 }, // iPhone 14
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    });
    page = await context.newPage();

    const html = generatePlatesWidgetHtml({
      initialState: { targetWeight: 100, barWeight: 20 },
    });

    await page.setContent(html, { waitUntil: 'domcontentloaded' });

    // 1. Initial State Check (100 kg, 20 kg bar -> 40 kg per side: 25+15 or 20+20)
    // In DEFAULT_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25], 40 = 25 + 15
    const targetBadge = await page.locator('#ui-target-badge').textContent();
    assert.equal(targetBadge?.trim(), '100 КГ');

    const sideWeight = await page.locator('#ui-side-weight').textContent();
    assert.ok(sideWeight?.includes('40 кг'), `Side weight must be 40 kg, got ${sideWeight}`);

    const leftPlates = await page.locator('#plates-left .plate').allTextContents();
    assert.deepEqual(leftPlates, ['25', '15']);

    // 2. Stepper Click: +5 kg -> 105 kg (side = 42.5 kg -> 25 + 15 + 2.5)
    await page.locator('#btn-inc-5').click();
    assert.equal((await page.locator('#ui-target-badge').textContent())?.trim(), '105 КГ');
    assert.ok((await page.locator('#ui-side-weight').textContent())?.includes('42.5 кг'));

    const leftPlatesAfterInc = await page.locator('#plates-left .plate').allTextContents();
    assert.deepEqual(leftPlatesAfterInc, ['25', '15', '2.5']);

    // 3. Stepper Click: -2.5 kg -> 102.5 kg (side = 41.25 kg -> 25 + 15 + 1.25)
    await page.locator('#btn-dec-25').click();
    assert.equal((await page.locator('#ui-target-badge').textContent())?.trim(), '102.5 КГ');
    const leftPlatesAfterDec = await page.locator('#plates-left .plate').allTextContents();
    assert.deepEqual(leftPlatesAfterDec, ['25', '15', '1.25']);

    // 4. Change Bar Weight to 15 kg
    await page.locator('#btn-bar-15').click();
    const barLabel = await page.locator('#ui-bar-label').textContent();
    assert.equal(barLabel?.trim(), 'ГРИФ 15');
    // 102.5 kg - 15 kg = 87.5 kg / 2 = 43.75 kg -> 25 + 15 + 2.5 + 1.25
    const platesWith15Bar = await page.locator('#plates-left .plate').allTextContents();
    assert.deepEqual(platesWith15Bar, ['25', '15', '2.5', '1.25']);

    // 5. Preset Click: 60 kg
    await page.locator('.btn-preset', { hasText: '60' }).click();
    assert.equal((await page.locator('#ui-target-badge').textContent())?.trim(), '60 КГ');
  } finally {
    if (page) await page.close().catch(() => undefined);
    if (context) await context.close().catch(() => undefined);
    if (browser) await browser.close().catch(() => undefined);
  }
});
