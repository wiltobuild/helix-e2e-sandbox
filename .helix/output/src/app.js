// UI wiring + persistence. Imports the pure logic module for all date math.
import {
  evaluatePlant,
  normalizeInterval,
  DUE_STATES,
} from './plant-logic.js';

const STORAGE_KEY = 'plant-watering-tracker/v1';

// ---------------------------------------------------------------------------
// Storage (guarded so the page still renders when storage is unavailable, e.g.
// the Live Output preview disables persistent storage).
// ---------------------------------------------------------------------------

function storageAvailable() {
  try {
    const probe = '__pwt_probe__';
    window.localStorage.setItem(probe, probe);
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

const HAS_STORAGE = storageAvailable();

function loadPlants() {
  if (!HAS_STORAGE) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidPlant);
  } catch {
    return [];
  }
}

function savePlants(plants) {
  if (!HAS_STORAGE) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(plants));
  } catch {
    // Ignore write failures (quota, private mode) — in-memory state stays live.
  }
}

function isValidPlant(p) {
  return (
    p &&
    typeof p.name === 'string' &&
    Number.isInteger(p.intervalDays) &&
    p.intervalDays >= 1 &&
    typeof p.lastWatered === 'string'
  );
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let plants = loadPlants();

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  return `plant-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function addPlant(name, intervalDays, now) {
  const plant = {
    id: createId(),
    name: name.trim(),
    intervalDays: normalizeInterval(intervalDays),
    lastWatered: now.toISOString(),
  };
  plants = [...plants, plant];
  savePlants(plants);
  return plant;
}

function waterPlant(id, now) {
  plants = plants.map((p) =>
    p.id === id ? { ...p, lastWatered: now.toISOString() } : p,
  );
  savePlants(plants);
}

function removePlant(id) {
  plants = plants.filter((p) => p.id !== id);
  savePlants(plants);
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

const els = {};

const STATE_LABEL = {
  [DUE_STATES.OVERDUE]: 'Overdue',
  [DUE_STATES.DUE_TODAY]: 'Due today',
  [DUE_STATES.UPCOMING]: 'Upcoming',
};

function formatDate(date) {
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function describeDays(daysUntil) {
  if (daysUntil === 0) return 'today';
  if (daysUntil === 1) return 'in 1 day';
  if (daysUntil > 1) return `in ${daysUntil} days`;
  if (daysUntil === -1) return '1 day ago';
  return `${Math.abs(daysUntil)} days ago`;
}

function render(now = new Date()) {
  const list = els.list;
  list.textContent = '';

  els.empty.hidden = plants.length > 0;

  for (const plant of plants) {
    const { nextDue, state, daysUntil } = evaluatePlant(plant, now);

    const li = document.createElement('li');
    li.className = `plant plant--${state.replace(/\s+/g, '-')}`;
    li.dataset.plantId = plant.id;

    const info = document.createElement('div');
    info.className = 'plant__info';

    const name = document.createElement('h3');
    name.className = 'plant__name';
    name.textContent = plant.name;

    const meta = document.createElement('p');
    meta.className = 'plant__meta';
    meta.textContent = `Every ${plant.intervalDays} day${plant.intervalDays === 1 ? '' : 's'}`;

    const due = document.createElement('p');
    due.className = 'plant__due';
    due.textContent = `Next due ${formatDate(nextDue)} (${describeDays(daysUntil)})`;

    const badge = document.createElement('span');
    badge.className = `badge badge--${state.replace(/\s+/g, '-')}`;
    badge.textContent = STATE_LABEL[state];
    badge.dataset.state = state;

    info.append(name, meta, due, badge);

    const actions = document.createElement('div');
    actions.className = 'plant__actions';

    const waterBtn = document.createElement('button');
    waterBtn.type = 'button';
    waterBtn.className = 'btn btn--water';
    waterBtn.textContent = 'Mark watered';
    waterBtn.addEventListener('click', () => {
      waterPlant(plant.id, new Date());
      render();
    });

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn btn--remove';
    removeBtn.setAttribute('aria-label', `Remove ${plant.name}`);
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => {
      removePlant(plant.id);
      render();
    });

    actions.append(waterBtn, removeBtn);
    li.append(info, actions);
    list.append(li);
  }
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

function init() {
  els.form = document.getElementById('add-form');
  els.name = document.getElementById('plant-name');
  els.interval = document.getElementById('plant-interval');
  els.list = document.getElementById('plant-list');
  els.empty = document.getElementById('empty-state');
  els.error = document.getElementById('form-error');
  els.storageNote = document.getElementById('storage-note');

  if (!HAS_STORAGE && els.storageNote) {
    els.storageNote.hidden = false;
  }

  els.form.addEventListener('submit', (event) => {
    event.preventDefault();
    els.error.textContent = '';

    const name = els.name.value.trim();
    const intervalDays = Number(els.interval.value);

    if (!name) {
      els.error.textContent = 'Please enter a plant name.';
      return;
    }
    if (!Number.isInteger(intervalDays) || intervalDays < 1) {
      els.error.textContent = 'Interval must be a whole number of days (1 or more).';
      return;
    }

    addPlant(name, intervalDays, new Date());
    els.form.reset();
    els.name.focus();
    render();
  });

  render();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}
