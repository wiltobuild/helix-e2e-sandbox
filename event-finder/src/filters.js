import { TOPICS } from './events.js';

/** Validate a calendar date without timezone conversion or clock access. */
function isISODate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1];
}

/** @param {unknown} event @returns {event is import('./events.js').Event} */
export function validateEvent(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) return false;
  return ['id', 'title', 'description', 'startTime', 'venue'].every(
    (key) => typeof event[key] === 'string' && event[key].trim().length > 0,
  ) && event.synthetic === true && TOPICS.includes(event.topic) && isISODate(event.date);
}

/**
 * @typedef {Object} EventFilters
 * @property {string | null} [date]
 * @property {string | null} [topic]
 * @property {boolean} [favouritesOnly]
 * @property {ReadonlyArray<string> | ReadonlySet<string>} [favouriteIds]
 */

/**
 * Return a new array sorted by ascending date; ties preserve input order.
 * Empty/null/omitted date and topic mean all. Invalid dates or unknown topics
 * match nothing. Invalid event records are excluded. Neither input is mutated.
 * @param {ReadonlyArray<import('./events.js').Event>} events
 * @param {EventFilters | null} [filters]
 * @returns {import('./events.js').Event[]}
 */
export function filterEvents(events, filters = {}) {
  const { date, topic, favouritesOnly, favouriteIds } = filters ?? {};
  const hasDate = date != null && date !== '';
  const hasTopic = topic != null && topic !== '';
  if ((hasDate && !isISODate(date)) || (hasTopic && !TOPICS.includes(topic))) return [];
  const ids = new Set(Array.isArray(favouriteIds) || favouriteIds instanceof Set ? favouriteIds : []);
  return (Array.isArray(events) ? events : [])
    .filter((event) => validateEvent(event)
      && (!hasDate || event.date === date)
      && (!hasTopic || event.topic === topic)
      && (!favouritesOnly || ids.has(event.id)))
    .sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
}

/** Return distinct valid dates in ascending order. @param {ReadonlyArray<import('./events.js').Event>} events */
export function availableDates(events) {
  return [...new Set(filterEvents(events).map((event) => event.date))];
}

/** Return represented topics in TOPICS order. @param {ReadonlyArray<import('./events.js').Event>} events */
export function availableTopics(events) {
  const present = new Set(filterEvents(events).map((event) => event.topic));
  return TOPICS.filter((topic) => present.has(topic));
}
