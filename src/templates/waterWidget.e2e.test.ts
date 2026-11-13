import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { generateWaterWidgetHtml } from './waterWidget';

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

test('Playwright E2E: Water Balance Widget interactive flow on mobile viewport', async () => {
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

    const html = generateWaterWidgetHtml({
      initialState: { drunkMl: 1500, targetMl: 2500, workoutBonus: true },
    });

    await page.setContent(html, { waitUntil: 'domcontentloaded' });

    // 1. Initial State Check (1500 / 2500 -> 60%)
    const drunkText = await page.locator('#ui-drunk-val').textContent();
    assert.ok(drunkText?.includes('1500'), `Expected 1500 ml, got ${drunkText}`);

    const percentText = await page.locator('#ui-percent-val').textContent();
    assert.equal(percentText?.trim(), '60%');

    const badgeStatus = await page.locator('#ui-badge-status').textContent();
    assert.equal(badgeStatus?.trim(), 'В ПРОЦЕССЕ');

    // 2. Tap +500 ml -> 2000 ml (80%)
    await page.locator('#btn-add-500').click();

    const drunkAfter500 = await page.locator('#ui-drunk-val').textContent();
    assert.ok(drunkAfter500?.includes('2000'), `Expected 2000 ml, got ${drunkAfter500}`);
    assert.equal((await page.locator('#ui-percent-val').textContent())?.trim(), '80%');

    // 3. Tap +750 ml -> 2750 ml (> 2500 ml -> 100%, Goal Reached)
    await page.locator('#btn-add-750').click();

    const drunkAfter750 = await page.locator('#ui-drunk-val').textContent();
    assert.ok(drunkAfter750?.includes('2750'), `Expected 2750 ml, got ${drunkAfter750}`);
    assert.equal((await page.locator('#ui-percent-val').textContent())?.trim(), '100%');

    const badgeDone = await page.locator('#ui-badge-status').textContent();
    assert.equal(badgeDone?.trim(), 'НОРМА ВЫПОЛНЕНА ✓');

    // Check done styling applied
    const hasDoneClass = await page.locator('#ui-drunk-val').evaluate((el) => el.classList.contains('done'));
    assert.equal(hasDoneClass, true, 'Value should have done class');
  } finally {
    if (page) await page.close().catch(() => undefined);
    if (context) await context.close().catch(() => undefined);
    if (browser) await browser.close().catch(() => undefined);
  }
});
