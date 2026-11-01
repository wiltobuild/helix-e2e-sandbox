// Pure, deterministic watering logic.
//
// This module must NOT touch the DOM or localStorage and must NOT call
// Date.now()/new Date() with no argument. All "current time" values are passed
// in as arguments so the functions are deterministic and easy to unit test.

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const DUE_STATES = Object.freeze({
  OVERDUE: 'overdue',
  DUE_TODAY: 'due today',
  UPCOMING: 'upcoming',
});

/**
 * Coerce a Date | number (ms) | ISO string into a millisecond timestamp.
 * @param {Date|number|string} value
 * @returns {number}
 */
function toTime(value) {
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (Number.isNaN(ms)) {
    throw new TypeError(`Invalid date value: ${String(value)}`);
  }
  return ms;
}

/**
 * Validate a watering interval: a whole number of days >= 1.
 * @param {number} intervalDays
 * @returns {number}
 */
export function normalizeInterval(intervalDays) {
  if (!Number.isInteger(intervalDays) || intervalDays < 1) {
    throw new RangeError('intervalDays must be a whole number >= 1');
  }
  return intervalDays;
}

/**
 * Return the start-of-day (local midnight) Date for the given instant.
 * @param {Date|number|string} value
 * @returns {Date}
 */
export function startOfDay(value) {
  const d = new Date(toTime(value));
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Compute the next due date from the last-watered instant plus the interval.
 * @param {Date|number|string} lastWatered
 * @param {number} intervalDays whole days >= 1
 * @returns {Date} next due date
 */
export function nextDueDate(lastWatered, intervalDays) {
  const interval = normalizeInterval(intervalDays);
  return new Date(toTime(lastWatered) + interval * MS_PER_DAY);
}

/**
 * Whole calendar days from `now` until `nextDue` (negative when overdue).
 * Compared on calendar-day boundaries so a time-of-day difference within the
 * same day counts as 0.
 * @param {Date|number|string} nextDue
 * @param {Date|number|string} now
 * @returns {number}
 */
export function daysUntilDue(nextDue, now) {
  const diff = startOfDay(nextDue).getTime() - startOfDay(now).getTime();
  return Math.round(diff / MS_PER_DAY);
}

/**
 * Classify a plant's due-state relative to `now`, compared by calendar day.
 * @param {Date|number|string} nextDue
 * @param {Date|number|string} now
 * @returns {'overdue'|'due today'|'upcoming'}
 */
export function dueState(nextDue, now) {
  const delta = daysUntilDue(nextDue, now);
  if (delta < 0) return DUE_STATES.OVERDUE;
  if (delta === 0) return DUE_STATES.DUE_TODAY;
  return DUE_STATES.UPCOMING;
}

/**
 * Convenience: compute next-due date and due-state for a plant in one call.
 * @param {{lastWatered: Date|number|string, intervalDays: number}} plant
 * @param {Date|number|string} now
 * @returns {{nextDue: Date, state: string, daysUntil: number}}
 */
export function evaluatePlant(plant, now) {
  const nextDue = nextDueDate(plant.lastWatered, plant.intervalDays);
  return {
    nextDue,
    state: dueState(nextDue, now),
    daysUntil: daysUntilDue(nextDue, now),
  };
}
