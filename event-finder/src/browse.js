/**
 * Browse UI for the synthetic event finder.
 *
 * Pure render helpers plus a thin `mountBrowse` controller. Rendering is driven
 * entirely by `filterEvents` / `availableDates` / `availableTopics` from the
 * foundation contract; nothing here reads the clock, the network, or storage.
 *
 * Favourites are NOT persisted here. The caller injects a FavouritesStore
 * (see the typedef in ./events.js) and this module only reflects `has()` and
 * calls `toggle()` on click, re-rendering from the store's reported state.
 */
import { filterEvents, availableDates, availableTopics } from './filters.js';

/**
 * @typedef {Object} BrowseState
 * @property {string} date   Selected ISO date, or '' for all dates.
 * @property {string} topic  Selected topic, or '' for all topics.
 * @property {string|null} selectedId  Event id whose details are open, or null.
 */

/** @returns {BrowseState} A fresh default state: no filters, no details open. */
export function createBrowseState() {
  return { date: '', topic: '', selectedId: null };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Format an ISO `YYYY-MM-DD` date for display without touching the clock or
 * locale. Uses Date.UTC purely as deterministic calendar arithmetic so the
 * weekday is stable regardless of the machine timezone.
 * @param {string} iso
 * @returns {string} e.g. "Thu · Nov 6"
 */
export function formatEventDate(iso) {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [year, month, day] = iso.split('-').map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return `${weekday} · ${MONTHS[month - 1]} ${day}`;
}

/** Small hyperscript-style element builder. @returns {HTMLElement} */
function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'html') node.innerHTML = value;
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of [].concat(children)) {
    if (child == null) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

/**
 * The events visible for the current filter state. Delegates every filtering
 * decision to `filterEvents` so browse stays consistent with the contract.
 * @param {ReadonlyArray<import('./events.js').Event>} events
 * @param {BrowseState} state
 */
export function visibleEvents(events, state) {
  return filterEvents(events, { date: state.date || null, topic: state.topic || null });
}

/**
 * Render a favourite toggle that reflects the injected store's membership.
 * The click is wired by the mount layer via delegation on `data-fav-toggle`.
 * @param {import('./events.js').Event} event
 * @param {import('./events.js').FavouritesStore} store
 */
export function renderFavouriteToggle(event, store) {
  const saved = store.has(event.id);
  return el('button', {
    type: 'button',
    class: 'fav-toggle',
    'data-fav-toggle': event.id,
    'aria-pressed': saved ? 'true' : 'false',
    'aria-label': `${saved ? 'Remove' : 'Save'} ${event.title} ${saved ? 'from' : 'to'} favourites`,
    title: saved ? 'Saved to favourites' : 'Save to favourites',
  }, [
    el('span', { class: 'fav-toggle__icon', 'aria-hidden': 'true', text: saved ? '♥' : '♡' }),
    el('span', { class: 'fav-toggle__state', 'data-fav-state': event.id, text: saved ? 'Saved' : 'Save' }),
  ]);
}

/**
 * Render a single event card: synthetic title, venue, date, start time, topic,
 * a favourite toggle and a details affordance.
 * @param {import('./events.js').Event} event
 * @param {import('./events.js').FavouritesStore} store
 */
export function renderCard(event, store) {
  return el('article', {
    class: 'event-card',
    'data-event-card': event.id,
    'data-topic': event.topic,
  }, [
    el('div', { class: 'event-card__media', 'aria-hidden': 'true' }, [
      el('span', { class: 'event-card__badge', text: 'Demo event' }),
      el('span', { class: 'event-card__glyph', text: event.topic.charAt(0) }),
      renderFavouriteToggle(event, store),
    ]),
    el('div', { class: 'event-card__body' }, [
      el('p', { class: 'event-card__topic', 'data-card-topic': event.topic, text: event.topic }),
      el('h3', { class: 'event-card__title', 'data-card-title': '', text: event.title }),
      el('dl', { class: 'event-card__meta' }, [
        el('div', { class: 'event-card__meta-row' }, [
          el('dt', { text: 'When' }),
          el('dd', { 'data-card-date': event.date }, `${formatEventDate(event.date)} · ${event.startTime}`),
        ]),
        el('div', { class: 'event-card__meta-row' }, [
          el('dt', { text: 'Where' }),
          el('dd', { 'data-card-venue': '', text: event.venue }),
        ]),
      ]),
      el('button', {
        type: 'button',
        class: 'event-card__details-link',
        'data-open-details': event.id,
      }, ['View details', el('span', { 'aria-hidden': 'true', text: ' ↗' })]),
    ]),
  ]);
}

/**
 * Render the responsive filter bar: a date select driven by availableDates and
 * a topic chip group driven by availableTopics, plus a live result count.
 * @param {ReadonlyArray<import('./events.js').Event>} events
 * @param {BrowseState} state
 * @param {number} count number of events currently visible
 */
export function renderFilterBar(events, state, count) {
  const dates = availableDates(events);
  const topics = availableTopics(events);

  const dateSelect = el('select', {
    class: 'filter-bar__select',
    id: 'filter-date',
    'data-filter-date': '',
    'aria-label': 'Filter by date',
  }, [
    el('option', { value: '', ...(state.date ? {} : { selected: true }), text: 'Any date' }),
    ...dates.map((date) => el('option', {
      value: date,
      ...(state.date === date ? { selected: true } : {}),
      text: formatEventDate(date),
    })),
  ]);

  const chip = (value, label) => el('button', {
    type: 'button',
    class: 'topic-chip',
    'data-topic-chip': value,
    'aria-pressed': (state.topic || '') === value ? 'true' : 'false',
  }, label);

  const topicChips = el('div', {
    class: 'filter-bar__chips',
    role: 'group',
    'aria-label': 'Filter by topic',
    'data-topic-chips': '',
  }, [chip('', 'All topics'), ...topics.map((topic) => chip(topic, topic))]);

  return el('form', {
    class: 'filter-bar',
    'data-filter-bar': '',
  }, [
    el('div', { class: 'filter-bar__head' }, [
      el('div', { class: 'filter-bar__field' }, [
        el('label', { class: 'filter-bar__label', for: 'filter-date', text: 'Date' }),
        dateSelect,
      ]),
      el('p', { class: 'filter-bar__count', 'data-result-count': '', 'aria-live': 'polite' },
        `${count} ${count === 1 ? 'demo event' : 'demo events'}`),
      el('button', { type: 'button', class: 'filter-bar__reset', 'data-reset-filters': '', text: 'Reset filters' }),
    ]),
    topicChips,
  ]);
}

/**
 * Render the grid of cards, or an empty-state when nothing matches.
 * @param {ReadonlyArray<import('./events.js').Event>} visible
 * @param {import('./events.js').FavouritesStore} store
 */
export function renderGrid(visible, store) {
  if (visible.length === 0) {
    return el('div', { class: 'event-empty', 'data-empty': '' }, [
      el('p', { class: 'event-empty__title', text: 'No demo events match those filters.' }),
      el('p', { class: 'event-empty__hint', text: 'Try a different date or topic, or reset the filters.' }),
    ]);
  }
  return el('div', { class: 'event-grid', 'data-event-grid': '' },
    visible.map((event) => renderCard(event, store)));
}

/**
 * Render the single-event details view.
 * @param {import('./events.js').Event} event
 * @param {import('./events.js').FavouritesStore} store
 */
export function renderDetails(event, store) {
  return el('section', {
    class: 'event-details',
    'data-details': event.id,
    'aria-label': 'Event details',
  }, [
    el('button', { type: 'button', class: 'event-details__back', 'data-details-back': '' },
      [el('span', { 'aria-hidden': 'true', text: '← ' }), 'Back to all events']),
    el('div', { class: 'event-details__card' }, [
      el('div', { class: 'event-details__head' }, [
        el('span', { class: 'event-details__badge', text: 'Demo event' }),
        el('p', { class: 'event-details__topic', 'data-details-topic': event.topic, text: event.topic }),
        el('h2', { class: 'event-details__title', 'data-details-title': '', text: event.title }),
      ]),
      el('dl', { class: 'event-details__meta' }, [
        el('div', {}, [el('dt', { text: 'When' }),
          el('dd', { 'data-details-date': event.date }, `${formatEventDate(event.date)} · ${event.startTime}`)]),
        el('div', {}, [el('dt', { text: 'Where' }),
          el('dd', { 'data-details-venue': '', text: event.venue })]),
        el('div', {}, [el('dt', { text: 'Topic' }),
          el('dd', { text: event.topic })]),
      ]),
      el('p', { class: 'event-details__description', 'data-details-description': '', text: event.description }),
      el('div', { class: 'event-details__actions' }, [renderFavouriteToggle(event, store)]),
    ]),
  ]);
}

/**
 * Pure top-level render: given events, store and state, return the full browse
 * tree. The caller (mountBrowse) swaps this into the root on every change.
 * @param {ReadonlyArray<import('./events.js').Event>} events
 * @param {import('./events.js').FavouritesStore} store
 * @param {BrowseState} state
 */
export function renderBrowse(events, store, state) {
  const root = el('div', { class: 'browse', 'data-browse': '' });

  const selected = state.selectedId
    ? filterEvents(events).find((event) => event.id === state.selectedId)
    : null;

  if (selected) {
    root.append(renderDetails(selected, store));
    return root;
  }

  const visible = visibleEvents(events, state);
  root.append(
    renderFilterBar(events, state, visible.length),
    renderGrid(visible, store),
  );
  return root;
}

/**
 * Mount the browse UI into `root` and wire interaction. Returns a small
 * controller. Filtering goes through `filterEvents`; favourites go through the
 * injected store (no persistence here). If the store exposes `subscribe`, the
 * UI re-renders on external membership changes too.
 *
 * @param {HTMLElement} root
 * @param {{events: ReadonlyArray<import('./events.js').Event>, store: import('./events.js').FavouritesStore, state?: BrowseState}} options
 * @returns {{ getState: () => BrowseState, setState: (patch: Partial<BrowseState>) => void, refresh: () => void, destroy: () => void }}
 */
export function mountBrowse(root, { events, store, state = createBrowseState() }) {
  let current = { ...state };

  const refresh = () => {
    root.replaceChildren(renderBrowse(events, store, current));
  };

  const setState = (patch) => {
    current = { ...current, ...patch };
    refresh();
  };

  const onClick = (event) => {
    const fav = event.target.closest('[data-fav-toggle]');
    if (fav && root.contains(fav)) {
      store.toggle(fav.getAttribute('data-fav-toggle'));
      refresh();
      return;
    }
    const open = event.target.closest('[data-open-details]');
    if (open && root.contains(open)) {
      setState({ selectedId: open.getAttribute('data-open-details') });
      return;
    }
    if (event.target.closest('[data-details-back]')) {
      setState({ selectedId: null });
      return;
    }
    const chip = event.target.closest('[data-topic-chip]');
    if (chip && root.contains(chip)) {
      setState({ topic: chip.getAttribute('data-topic-chip') });
      return;
    }
    if (event.target.closest('[data-reset-filters]')) {
      setState({ date: '', topic: '' });
    }
  };

  const onChange = (event) => {
    const dateControl = event.target.closest('[data-filter-date]');
    if (dateControl && root.contains(dateControl)) {
      setState({ date: dateControl.value });
    }
  };

  root.addEventListener('click', onClick);
  root.addEventListener('change', onChange);

  const unsubscribe = typeof store.subscribe === 'function'
    ? store.subscribe(() => refresh())
    : null;

  refresh();

  return {
    getState: () => ({ ...current }),
    setState,
    refresh,
    destroy() {
      root.removeEventListener('click', onClick);
      root.removeEventListener('change', onChange);
      if (typeof unsubscribe === 'function') unsubscribe();
      root.replaceChildren();
    },
  };
}
