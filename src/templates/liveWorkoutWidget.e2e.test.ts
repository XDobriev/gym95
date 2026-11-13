import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { generateLiveWorkoutWidgetHtml } from './liveWorkoutWidget';

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

test('Playwright E2E: Live Workout HTML Widget interactive flow on mobile viewport', async () => {
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

    const html = generateLiveWorkoutWidgetHtml({
      title: 'Жим лёжа на скамье',
      initialState: {
        wid: 'w_test_e2e',
        ex: 'Жим лёжа на скамье',
        w: 90.0,
        r: 8,
        sn: 1,
        st: 4,
        m: 'active',
        rd: 90,
      },
    });

    await page.setContent(html, { waitUntil: 'domcontentloaded' });

    // 1. Initial render inspection
    const title = await page.locator('#ui-ex-title').textContent();
    assert.equal(title?.trim().toLowerCase(), 'жим лёжа на скамье');

    // Verify title uses Barlow per DESIGN.md (Anton is strictly for numbers only)
    const titleFont = await page.locator('#ui-ex-title').evaluate((el) => window.getComputedStyle(el).fontFamily);
    assert.ok(titleFont.toLowerCase().includes('barlow'), `Title must use Barlow font, got ${titleFont}`);

    const badge = await page.locator('#ui-header-badge').textContent();
    assert.ok(badge?.includes('СЕТ #1 / 4'), `Badge was ${badge}`);

    const initialWeight = await page.locator('#val-weight').textContent();
    assert.equal(initialWeight?.trim(), '90');

    const initialReps = await page.locator('#val-reps').textContent();
    assert.equal(initialReps?.trim(), '8');

    // 2. Steppers interaction: Weight (+2.5, -2.5)
    await page.locator('#btn-w-inc').click();
    assert.equal((await page.locator('#val-weight').textContent())?.trim(), '92.5');

    await page.locator('#btn-w-inc').click();
    assert.equal((await page.locator('#val-weight').textContent())?.trim(), '95');

    await page.locator('#btn-w-dec').click();
    assert.equal((await page.locator('#val-weight').textContent())?.trim(), '92.5');

    // Steppers interaction: Reps (+1, -1)
    await page.locator('#btn-r-inc').click();
    assert.equal((await page.locator('#val-reps').textContent())?.trim(), '9');

    await page.locator('#btn-r-dec').click();
    assert.equal((await page.locator('#val-reps').textContent())?.trim(), '8');

    // 3. Complete Set Action (Active -> Resting transition)
    await page.locator('#btn-finish-set').click();

    // Verify last action recorded
    const lastAction = await page.evaluate(() => (window as any).__gym95_lastAction);
    assert.equal(lastAction?.action, 'finish_set');
    assert.equal(lastAction?.weight, 92.5);
    assert.equal(lastAction?.reps, 8);
    assert.equal(lastAction?.setIndex, 1);

    // Verify Resting UI is displayed
    const isRestingVisible = await page.locator('#view-resting').isVisible();
    assert.equal(isRestingVisible, true, 'Resting view must be visible');

    const restingBadge = await page.locator('#ui-header-badge').textContent();
    assert.equal(restingBadge?.trim(), 'ОТДЫХ');

    const timerText = await page.locator('#ui-rest-countdown').textContent();
    assert.ok(timerText?.includes(':'), `Timer format must be mm:ss, got ${timerText}`);

    // 4. Quick add rest (+30 sec)
    await page.locator('#btn-resting-add-30').click();
    const actionAfterAddRest = await page.evaluate(() => (window as any).__gym95_lastAction);
    assert.equal(actionAfterAddRest?.action, 'add_rest');
    assert.equal(actionAfterAddRest?.restAdded, 30);

    // 5. Skip rest / Start Set (Resting -> Active transition)
    await page.locator('#btn-skip-rest').click();
    const actionAfterSkip = await page.evaluate(() => (window as any).__gym95_lastAction);
    assert.equal(actionAfterSkip?.action, 'skip_rest');

    const isActiveRestored = await page.locator('#view-active').isVisible();
    assert.equal(isActiveRestored, true, 'Active view must be restored for next set');

    const nextSetBadge = await page.locator('#ui-header-badge').textContent();
    assert.ok(nextSetBadge?.includes('СЕТ #2 / 4'), `Badge should be Set #2, got ${nextSetBadge}`);

    // Verify ghost hints updated with previous set values
    const ghostW = await page.locator('#hint-weight').textContent();
    assert.ok(ghostW?.includes('92.5'), `Ghost weight should be 92.5, got ${ghostW}`);
    const ghostR = await page.locator('#hint-reps').textContent();
    assert.ok(ghostR?.includes('8'), `Ghost reps should be 8, got ${ghostR}`);

    // 5b. Test early finish from resting view
    await page.evaluate(() => (window as any).__gym95_setState({ m: 'resting', sn: 2, st: 4 }));
    await page.locator('#btn-finish-exercise-early').click();
    const actionEarlyFinish = await page.evaluate(() => (window as any).__gym95_lastAction);
    assert.equal(actionEarlyFinish?.action, 'finish_exercise');
    assert.equal(await page.locator('#view-done').isVisible(), true);

    // 5c. Test adding extra set from done view
    await page.locator('#btn-add-more-set').click();
    const actionAddSet = await page.evaluate(() => (window as any).__gym95_lastAction);
    assert.equal(actionAddSet?.action, 'add_set');
    assert.equal(await page.locator('#view-active').isVisible(), true);

    // 6. Transition to Done mode
    await page.evaluate(() => {
      (window as any).__gym95_setState({
        m: 'done',
        completedSets: [
          { w: 90, r: 8 },
          { w: 92.5, r: 8 },
          { w: 92.5, r: 8 },
          { w: 95, r: 6 },
        ],
      });
    });

    const isDoneVisible = await page.locator('#view-done').isVisible();
    assert.equal(isDoneVisible, true, 'Done view must be visible');

    const doneBadge = await page.locator('#ui-header-badge').textContent();
    assert.ok(doneBadge?.includes('ВЫПОЛНЕНО'), `Done badge was ${doneBadge}`);

    // Total tonnage: 90*8 (720) + 92.5*8 (740) + 92.5*8 (740) + 95*6 (570) = 2770 kg
    const tonnageText = await page.locator('#ui-done-tonnage').textContent();
    assert.ok(tonnageText?.includes('2') && tonnageText?.includes('770'), `Tonnage must contain 2 770, got ${tonnageText}`);

    // Click next exercise button
    await page.locator('#btn-next-exercise').click();
    const actionNextEx = await page.evaluate(() => (window as any).__gym95_lastAction);
    assert.equal(actionNextEx?.action, 'next_exercise');

    // Click finish workout button
    await page.locator('#btn-finish-workout').click();
    const actionFinishWorkout = await page.evaluate(() => (window as any).__gym95_lastAction);
    assert.equal(actionFinishWorkout?.action, 'finish_workout');
  } finally {
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
});

test('Playwright E2E: Responsive layout on Android & Pixel viewports without horizontal overflow', async () => {
  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;

  try {
    const executablePath = getChromiumExecutablePath();
    browser = await chromium.launch({
      headless: true,
      ...(executablePath ? { executablePath } : {}),
    });

    const viewports = [
      { width: 360, height: 640 }, // Small mobile
      { width: 412, height: 915 }, // Pixel 7
    ];

    for (const vp of viewports) {
      context = await browser.newContext({ viewport: vp });
      page = await context.newPage();

      const html = generateLiveWorkoutWidgetHtml({
        title: 'Становая тяга с помоста',
        initialState: { w: 140, r: 5, sn: 3, st: 4 },
      });

      await page.setContent(html, { waitUntil: 'domcontentloaded' });

      // Verify no horizontal overflow
      const overflow = await page.evaluate(() => {
        return document.body.scrollWidth > window.innerWidth;
      });
      assert.equal(overflow, false, `Horizontal overflow detected on ${vp.width}x${vp.height}`);

      await page.close();
      await context.close();
    }
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
});
