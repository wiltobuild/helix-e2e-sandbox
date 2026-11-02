import test from 'node:test';
import assert from 'node:assert/strict';
import { EVENTS } from '../src/fixtures.js';
import { TOPICS } from '../src/events.js';
import { filterEvents, availableDates, availableTopics } from '../src/filters.js';

const ids = (events) => events.map((event) => event.id);

test('date, topic and combined filters narrow the fixture catalogue', () => {
  assert.deepEqual(ids(filterEvents(EVENTS, { date: '2026-11-07' })), ['sample-clay', 'sample-code']);
  assert.deepEqual(ids(filterEvents(EVENTS, { topic: 'Music' })), ['sample-jazz', 'sample-synth']);
  assert.deepEqual(ids(filterEvents(EVENTS, { date: '2026-11-07', topic: 'Tech' })), ['sample-code']);
  assert.deepEqual(filterEvents(EVENTS, { date: '2026-11-07', topic: 'Music' }), []);
});

test('favourites accept arrays or sets, combine with filters and ignore stale IDs', () => {
  for (const favouriteIds of [ ['sample-code', 'sample-synth', 'missing'], new Set(['sample-code', 'sample-synth', 'missing']) ]) {
    assert.deepEqual(ids(filterEvents(EVENTS, { favouritesOnly: true, favouriteIds })), ['sample-code', 'sample-synth']);
    assert.deepEqual(ids(filterEvents(EVENTS, { favouritesOnly: true, favouriteIds, date: '2026-11-07', topic: 'Tech' })), ['sample-code']);
  }
  assert.deepEqual(filterEvents(EVENTS, { favouritesOnly: true }), []);
  assert.deepEqual(filterEvents(EVENTS, { favouritesOnly: true, favouriteIds: [] }), []);
  assert.equal(filterEvents(EVENTS, { favouritesOnly: false, favouriteIds: [] }).length, EVENTS.length);
});

test('missing and empty filters return a sorted copy without changing inputs', () => {
  const input = Object.freeze([...EVENTS].reverse().map((event) => Object.freeze({ ...event })));
  const before = [...input];
  for (const filters of [undefined, null, {}, { date: '', topic: '' }, { date: null, topic: null }]) {
    const result = filterEvents(input, filters);
    assert.notEqual(result, input);
    assert.equal(result.length, input.length);
    assert.deepEqual(result.map((event) => event.date), input.map((event) => event.date).sort());
    assert.deepEqual(result.filter((event) => event.date === '2026-11-07'), input.filter((event) => event.date === '2026-11-07'));
  }
  assert.deepEqual(input, before);
});

test('unknown topics, invalid dates and empty results are handled without throwing', () => {
  for (const filters of [{ topic: 'Unknown' }, { topic: 'music' }, { date: '2026-02-30' },
    { date: 'bad-date' }, { date: '2026-13-01' }, { date: '2030-01-01' }]) {
    assert.deepEqual(filterEvents(EVENTS, filters), []);
  }
  assert.deepEqual(filterEvents([]), []);
  assert.deepEqual(filterEvents(undefined), []);
  assert.deepEqual(filterEvents([null, {}, { ...EVENTS[0], date: 'bad' }]), []);
});

test('available options are unique, ordered and limited to valid represented events', () => {
  const subset = [EVENTS[3], EVENTS[0], EVENTS[1], EVENTS[3], null];
  assert.deepEqual(availableDates(subset), ['2026-11-06', '2026-11-07']);
  assert.deepEqual(availableTopics(subset), ['Music', 'Tech', 'Arts']);
  assert.deepEqual(availableTopics(EVENTS), [...TOPICS]);
  assert.deepEqual(availableDates([]), []);
  assert.deepEqual(availableTopics([]), []);
});
