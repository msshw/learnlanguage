import { describe, expect, it } from 'vitest';
import { createPendingList } from '../../src/js/lib/pending.js';

const fakeStorage = () => {
  const items = {};
  return {
    items,
    getItem: (k) => items[k] ?? null,
    setItem: (k, v) => {
      items[k] = v;
    },
  };
};
const brokenStorage = {
  getItem() {
    throw new Error('blocked');
  },
  setItem() {
    throw new Error('blocked');
  },
};

const answer = (n) => ({ card_id: `c${n}`, reviewed_at: `2026-10-12T09:0${n}:00.000Z` });
const failing = async () => {
  throw new Error('offline');
};

describe('pending list', () => {
  it('record sends and leaves the list empty on success', async () => {
    const list = createPendingList('k', fakeStorage());
    const sent = [];
    await list.record(answer(1), async (p) => sent.push(p));
    expect(sent).toEqual([answer(1)]);
    expect(list.payloads()).toEqual([]);
  });

  it('keeps a failed answer and survives a reload', async () => {
    const storage = fakeStorage();
    await createPendingList('k', storage).record(answer(1), failing);
    expect(createPendingList('k', storage).payloads()).toEqual([answer(1)]);
  });

  it('does not add the same answer twice', async () => {
    const list = createPendingList('k', fakeStorage());
    await list.record(answer(1), failing);
    await list.record(answer(1), failing);
    expect(list.payloads()).toHaveLength(1);
  });

  it('flushes oldest first and removes what was sent', async () => {
    const list = createPendingList('k', fakeStorage());
    await list.record(answer(1), failing);
    await list.record(answer(2), failing);
    const sent = [];
    await list.flush(async (p) => sent.push(p.card_id));
    expect(sent).toEqual(['c1', 'c2']);
    expect(list.payloads()).toEqual([]);
  });

  it('stops at the first failure to keep order', async () => {
    const list = createPendingList('k', fakeStorage());
    await list.record(answer(1), failing);
    await list.record(answer(2), failing);
    const sent = [];
    await list.flush(async (p) => {
      sent.push(p.card_id);
      throw new Error('still offline');
    });
    expect(sent).toEqual(['c1']);
    expect(list.payloads()).toHaveLength(2);
  });

  it('retries older answers first when a new one is recorded', async () => {
    const list = createPendingList('k', fakeStorage());
    await list.record(answer(1), failing);
    const sent = [];
    await list.record(answer(2), async (p) => sent.push(p.card_id));
    expect(sent).toEqual(['c1', 'c2']);
    expect(list.payloads()).toEqual([]);
  });

  it('shows the banner after three failed attempts and hides it once saved', async () => {
    const list = createPendingList('k', fakeStorage());
    await list.record(answer(1), failing); // attempt 1
    expect(list.needsBanner()).toBe(false);
    await list.flush(failing); // attempt 2
    expect(list.needsBanner()).toBe(false);
    await list.flush(failing); // attempt 3
    expect(list.needsBanner()).toBe(true);
    await list.flush(async () => {});
    expect(list.needsBanner()).toBe(false);
  });

  it('falls back to memory when storage is blocked', async () => {
    const list = createPendingList('k', brokenStorage);
    await list.record(answer(1), failing);
    expect(list.payloads()).toEqual([answer(1)]);
    const sent = [];
    await list.flush(async (p) => sent.push(p.card_id));
    expect(sent).toEqual(['c1']);
    expect(list.payloads()).toEqual([]);
  });

  it('shares one flush between concurrent callers', async () => {
    const list = createPendingList('k', fakeStorage());
    await list.record(answer(1), failing);
    let calls = 0;
    const send = async () => {
      calls += 1;
    };
    await Promise.all([list.flush(send), list.flush(send)]);
    expect(calls).toBe(1);
  });
});
