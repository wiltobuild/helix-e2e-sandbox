/** @typedef {'Music' | 'Food' | 'Tech' | 'Arts' | 'Outdoors' | 'Community'} Topic */

/** @type {ReadonlyArray<Topic>} */
export const TOPICS = Object.freeze(['Music', 'Food', 'Tech', 'Arts', 'Outdoors', 'Community']);

/**
 * A fictional event for the local demo, never a real listing.
 * @typedef {Object} Event
 * @property {string} id Unique, stable identifier.
 * @property {string} title Visibly labeled sample title.
 * @property {string} description
 * @property {string} date Valid calendar date in ISO YYYY-MM-DD format.
 * @property {string} startTime Local display time (fixtures use HH:mm).
 * @property {string} venue Visibly labeled sample venue.
 * @property {Topic} topic One of TOPICS.
 * @property {true} synthetic
 */

/**
 * Shared interface implemented by the favourites package and injected into browse UI.
 * IDs are strings. Mutations are synchronous and idempotent where applicable.
 * list() returns a fresh array of unique IDs in insertion order.
 * Subscribers receive a fresh ID snapshot after each actual membership change;
 * subscribing does not immediately invoke the callback. Unsubscribe is idempotent.
 * clear() removes all IDs and notifies only when membership changes.
 * @typedef {Object} FavouritesStore
 * @property {(id: string) => boolean} has
 * @property {(id: string) => void} add
 * @property {(id: string) => void} remove
 * @property {(id: string) => boolean} toggle Returns the resulting saved state.
 * @property {() => string[]} list
 * @property {(fn: (ids: string[]) => void) => (() => void)} subscribe
 * @property {() => void} clear
 */
