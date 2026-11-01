// Browser check: load the real page, add a plant, mark it watered, reload, and
// assert the plant and its recomputed due-state persist via localStorage.
//
// Run with: npm run test:browser
// Requires Playwright + the Chromium browser installed locally in the worktree:
//   npm install
//   npx playwright install chromium
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
};

function startServer() {
  const server = http.createServer(async (req, res) => {
    try {
      const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
      const filePath = path.join(ROOT, rel);
      // Prevent path traversal outside the repo root.
      if (!filePath.startsWith(ROOT)) {
        res.writeHead(403).end('Forbidden');
        return;
      }
      const body = await readFile(filePath);
      res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end('Not found');
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

async function main() {
  const { server, baseUrl } = await startServer();
  const browser = await chromium.launch();
  let failed = false;
  try {
    const page = await browser.newPage();

    // Pin a deterministic browser clock so "Mark watered" cannot be a no-op:
    // the plant is added at ADD_TIME, then the clock is advanced several days
    // before watering so the recomputed last-watered + next-due must change.
    const STORAGE_KEY = 'plant-watering-tracker/v1';
    const DAY = 24 * 60 * 60 * 1000;
    const ADD_TIME = Date.UTC(2026, 0, 10, 9, 0, 0); // Jan 10 2026 09:00 UTC
    const WATER_TIME = ADD_TIME + 8 * DAY; // 8 days later
    const addIso = new Date(ADD_TIME).toISOString();
    const waterIso = new Date(WATER_TIME).toISOString();

    await page.clock.install();
    await page.clock.setFixedTime(ADD_TIME);
    await page.goto(`${baseUrl}/index.html`);

    // Read the single stored plant's lastWatered straight from localStorage.
    const readLastWatered = () =>
      page.evaluate((key) => {
        const raw = window.localStorage.getItem(key);
        const list = raw ? JSON.parse(raw) : [];
        return list[0] ? list[0].lastWatered : null;
      }, STORAGE_KEY);

    // Add a plant (last-watered = ADD_TIME).
    await page.fill('#plant-name', 'Fiddle Leaf Fig');
    await page.fill('#plant-interval', '5');
    await page.click('#add-form button[type="submit"]');

    const plant = page.locator('.plant', { hasText: 'Fiddle Leaf Fig' });
    await plant.waitFor();
    assert.equal(await page.locator('.plant').count(), 1, 'one plant after add');

    const lastWateredBefore = await readLastWatered();
    const dueBeforeWater = await plant.locator('.plant__due').textContent();
    assert.equal(lastWateredBefore, addIso, 'last-watered recorded at add time');

    // Advance the clock, THEN mark watered — so the water action has a visible,
    // asserted effect on last-watered and the next due date.
    await page.clock.setFixedTime(WATER_TIME);
    await plant.locator('.btn--water').click();

    // The displayed due date must update once the plant has been re-watered.
    await plant.locator('.plant__due').filter({ hasNotText: dueBeforeWater }).waitFor();
    const stateAfterWater = await plant.locator('.badge').getAttribute('data-state');
    const dueAfterWater = await plant.locator('.plant__due').textContent();
    const lastWateredAfter = await readLastWatered();

    assert.equal(stateAfterWater, 'upcoming', 'freshly watered plant is upcoming');
    assert.equal(lastWateredAfter, waterIso, 'water updates last-watered to the new "now"');
    assert.notEqual(lastWateredAfter, lastWateredBefore, 'last-watered actually changed');
    assert.notEqual(dueAfterWater, dueBeforeWater, 'next due date actually changed');

    // Reload the page fully (clock stays fixed at WATER_TIME).
    await page.reload();

    const plantAfterReload = page.locator('.plant', { hasText: 'Fiddle Leaf Fig' });
    await plantAfterReload.waitFor();
    assert.equal(await page.locator('.plant').count(), 1, 'plant persists after reload');
    assert.equal(
      await plantAfterReload.locator('.plant__meta').textContent(),
      'Every 5 days',
      'interval persists after reload',
    );

    const stateAfterReload = await plantAfterReload.locator('.badge').getAttribute('data-state');
    const dueAfterReload = await plantAfterReload.locator('.plant__due').textContent();
    const lastWateredAfterReload = await readLastWatered();
    assert.equal(stateAfterReload, stateAfterWater, 'due-state recomputes the same after reload');
    assert.equal(dueAfterReload, dueAfterWater, 'next due date recomputes the same after reload');
    assert.equal(lastWateredAfterReload, waterIso, 'advanced last-watered persists across reload');

    console.log('✔ browser check passed: add -> advance clock -> water -> reload persists the updated plant and state');
  } catch (err) {
    failed = true;
    console.error('✖ browser check failed:', err.message);
  } finally {
    await browser.close();
    server.close();
  }
  process.exit(failed ? 1 : 0);
}

main();
