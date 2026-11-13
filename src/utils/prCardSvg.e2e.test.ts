import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { generatePrCardSvg } from './prCardSvg';

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

test('Playwright E2E: PR Share Card SVG renders properly in Chromium (1080x1920 Stories format)', async () => {
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
      viewport: { width: 1080, height: 1920 },
      deviceScaleFactor: 1,
    });
    page = await context.newPage();

    const svg = generatePrCardSvg({
      exerciseName: 'Жим штанги лёжа',
      weightKg: 100,
      reps: 6,
      estimated1RM: 116.7,
      prevEstimated1RM: 110,
      dateStr: '14 ноября 2026',
      athleteName: 'Хамзат',
    });

    // Wrap in full HTML page to load fonts and render in browser
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Anton&family=Barlow+Semi+Condensed:wght@600;700&family=Barlow:wght@400;600;700&display=swap" rel="stylesheet">
  <style>body { margin: 0; background: #000; display: flex; justify-content: center; align-items: center; width: 1080px; height: 1920px; }</style>
</head>
<body>
  ${svg}
</body>
</html>`;

    await page.setContent(html, { waitUntil: 'domcontentloaded' });

    // Inspect SVG element
    const svgEl = page.locator('svg');
    assert.equal(await svgEl.isVisible(), true, 'SVG card must be visible');

    const viewBox = await svgEl.getAttribute('viewBox');
    assert.equal(viewBox, '0 0 1080 1920');

    // Check title text rendered
    const titleText = await page.locator('text=ЖИМ ШТАНГИ ЛЁЖА').textContent();
    assert.ok(titleText?.includes('ЖИМ ШТАНГИ ЛЁЖА'));

    // Check numbers rendered
    const weightText = await page.locator('text=100').textContent();
    assert.ok(weightText?.includes('100'));

    // Check 1RM text
    const ormText = await page.locator('text=~116.7').textContent();
    assert.ok(ormText?.includes('116.7'));

    // Check athlete name
    const athlete = await page.locator('text=ХАМЗАТ').textContent();
    assert.ok(athlete?.includes('ХАМЗАТ'));
  } finally {
    if (page) await page.close().catch(() => undefined);
    if (context) await context.close().catch(() => undefined);
    if (browser) await browser.close().catch(() => undefined);
  }
});
