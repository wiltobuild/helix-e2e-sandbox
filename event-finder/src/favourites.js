export const FAVOURITES_STORAGE_KEY = 'event-finder:favourites:v1';

/**
 * Create a synchronous favourites store. Pass { storage: null } for memory only,
 * or inject a Storage-compatible object. By default, use browser localStorage.
 * Invalid stored payloads are ignored; duplicate stored IDs retain first order.
 * @param {{ storage?: Pick<Storage, 'getItem' | 'setItem'> | null }} [options]
 * @returns {import('./events.js').FavouritesStore}
 */
export function createFavouritesStore(options = {}) {
  let storage;
  let ids = new Set();
  const subscribers = new Set();

  try {
    storage = options.storage === undefined ? globalThis.localStorage : options.storage;
    const saved = JSON.parse(storage?.getItem(FAVOURITES_STORAGE_KEY) ?? 'null');
    if (Array.isArray(saved) && saved.every((id) => typeof id === 'string')) {
      ids = new Set(saved);
    }
  } catch {
    // Missing, corrupt, or blocked storage must not prevent in-memory use.
  }

  function requireId(id) {
    if (typeof id !== 'string') throw new TypeError('Favourite IDs must be strings');
  }

  function changed() {
    const snapshot = [...ids];
    try {
      storage?.setItem(FAVOURITES_STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      // Quota errors and sandbox restrictions leave the in-memory state intact.
    }
    for (const callback of [...subscribers]) callback([...snapshot]);
  }

  return {
    has(id) {
      return ids.has(id);
    },
    add(id) {
      requireId(id);
      if (ids.has(id)) return;
      ids.add(id);
      changed();
    },
    remove(id) {
      if (ids.delete(id)) changed();
    },
    toggle(id) {
      requireId(id);
      const saved = !ids.has(id);
      if (saved) ids.add(id);
      else ids.delete(id);
      changed();
      return saved;
    },
    list() {
      return [...ids];
    },
    subscribe(callback) {
      if (typeof callback !== 'function') throw new TypeError('Subscriber must be a function');
      subscribers.add(callback);
      let active = true;
      return () => {
        if (!active) return;
        active = false;
        subscribers.delete(callback);
      };
    },
    clear() {
      if (!ids.size) return;
      ids.clear();
      changed();
    },
  };
}
