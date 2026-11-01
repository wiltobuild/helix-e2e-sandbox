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
    await page.goto(`${baseUrl}/index.html`);

    // Add a plant.
    await page.fill('#plant-name', 'Fiddle Leaf Fig');
    await page.fill('#plant-interval', '5');
    await page.click('#add-form button[type="submit"]');

    const plant = page.locator('.plant', { hasText: 'Fiddle Leaf Fig' });
    await plant.waitFor();
    assert.equal(await page.locator('.plant').count(), 1, 'one plant after add');

    // Mark it watered and capture the resulting due-state.
    await plant.locator('.btn--water').click();
    const stateAfterWater = await plant.locator('.badge').getAttribute('data-state');
    const dueAfterWater = await plant.locator('.plant__due').textContent();
    assert.equal(stateAfterWater, 'upcoming', 'freshly watered plant is upcoming');

    // Reload the page fully.
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
    assert.equal(stateAfterReload, stateAfterWater, 'due-state recomputes the same after reload');
    assert.equal(dueAfterReload, dueAfterWater, 'next due date recomputes the same after reload');

    console.log('✔ browser check passed: add -> water -> reload persists the plant and its state');
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
