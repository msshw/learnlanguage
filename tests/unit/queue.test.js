import { describe, expect, it } from 'vitest';
import { buildQueue, homeStatus, nextAvailable } from '../../src/js/lib/queue.js';

const tz = 'Europe/Berlin';
// 09:00 CEST on 12 Oct 2026. The day started 02:00Z on 12 Oct and the next one starts 02:00Z on 13 Oct.
const now = new Date('2026-10-12T07:00:00Z');
const DAY = 24 * 3600e3;
const ago = (ms) => new Date(now.getTime() - ms).toISOString();
const ahead = (ms) => new Date(now.getTime() + ms).toISOString();

let seq = 0;
const card = (over = {}) => {
  seq += 1;
  return {
    id: `c${seq}`,
    word_id: `w${seq}`,
    direction: 'forward',
    state: 'review',
    due: ago(DAY),
    last_review: ago(5 * DAY),
    word: { deleted_at: null },
    ...over,
  };
};
const ids = (cards) => cards.map((c) => c.id);
const run = (cards, over = {}) => buildQueue({ cards, now, tz, limit: 10, ...over });

describe('due cards', () => {
  it('orders most overdue first', () => {
    const a = card({ id: 'a', due: ago(DAY) });
    const b = card({ id: 'b', due: ago(2 * DAY) });
    expect(ids(run([a, b]))).toEqual(['b', 'a']);
  });

  it('includes a review card due later today', () => {
    expect(run([card({ id: 'a', due: ahead(5 * 3600e3) })])).toHaveLength(1); // 14:00 local
  });

  it('excludes a review card due after the next rollover', () => {
    expect(run([card({ due: '2026-10-13T12:00:00Z' })])).toHaveLength(0);
  });

  it('includes a learning card only once it is due', () => {
    expect(run([card({ state: 'learning', due: ahead(10 * 60e3) })])).toHaveLength(0);
    expect(run([card({ state: 'learning', due: ago(60e3) })])).toHaveLength(1);
    expect(run([card({ state: 'relearning', due: ago(60e3) })])).toHaveLength(1);
  });
});

describe('new cards and the daily limit', () => {
  const fresh = (n) =>
    Array.from({ length: n }, (_, i) =>
      card({ id: `n${i}`, state: 'new', due: ago((100 - i) * 3600e3), last_review: null }),
    );
  const introducedLog = (cardId, over = {}) => ({
    card_id: cardId,
    reviewed_at: ago(3600e3),
    state_before: { state: 'new' },
    cards: { direction: 'forward' },
    ...over,
  });

  it('adds the oldest new cards up to the limit minus words introduced today', () => {
    const logs = [introducedLog('x1'), introducedLog('x2'), introducedLog('x3')];
    const q = run(fresh(20), { logsToday: logs });
    expect(q).toHaveLength(7);
    expect(ids(q)[0]).toBe('n0');
  });

  it('adds none once the limit is reached or when it is zero', () => {
    const logs = Array.from({ length: 10 }, (_, i) => introducedLog(`x${i}`));
    expect(run(fresh(5), { logsToday: logs })).toHaveLength(0);
    expect(run(fresh(5), { limit: 0 })).toHaveLength(0);
  });

  it('never goes negative when more were introduced than the limit', () => {
    const logs = Array.from({ length: 12 }, (_, i) => introducedLog(`x${i}`));
    expect(run(fresh(5), { logsToday: logs })).toHaveLength(0);
  });

  it('counts unsaved answers as introductions', () => {
    const pending = [{ card_id: 'p1', reviewed_at: ago(60e3), state_before: { state: 'new' } }];
    const known = card({ id: 'p1', state: 'learning', due: ahead(DAY) });
    expect(run([known, ...fresh(5)], { limit: 3, pending })).toHaveLength(2);
  });

  it('ignores logs that are not first forward reviews today', () => {
    const logs = [
      introducedLog('a', { cards: { direction: 'reverse' } }),
      introducedLog('b', { state_before: { state: 'review' } }),
      introducedLog('c', { reviewed_at: ago(2 * DAY) }),
    ];
    expect(run(fresh(5), { logsToday: logs, limit: 5 })).toHaveLength(5);
  });

  it('puts due cards before new cards', () => {
    const q = run([...fresh(2), card({ id: 'late' })]);
    expect(ids(q)[0]).toBe('late');
  });
});

describe('new reverse cards', () => {
  const pair = (deEn, enDe) => {
    const wordId = `pair${seq++}`;
    return [
      card({ id: `${wordId}-de`, word_id: wordId, direction: 'forward', ...deEn }),
      card({ id: `${wordId}-en`, word_id: wordId, direction: 'reverse', state: 'new', due: ago(3600e3), last_review: null, ...enDe }),
    ];
  };

  it('joins the day after the forward card was reviewed', () => {
    const [de, en] = pair({ state: 'review', due: ahead(3 * DAY), last_review: ago(DAY) });
    expect(ids(run([de, en]))).toEqual([en.id]);
  });

  it('waits when the forward card was reviewed today', () => {
    const [de, en] = pair({ state: 'review', due: ahead(3 * DAY), last_review: ago(3600e3) });
    expect(run([de, en])).toHaveLength(0);
  });

  it('waits when the forward card is still new', () => {
    const [de, en] = pair({ state: 'new', due: ago(2 * DAY), last_review: null });
    expect(ids(run([de, en], { limit: 0 }))).toEqual([]);
  });

  it('does not count against the daily limit', () => {
    const [de, en] = pair({ state: 'review', due: ahead(3 * DAY), last_review: ago(DAY) });
    const q = run([de, en], { limit: 0 });
    expect(ids(q)).toEqual([en.id]);
  });

  it('is placed before new forward cards', () => {
    const [de, en] = pair({ state: 'review', due: ahead(3 * DAY), last_review: ago(DAY) });
    const newOne = card({ id: 'new', state: 'new', due: ago(50 * 3600e3), last_review: null });
    expect(ids(run([newOne, de, en]))).toEqual([en.id, 'new']);
  });
});

describe('exclusions', () => {
  it('keeps one card per word, the more overdue', () => {
    const a = card({ id: 'a', word_id: 'w', direction: 'forward', due: ago(2 * DAY) });
    const b = card({ id: 'b', word_id: 'w', direction: 'reverse', due: ago(DAY) });
    expect(ids(run([b, a]))).toEqual(['a']);
  });

  it('drops cards of deleted words', () => {
    expect(run([card({ word: { deleted_at: '2026-10-11T00:00:00Z' } })])).toHaveLength(0);
  });

  it('drops cards with an unsaved answer', () => {
    const c = card({ id: 'p' });
    expect(run([c], { pending: [{ card_id: 'p', reviewed_at: ago(1000), state_before: {} }] })).toHaveLength(0);
  });
});

describe('nextAvailable', () => {
  it('is the start of the due day for a review card due tomorrow afternoon', () => {
    const c = card({ due: '2026-10-13T12:00:00Z' });
    expect(nextAvailable({ cards: [c], now, tz, limit: 10 }).toISOString()).toBe('2026-10-13T02:00:00.000Z');
  });

  it('is the due time of a learning card that is not ready', () => {
    const c = card({ state: 'learning', due: ahead(10 * 60e3) });
    expect(nextAvailable({ cards: [c], now, tz, limit: 10 }).toISOString()).toBe(ahead(10 * 60e3));
  });

  it('is the next day start when new cards wait beyond the limit', () => {
    const c = card({ state: 'new', due: ago(DAY), last_review: null });
    expect(nextAvailable({ cards: [c], now, tz, limit: 0 }).toISOString()).toBe('2026-10-13T02:00:00.000Z');
  });

  it('is null when nothing is waiting', () => {
    expect(nextAvailable({ cards: [], now, tz, limit: 10 })).toBeNull();
    expect(nextAvailable({ cards: [card()], now, tz, limit: 10 })).toBeNull(); // already in the queue
  });
});

describe('homeStatus', () => {
  const base = { now, tz, limit: 10, logsToday: [], pending: [] };

  it('is empty without words', () => {
    expect(homeStatus({ ...base, cards: [], wordCount: 0 }).kind).toBe('empty');
  });

  it('reports the number of cards due', () => {
    const s = homeStatus({ ...base, cards: [card(), card()], wordCount: 2 });
    expect(s).toMatchObject({ kind: 'due', dueCount: 2 });
  });

  it('reports nothing due when no answers were given today', () => {
    const c = card({ due: '2026-10-14T12:00:00Z' });
    const s = homeStatus({ ...base, cards: [c], wordCount: 1 });
    expect(s.kind).toBe('nothing');
    expect(s.nextAvailable.toISOString()).toBe('2026-10-14T02:00:00.000Z');
  });

  it('reports all done after answers were given today', () => {
    const c = card({ due: '2026-10-14T12:00:00Z' });
    const logsToday = [{ card_id: 'z', reviewed_at: ago(3600e3), state_before: { state: 'review' }, cards: { direction: 'forward' } }];
    expect(homeStatus({ ...base, cards: [c], wordCount: 1, logsToday }).kind).toBe('done');
  });

  it('counts words introduced today, from saved and pending answers, once per card', () => {
    const log = (cardId, over = {}) => ({
      card_id: cardId, reviewed_at: ago(3600e3), state_before: { state: 'new' }, cards: { direction: 'forward' }, ...over,
    });
    const a = card({ id: 'a', state: 'learning', due: ahead(DAY) });
    const b = card({ id: 'b', state: 'learning', due: ahead(DAY) });
    const e = card({ id: 'e', direction: 'reverse', state: 'learning', due: ahead(DAY) });
    const logsToday = [
      log('a'),
      log('a', { state_before: { state: 'learning' } }),
      log('e', { cards: { direction: 'reverse' } }), // reverse never counts
      log('x', { state_before: { state: 'review' } }),
    ];
    const pending = [{ card_id: 'b', reviewed_at: ago(60e3), state_before: { state: 'new' } }];
    const s = homeStatus({ ...base, cards: [a, b, e], wordCount: 3, logsToday, pending });
    expect(s.newToday).toBe(2);
    expect(homeStatus({ ...base, cards: [], wordCount: 0 }).newToday).toBe(0);
  });
});

describe('pair-scoped logs', () => {
  it('does not count introductions of another pair (db passes only this pair\'s logs)', () => {
    const cards = [1, 2].map((i) => card({ id: `n${i}`, state: 'new', due: ago(DAY), last_review: null }));
    const otherPairLogs = []; // listLogsSince(start, pairId) returned nothing for this pair
    expect(ids(run(cards, { limit: 2, logsToday: otherPairLogs }))).toEqual(['n1', 'n2']);
  });
});
