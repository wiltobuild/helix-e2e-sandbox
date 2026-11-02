import test from 'node:test';
import assert from 'node:assert/strict';
import { createFavouritesStore, FAVOURITES_STORAGE_KEY } from '../src/favourites.js';

const memoryStore = () => createFavouritesStore({ storage: null });

function mockStorage(initial = null) {
  const values = new Map(initial === null ? [] : [[FAVOURITES_STORAGE_KEY, initial]]);
  return {
    writes: 0,
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { this.writes++; values.set(key, value); },
  };
}

test('add/remove are idempotent and toggle returns resulting saved state', () => {
  const store = memoryStore();
  assert.equal(store.has('a'), false);
  assert.equal(store.add('a'), undefined);
  store.add('a');
  assert.equal(store.has('a'), true);
  assert.deepEqual(store.list(), ['a']);
  assert.equal(store.remove('a'), undefined);
  store.remove('a');
  assert.deepEqual(store.list(), []);
  assert.equal(store.toggle('a'), true);
  assert.equal(store.has('a'), true);
  assert.equal(store.toggle('a'), false);
  assert.equal(store.has('a'), false);
});

test('list gives independent arrays of unique string IDs in insertion order', () => {
  const store = memoryStore();
  for (const id of ['b', 'a', 'c', 'a']) store.add(id);
  assert.deepEqual(store.list(), ['b', 'a', 'c']);
  const snapshot = store.list();
  snapshot.push('outside');
  store.remove('a');
  store.add('a');
  assert.deepEqual(store.list(), ['b', 'c', 'a']);
  assert.notStrictEqual(store.list(), store.list());
  assert.throws(() => store.add(1), TypeError);
  assert.throws(() => store.toggle(null), TypeError);
  assert.deepEqual(store.list(), ['b', 'c', 'a']);
});

test('subscriptions only deliver fresh snapshots on actual membership changes', () => {
  const storage = mockStorage();
  const store = createFavouritesStore({ storage });
  const received = [];
  store.subscribe((ids) => received.push(ids));
  assert.deepEqual(received, []);
  store.remove('missing');
  store.clear();
  store.add('a');
  store.add('a');
  store.remove('missing');
  store.toggle('b');
  store.toggle('a');
  store.remove('b');
  assert.deepEqual(received, [['a'], ['a', 'b'], ['b'], []]);
  assert.equal(new Set(received).size, 4);
  assert.equal(storage.writes, 4);
  received[0].push('outside');
  assert.deepEqual(store.list(), []);
});

test('duplicate subscriptions are idempotent and stale unsubscribe cannot remove a new subscription', () => {
  const store = memoryStore();
  let calls = 0;
  const callback = () => calls++;
  const unsubscribe = store.subscribe(callback);
  store.subscribe(callback);
  store.add('a');
  assert.equal(calls, 1);
  unsubscribe();
  unsubscribe();
  store.add('b');
  assert.equal(calls, 1);
  const unsubscribeAgain = store.subscribe(callback);
  unsubscribe();
  store.add('c');
  assert.equal(calls, 2);
  unsubscribeAgain();
  store.clear();
  assert.equal(calls, 2);
});

test('each subscriber receives its own snapshot', () => {
  const store = memoryStore();
  store.subscribe((ids) => ids.push('outside'));
  const received = [];
  store.subscribe((ids) => received.push(ids));
  store.add('a');
  assert.deepEqual(received, [['a']]);
  assert.deepEqual(store.list(), ['a']);
});

test('clear removes all IDs, persists empty state, and notifies only once', () => {
  const storage = mockStorage();
  const store = createFavouritesStore({ storage });
  store.add('a');
  store.add('b');
  const received = [];
  store.subscribe((ids) => received.push(ids));
  store.clear();
  store.clear();
  assert.deepEqual(store.list(), []);
  assert.equal(store.has('a'), false);
  assert.equal(store.has('b'), false);
  assert.deepEqual(received, [[]]);
  assert.equal(storage.writes, 3);
  assert.deepEqual(createFavouritesStore({ storage }).list(), []);
});

test('persistence round-trip preserves insertion order under a namespaced key', () => {
  const storage = mockStorage();
  assert.match(FAVOURITES_STORAGE_KEY, /^event-finder:/);
  const store = createFavouritesStore({ storage });
  store.add('b');
  store.add('a');
  store.add('c');
  store.remove('a');
  store.add('a');
  assert.equal(storage.getItem(FAVOURITES_STORAGE_KEY), '["b","c","a"]');
  const restored = createFavouritesStore({ storage });
  assert.deepEqual(restored.list(), ['b', 'c', 'a']);
  assert.equal(restored.has('c'), true);
});

test('missing, corrupt, and invalid stored data are ignored; valid duplicates collapse', () => {
  for (const raw of [null, '', '{broken', 'null', '{}', '42', '"a"', '["a",1]']) {
    const store = createFavouritesStore({ storage: mockStorage(raw) });
    assert.deepEqual(store.list(), []);
    store.add('recovered');
    assert.deepEqual(store.list(), ['recovered']);
  }
  assert.deepEqual(createFavouritesStore({ storage: mockStorage('["b","a","b"]') }).list(), ['b', 'a']);
});

test('throwing storage reads and writes preserve in-memory mutations and notifications', () => {
  const store = createFavouritesStore({ storage: {
    getItem() { throw new Error('blocked read'); },
    setItem() { throw new Error('blocked write'); },
  } });
  const received = [];
  store.subscribe((ids) => received.push(ids));
  store.add('a');
  assert.equal(store.toggle('b'), true);
  store.remove('a');
  assert.deepEqual(store.list(), ['b']);
  store.clear();
  assert.deepEqual(received, [['a'], ['a', 'b'], ['b'], []]);
});

test('default localStorage access is guarded and supports persistence when available', (t) => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  });
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() { throw new Error('sandbox'); },
  });
  const blocked = createFavouritesStore();
  blocked.add('a');
  assert.deepEqual(blocked.list(), ['a']);
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: undefined });
  const absent = createFavouritesStore();
  absent.add('b');
  assert.deepEqual(absent.list(), ['b']);
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: mockStorage() });
  createFavouritesStore().add('persisted');
  assert.deepEqual(createFavouritesStore().list(), ['persisted']);
});
