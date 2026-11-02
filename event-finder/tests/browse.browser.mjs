// Browse slice browser test (Playwright / chromium).
//
// Mounts event-finder/src/browse.js in a MINIMAL, SELF-CONTAINED inline HTML
// harness — it does not depend on event-finder/index.html (owned by the
// integration task) and does not implement favourites persistence (an
// in-memory FavouritesStore is injected and instrumented here).
//
// Proves: browse by date, browse by topic, open an event's details, and that
// the favourite toggle calls the injected store and reflects its has()/toggle()
// state (including an external, out-of-band store change).
//
// Run with: npm run test:events:browse
// Requires Playwright + the Chromium browser:
//   npm install && npx playwright install chromium
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const HARNESS_PATH = '/__browse_harness__.html';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
};

// A minimal page that mounts browse.js against the real fixtures and a plain
// in-memory FavouritesStore. The store is instrumented (call counts + a
// mirror of its Set) so the test can prove the UI calls it and reflects it.
const HARNESS_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Browse harness</title>
  <link rel="stylesheet" href="/event-finder/styles.css" />
</head>
<body>
  <main id="root"></main>
  <script type="module">
    import { mountBrowse } from '/event-finder/src/browse.js';
    import { EVENTS } from '/event-finder/src/fixtures.js';

    const set = new Set();
    const subscribers = new Set();
    const calls = { has: 0, add: 0, remove: 0, toggle: 0, list: 0, clear: 0 };
    const notify = () => { const ids = [...set]; subscribers.forEach((fn) => fn(ids)); };

    /** @type {import('/event-finder/src/events.js').FavouritesStore} */
    const store = {
      has(id) { calls.has++; return set.has(id); },
      add(id) { calls.add++; if (!set.has(id)) { set.add(id); notify(); } },
      remove(id) { calls.remove++; if (set.delete(id)) notify(); },
      toggle(id) {
        calls.toggle++;
        let saved;
        if (set.has(id)) { set.delete(id); saved = false; } else { set.add(id); saved = true; }
        notify();
        return saved;
      },
      list() { calls.list++; return [...set]; },
      subscribe(fn) { subscribers.add(fn); return () => subscribers.delete(fn); },
      clear() { calls.clear++; if (set.size) { set.clear(); notify(); } },
    };

    window.__calls = calls;
    window.__store = store;
    window.__storeHas = (id) => set.has(id);
    window.__app = mountBrowse(document.getElementById('root'), { events: EVENTS, store });
  </script>
</body>
</html>`;

function startServer() {
  const server = http.createServer(async (req, res) => {
    try {
      const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      if (urlPath === HARNESS_PATH || urlPath === '/') {
        res.writeHead(200, { 'Content-Type': MIME['.html'] });
        res.end(HARNESS_HTML);
        return;
      }
      const filePath = path.join(ROOT, urlPath.replace(/^\/+/, ''));
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
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    const consoleErrors = [];
    page.on('pageerror', (err) => consoleErrors.push(err.message));
    await page.goto(`${baseUrl}${HARNESS_PATH}`);

    const cards = page.locator('[data-event-card]');
    await cards.first().waitFor();

    // The full synthetic catalogue renders by default (12 fixtures).
    assert.equal(await cards.count(), 12, 'all fixtures render by default');
    const firstTitle = await page.locator('[data-event-card] [data-card-title]').first().textContent();
    assert.match(firstTitle, /synthetic sample/i, 'cards show the clearly-synthetic title');

    // --- Browse by date ---------------------------------------------------
    // 2026-11-07 holds exactly two fixtures: sample-clay (Arts) + sample-code (Tech).
    await page.selectOption('[data-filter-date]', '2026-11-07');
    await page.locator('[data-event-card="sample-code"]').waitFor();
    assert.equal(await cards.count(), 2, 'date filter narrows to two events');
    assert.equal(await page.locator('[data-event-card="sample-clay"]').count(), 1, 'clay on 11-07');
    assert.equal(await page.locator('[data-event-card="sample-code"]').count(), 1, 'code on 11-07');
    assert.equal(await page.locator('[data-event-card="sample-jazz"]').count(), 0, 'jazz filtered out');

    // The card shows venue, start time and topic, not just the title.
    const clay = page.locator('[data-event-card="sample-clay"]');
    assert.match(await clay.locator('[data-card-venue]').textContent(), /Studio No\. 4/, 'card shows venue');
    assert.match(await clay.textContent(), /10:00/, 'card shows start time');
    assert.equal(await clay.locator('[data-card-topic]').textContent(), 'Arts', 'card shows topic');

    // Reset filters back to the full catalogue.
    await page.click('[data-reset-filters]');
    await page.locator('[data-event-card="sample-jazz"]').waitFor();
    assert.equal(await cards.count(), 12, 'reset restores the full catalogue');

    // --- Browse by topic --------------------------------------------------
    // Topic "Music" holds exactly two fixtures: sample-jazz + sample-synth.
    await page.click('[data-topic-chip="Music"]');
    await page.locator('[data-event-card="sample-synth"]').waitFor();
    assert.equal(await cards.count(), 2, 'topic filter narrows to two events');
    assert.equal(await page.locator('[data-event-card="sample-jazz"]').count(), 1, 'jazz is Music');
    assert.equal(await page.locator('[data-event-card="sample-code"]').count(), 0, 'tech excluded');
    assert.equal(
      await page.locator('[data-topic-chip="Music"]').getAttribute('aria-pressed'),
      'true',
      'active topic chip is pressed',
    );

    // --- Open event details ----------------------------------------------
    await page.click('[data-open-details="sample-jazz"]');
    const details = page.locator('[data-details="sample-jazz"]');
    await details.waitFor();
    assert.equal(await cards.count(), 0, 'grid is replaced by the details view');
    assert.match(await details.locator('[data-details-title]').textContent(), /Jazz in the courtyard/, 'details title');
    assert.match(await details.locator('[data-details-venue]').textContent(), /Juniper Courtyard/, 'details venue');
    assert.match(await details.locator('[data-details-description]').textContent(), /Synthetic sample only/, 'details description');
    assert.equal(await details.locator('[data-details-date]').count(), 1, 'details show the date/time');

    // The details favourite toggle must sit within the details card (normal
    // flow), not escape to the initial containing block via position:absolute.
    const detailsFav = details.locator('[data-fav-toggle="sample-jazz"]');
    const detailsCard = details.locator('.event-details__card');
    const favBox = await detailsFav.boundingBox();
    const cardBox = await detailsCard.boundingBox();
    assert.ok(favBox && cardBox, 'details favourite and card are laid out');
    assert.ok(
      favBox.x >= cardBox.x - 1
      && favBox.y >= cardBox.y - 1
      && favBox.x + favBox.width <= cardBox.x + cardBox.width + 1
      && favBox.y + favBox.height <= cardBox.y + cardBox.height + 1,
      'details favourite toggle is positioned within the details card',
    );

    // Back returns to the (still topic-filtered) grid.
    await page.click('[data-details-back]');
    await page.locator('[data-event-card="sample-jazz"]').waitFor();
    assert.equal(await cards.count(), 2, 'back restores the filtered grid');

    // --- Favourite toggle calls the store and reflects has()/toggle() -----
    const favJazz = page.locator('[data-fav-toggle="sample-jazz"]');
    assert.equal(await favJazz.getAttribute('aria-pressed'), 'false', 'starts unsaved');
    assert.equal(await page.evaluate(() => window.__storeHas('sample-jazz')), false, 'store starts without the id');

    // The toggle must be reachable in the accessibility tree by role + name,
    // not just by data-attribute. (Catches the button being aria-hidden.)
    const saveByRole = page.getByRole('button', { name: /^save .*jazz in the courtyard.* to favourites$/i });
    await saveByRole.waitFor();
    assert.equal(await saveByRole.getAttribute('aria-pressed'), 'false', 'a11y: save button starts unpressed');

    const togglesBefore = await page.evaluate(() => window.__calls.toggle);
    await favJazz.click();
    // The injected store's toggle() was actually invoked...
    assert.equal(await page.evaluate(() => window.__calls.toggle), togglesBefore + 1, 'click calls store.toggle once');
    // ...the store now holds the id...
    assert.equal(await page.evaluate(() => window.__storeHas('sample-jazz')), true, 'store membership added');
    // ...and the control reflects the store's new membership.
    assert.equal(await favJazz.getAttribute('aria-pressed'), 'true', 'toggle reflects saved state');
    assert.match(await favJazz.locator('[data-fav-state="sample-jazz"]').textContent(), /saved/i, 'label reflects saved');

    // After toggling, the button is still exposed to AT: its accessible name
    // flips to the remove phrasing and its pressed state reads true.
    const removeByRole = page.getByRole('button', { name: /^remove .*jazz in the courtyard.* from favourites$/i });
    await removeByRole.waitFor();
    assert.equal(await removeByRole.getAttribute('aria-pressed'), 'true', 'a11y: remove button is pressed');

    // Toggling again removes it and the UI reflects has()===false again.
    await favJazz.click();
    assert.equal(await page.evaluate(() => window.__storeHas('sample-jazz')), false, 'store membership removed');
    assert.equal(await favJazz.getAttribute('aria-pressed'), 'false', 'toggle reflects unsaved state');

    // An EXTERNAL store change (not via the UI) must also be reflected, proving
    // the control renders from the injected store's has(), not local state.
    await page.evaluate(() => window.__store.toggle('sample-synth'));
    await page.locator('[data-fav-toggle="sample-synth"][aria-pressed="true"]').waitFor();
    assert.equal(
      await page.locator('[data-fav-toggle="sample-synth"]').getAttribute('aria-pressed'),
      'true',
      'external store change is reflected in the UI',
    );

    assert.deepEqual(consoleErrors, [], 'no uncaught page errors');
    console.log('✔ browse browser test passed: date + topic browsing, details, and store-backed favourite toggle');
  } catch (err) {
    failed = true;
    console.error('✖ browse browser test failed:', err && err.stack ? err.stack : err);
  } finally {
    await browser.close();
    server.close();
  }
  process.exit(failed ? 1 : 0);
}

main();
