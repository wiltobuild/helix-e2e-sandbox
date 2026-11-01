import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MS_PER_DAY,
  DUE_STATES,
  normalizeInterval,
  nextDueDate,
  daysUntilDue,
  dueState,
  evaluatePlant,
} from '../src/plant-logic.js';

// All dates are built with local-time constructors (new Date(y, m, d, ...)) so
// the calendar-day comparisons in the logic are deterministic regardless of the
// machine's timezone.

test('nextDueDate adds whole days to the last-watered instant', () => {
  const lastWatered = new Date(2026, 0, 10, 9, 0, 0); // Jan 10 2026, 09:00 local
  const due = nextDueDate(lastWatered, 7);
  assert.equal(due.getTime(), lastWatered.getTime() + 7 * MS_PER_DAY);
  assert.equal(due.getFullYear(), 2026);
  assert.equal(due.getMonth(), 0);
  assert.equal(due.getDate(), 17);
});

test('nextDueDate works with a 1-day interval (minimum boundary)', () => {
  const lastWatered = new Date(2026, 2, 1, 8, 30, 0);
  const due = nextDueDate(lastWatered, 1);
  assert.equal(due.getTime(), lastWatered.getTime() + MS_PER_DAY);
});

test('nextDueDate accepts ISO strings and millisecond timestamps', () => {
  const iso = new Date(2026, 5, 1, 12, 0, 0).toISOString();
  const fromIso = nextDueDate(iso, 3);
  const fromMs = nextDueDate(new Date(iso).getTime(), 3);
  assert.equal(fromIso.getTime(), fromMs.getTime());
});

test('normalizeInterval rejects non-integer and sub-1 values', () => {
  assert.equal(normalizeInterval(1), 1);
  assert.equal(normalizeInterval(30), 30);
  assert.throws(() => normalizeInterval(0), RangeError);
  assert.throws(() => normalizeInterval(-3), RangeError);
  assert.throws(() => normalizeInterval(2.5), RangeError);
  assert.throws(() => normalizeInterval('7'), RangeError);
});

test('nextDueDate rejects an invalid interval', () => {
  assert.throws(() => nextDueDate(new Date(2026, 0, 1), 0), RangeError);
});

test('classifies a plant watered today as upcoming (not yet due)', () => {
  const now = new Date(2026, 0, 10, 10, 0, 0);
  const lastWatered = new Date(2026, 0, 10, 8, 0, 0); // same day
  const { state, nextDue } = evaluatePlant({ lastWatered, intervalDays: 7 }, now);
  assert.equal(state, DUE_STATES.UPCOMING);
  assert.equal(nextDue.getDate(), 17);
});

test('classifies as due today when next-due lands on today', () => {
  const now = new Date(2026, 0, 17, 14, 0, 0);
  const lastWatered = new Date(2026, 0, 10, 8, 0, 0); // +7 days => Jan 17
  const { state } = evaluatePlant({ lastWatered, intervalDays: 7 }, now);
  assert.equal(state, DUE_STATES.DUE_TODAY);
});

test('due today holds regardless of the time of day within that day', () => {
  const lastWatered = new Date(2026, 0, 10, 8, 0, 0); // due Jan 17
  const earlyMorning = new Date(2026, 0, 17, 0, 1, 0);
  const lateNight = new Date(2026, 0, 17, 23, 59, 0);
  assert.equal(dueState(nextDueDate(lastWatered, 7), earlyMorning), DUE_STATES.DUE_TODAY);
  assert.equal(dueState(nextDueDate(lastWatered, 7), lateNight), DUE_STATES.DUE_TODAY);
});

test('classifies as overdue once the due day has passed', () => {
  const now = new Date(2026, 0, 20, 9, 0, 0);
  const lastWatered = new Date(2026, 0, 10, 8, 0, 0); // due Jan 17, now Jan 20
  const { state, daysUntil } = evaluatePlant({ lastWatered, intervalDays: 7 }, now);
  assert.equal(state, DUE_STATES.OVERDUE);
  assert.equal(daysUntil, -3);
});

test('interval boundary: watered yesterday with interval 1 is due today', () => {
  const now = new Date(2026, 3, 15, 9, 0, 0);
  const lastWatered = new Date(2026, 3, 14, 18, 0, 0); // +1 day => Apr 15
  assert.equal(
    dueState(nextDueDate(lastWatered, 1), now),
    DUE_STATES.DUE_TODAY,
  );
});

test('interval boundary: watered today with interval 1 is upcoming', () => {
  const now = new Date(2026, 3, 14, 9, 0, 0);
  const lastWatered = new Date(2026, 3, 14, 6, 0, 0); // +1 day => Apr 15
  assert.equal(
    dueState(nextDueDate(lastWatered, 1), now),
    DUE_STATES.UPCOMING,
  );
});

test('interval boundary: watered two days ago with interval 1 is overdue', () => {
  const now = new Date(2026, 3, 16, 9, 0, 0);
  const lastWatered = new Date(2026, 3, 14, 6, 0, 0); // due Apr 15, now Apr 16
  assert.equal(
    dueState(nextDueDate(lastWatered, 1), now),
    DUE_STATES.OVERDUE,
  );
});

test('daysUntilDue counts whole calendar days ahead', () => {
  const now = new Date(2026, 0, 10, 23, 0, 0);
  const nextDue = new Date(2026, 0, 13, 1, 0, 0);
  assert.equal(daysUntilDue(nextDue, now), 3);
});
