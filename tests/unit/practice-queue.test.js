import { describe, expect, it } from 'vitest';
import { PRACTICE_NEW_PER_DAY, practiceQueue, practiceStatus } from '../../src/js/lib/practice-queue.js';

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
    state: 'review',
    due: ago(DAY),
    deEnState: 'review',
    word: { deleted_at: null, created_at: ago(30 * DAY - seq * 1000) },
    ...over,
  };
};
const fresh = (over = {}) => card({ state: 'new', due: ago(1000), ...over });
const ids = (cards) => cards.map((c) => c.id);
const run = (cards, over = {}) => practiceQueue({ cards, now, tz, ...over });
const log = (cardId, practicedAt, state = 'new') => ({
  sentence_card_id: cardId,
  practiced_at: practicedAt,
  state_before: { state },
});

describe('due order', () => {
  it('puts due cards first, most overdue first, then new cards', () => {
    const a = card({ id: 'a', due: ago(DAY) });
    const b = card({ id: 'b', due: ago(3 * DAY) });
    const n = fresh({ id: 'n' });
    expect(ids(run([n, a, b]))).toEqual(['b', 'a', 'n']);
  });

  it('includes a review card due later today and excludes one due after the rollover', () => {
    expect(run([card({ due: ahead(5 * 3600e3) })])).toHaveLength(1);
    expect(run([card({ due: '2026-10-13T12:00:00Z' })])).toHaveLength(0);
  });

  it('includes a learning card only once its time has come', () => {
    expect(run([card({ state: 'learning', due: ago(60e3) })])).toHaveLength(1);
    expect(run([card({ state: 'learning', due: ahead(60e3) })])).toHaveLength(0);
  });

  it('orders new cards by word age, oldest first', () => {
    const young = fresh({ id: 'young', word: { deleted_at: null, created_at: ago(DAY) } });
    const old = fresh({ id: 'old', word: { deleted_at: null, created_at: ago(9 * DAY) } });
    expect(ids(run([young, old]))).toEqual(['old', 'young']);
  });
});

describe('eligibility', () => {
  it.each(['new', 'learning', 'relearning'])('keeps a new card out while the de_en card is %s', (deEnState) => {
    expect(run([fresh({ deEnState })])).toEqual([]);
  });

  it('excludes cards of deleted words', () => {
    const deleted = { deleted_at: ago(1000), created_at: ago(DAY) };
    expect(run([card({ word: deleted }), fresh({ word: deleted })])).toEqual([]);
  });

  it('shows each card and word once', () => {
    const a = card({ id: 'a' });
    expect(ids(run([a, a, card({ id: 'b', word_id: a.word_id })]))).toEqual(['a']);
  });
});

describe('daily new limit', () => {
  const many = () => Array.from({ length: 8 }, () => fresh());

  it('defaults to 5 new cards', () => {
    expect(PRACTICE_NEW_PER_DAY).toBe(5);
    expect(run(many())).toHaveLength(5);
  });

  it('counts first attempts made today', () => {
    const logs = [log('x1', ago(3600e3)), log('x2', ago(3600e3))];
    expect(run(many(), { logsToday: logs })).toHaveLength(3);
  });

  it('does not count repeat attempts of cards that were not new', () => {
    const logs = [log('x1', ago(3600e3), 'review')];
    expect(run(many(), { logsToday: logs })).toHaveLength(5);
  });

  it('adds no new cards at the limit but keeps due ones', () => {
    const logs = Array.from({ length: 5 }, (_, i) => log(`x${i}`, ago(3600e3)));
    const q = run([card({ id: 'due' }), ...many()], { logsToday: logs });
    expect(ids(q)).toEqual(['due']);
  });

  it('starts a new day at 04:00 local', () => {
    const logs = Array.from({ length: 5 }, (_, i) => log(`x${i}`, '2026-10-12T01:30:00Z')); // 03:30 local, previous day
    expect(run(many(), { logsToday: logs })).toHaveLength(5);
    const justAfter = new Date('2026-10-12T02:30:00Z'); // 04:30 local, the day that started at 02:00Z
    const today = Array.from({ length: 5 }, (_, i) => log(`y${i}`, '2026-10-12T02:10:00Z'));
    expect(run(many(), { now: justAfter, logsToday: today })).toHaveLength(0);
  });

  it('honours a custom limit', () => {
    expect(run(many(), { limit: 2 })).toHaveLength(2);
    expect(run(many(), { limit: 0 })).toHaveLength(0);
  });
});

describe('practiceStatus', () => {
  const status = (cards, over = {}) => practiceStatus({ cards, now, tz, ...over });

  it('counts the queue', () => {
    expect(status([card(), card(), fresh()]).dueCount).toBe(3);
    expect(status([]).dueCount).toBe(0);
  });

  it('reports the next due moment of a card not in the queue', () => {
    const later = '2026-10-15T09:00:00Z';
    const s = status([card({ due: later })]);
    expect(s.dueCount).toBe(0);
    expect(s.nextAvailable.toISOString()).toBe('2026-10-15T02:00:00.000Z'); // 04:00 local that day
  });

  it('reports a pending learning card at its time', () => {
    const due = ahead(600e3);
    expect(status([card({ state: 'learning', due })]).nextAvailable.toISOString()).toBe(due);
  });

  it('reports the next day for new cards beyond the limit', () => {
    const logs = Array.from({ length: 5 }, (_, i) => log(`x${i}`, ago(3600e3)));
    const s = status([fresh()], { logsToday: logs });
    expect(s.dueCount).toBe(0);
    expect(s.nextAvailable.toISOString()).toBe('2026-10-13T02:00:00.000Z');
  });

  it('has no next time for a new card that is not eligible yet', () => {
    expect(status([fresh({ deEnState: 'learning' })]).nextAvailable).toBeNull();
  });
});
