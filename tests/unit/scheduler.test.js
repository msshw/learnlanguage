import { describe, expect, it } from 'vitest';
import { fsrsFields, previewIntervals, schedule } from '../../src/js/lib/scheduler.js';

const t0 = new Date('2026-10-11T09:00:00Z');
const newCard = () => ({
  state: 'new',
  due: t0.toISOString(),
  stability: 0,
  difficulty: 0,
  elapsed_days: 0,
  scheduled_days: 0,
  learning_steps: 0,
  reps: 0,
  lapses: 0,
  last_review: null,
});

const DAY = 24 * 3600e3;

// Rates Good at each card's due time until it reaches the review state.
function toReviewState() {
  let card = newCard();
  let now = t0;
  for (let i = 0; i < 6 && card.state !== 'review'; i++) {
    card = schedule(card, 3, now);
    now = new Date(card.due);
  }
  expect(card.state).toBe('review');
  return { card, now };
}

describe('schedule', () => {
  it('is deterministic', () => {
    expect(schedule(newCard(), 3, t0)).toEqual(schedule(newCard(), 3, t0));
  });

  it('does not modify its input', () => {
    const card = newCard();
    const copy = structuredClone(card);
    schedule(card, 3, t0);
    expect(card).toEqual(copy);
  });

  it('returns a card in database shape', () => {
    const next = schedule(newCard(), 3, t0);
    expect(['learning', 'review']).toContain(next.state);
    expect(typeof next.due).toBe('string');
    expect(next.reps).toBe(1);
    expect(next.last_review).toBe(t0.toISOString());
    expect(Number.isInteger(next.learning_steps)).toBe(true);
  });

  it('feeds its own output back in (round trip)', () => {
    const first = schedule(newCard(), 3, t0);
    const second = schedule(first, 3, new Date(first.due));
    expect(second.reps).toBe(2);
    expect(new Date(second.last_review).getTime()).toBe(new Date(first.due).getTime());
  });

  it('carries the learning step through to the next review', () => {
    const first = schedule(newCard(), 3, t0);
    // Good on a new card moves it into the learning steps, not straight to review
    expect(first.state).toBe('learning');
    expect(first.learning_steps).toBeGreaterThan(0);
  });

  it('moves a review card out by more days the better the rating', () => {
    const { card, now } = toReviewState();
    const due = (rating) => new Date(schedule(card, rating, now).due).getTime();
    expect(due(1)).toBeLessThanOrEqual(due(2));
    expect(due(2)).toBeLessThanOrEqual(due(3));
    expect(due(3)).toBeLessThanOrEqual(due(4));
    expect(due(4)).toBeGreaterThan(due(1));
    expect(due(3)).toBeGreaterThan(now.getTime() + DAY / 2);
  });

  it('counts a lapse when a review card is rated Again', () => {
    const { card, now } = toReviewState();
    const next = schedule(card, 1, now);
    expect(next.lapses).toBe(card.lapses + 1);
    expect(next.state).toBe('relearning');
  });

  it('rejects an unknown state', () => {
    expect(() => schedule({ ...newCard(), state: 'bogus' }, 3, t0)).toThrow();
  });
});

describe('fsrsFields', () => {
  it('keeps only the FSRS fields', () => {
    const row = { ...newCard(), id: 'x', word_id: 'y', user_id: 'z', direction: 'de_en' };
    expect(fsrsFields(row)).toEqual(newCard());
  });
});

describe('previewIntervals', () => {
  it('returns the due date schedule gives for each rating', () => {
    const { card, now } = toReviewState();
    const preview = previewIntervals(card, now);
    expect(preview).toHaveLength(4);
    preview.forEach((due, i) => expect(due.toISOString()).toBe(schedule(card, i + 1, now).due));
  });

  it('does not modify its input', () => {
    const card = newCard();
    const copy = structuredClone(card);
    previewIntervals(card, t0);
    expect(card).toEqual(copy);
  });
});
