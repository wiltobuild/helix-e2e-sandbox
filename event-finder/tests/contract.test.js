import test from 'node:test';
import assert from 'node:assert/strict';
import { TOPICS } from '../src/events.js';
import { EVENTS } from '../src/fixtures.js';
import { validateEvent } from '../src/filters.js';

test('fixtures are valid, uniquely identified, clearly synthetic and cover every topic', () => {
  assert.ok(Object.isFrozen(TOPICS));
  assert.equal(new Set(TOPICS).size, TOPICS.length);
  assert.ok(EVENTS.length >= 12 && EVENTS.length <= 16);
  assert.equal(new Set(EVENTS.map((event) => event.id)).size, EVENTS.length);
  assert.ok(new Set(EVENTS.map((event) => event.date)).size > 1);
  assert.deepEqual(new Set(EVENTS.map((event) => event.topic)), new Set(TOPICS));
  for (const event of EVENTS) {
    assert.equal(validateEvent(event), true, event.id);
    assert.ok(TOPICS.includes(event.topic));
    assert.equal(event.synthetic, true);
    assert.match(event.title, /synthetic sample/i);
    assert.match(event.venue, /sample/i);
  }
});

test('validation rejects malformed shapes and unsupported topics', () => {
  for (const value of [null, undefined, false, [], {}, 'event']) {
    assert.equal(validateEvent(value), false);
  }
  for (const key of ['id', 'title', 'description', 'startTime', 'venue']) {
    for (const value of ['', '  ', null, 123]) {
      assert.equal(validateEvent({ ...EVENTS[0], [key]: value }), false, key);
    }
  }
  assert.equal(validateEvent({ ...EVENTS[0], topic: 'Unknown' }), false);
  assert.equal(validateEvent({ ...EVENTS[0], synthetic: false }), false);
  assert.equal(validateEvent({ ...EVENTS[0], synthetic: 'true' }), false);
});

test('ISO dates must be real calendar dates including century leap rules', () => {
  for (const date of ['2024-02-29', '2000-02-29', '2026-11-30']) {
    assert.equal(validateEvent({ ...EVENTS[0], date }), true, date);
  }
  for (const date of ['2025-02-29', '1900-02-29', '2026-04-31', '2026-13-01',
    '2026-00-01', '2026-01-00', '2026-1-01', '0000-01-01',
    '2026-11-01T00:00:00Z', 'invalid', '', null, 20261101]) {
    assert.equal(validateEvent({ ...EVENTS[0], date }), false, String(date));
  }
});
