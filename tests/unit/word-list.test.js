import { describe, expect, it } from 'vitest';
import { isWordId, matchesQuery, nextDue, wordLabel } from '../../src/js/lib/word-list.js';

const haus = { term: 'Haus', translations: ['house', 'home'], part_of_speech: 'noun', forms: { article: 'das' } };

describe('matchesQuery', () => {
  it('matches the term ignoring case', () => {
    expect(matchesQuery(haus, 'HAU')).toBe(true);
  });

  it('matches a translation', () => {
    expect(matchesQuery(haus, 'hous')).toBe(true);
  });

  it('treats an empty or blank query as match all', () => {
    expect(matchesQuery(haus, '')).toBe(true);
    expect(matchesQuery(haus, '   ')).toBe(true);
  });

  it('does not match unrelated text', () => {
    expect(matchesQuery(haus, 'zzz')).toBe(false);
  });
});

describe('nextDue', () => {
  it('picks the earlier card', () => {
    const d = nextDue([{ due: '2026-10-12T10:00:00+00:00' }, { due: '2026-10-11T10:00:00+00:00' }]);
    expect(d.toISOString()).toBe('2026-10-11T10:00:00.000Z');
  });

  it('returns null without cards', () => {
    expect(nextDue([])).toBeNull();
    expect(nextDue(undefined)).toBeNull();
  });
});

describe('wordLabel', () => {
  it('shows the article for nouns only', () => {
    expect(wordLabel(haus)).toBe('das Haus');
    expect(wordLabel({ term: 'gehen', part_of_speech: 'verb', forms: {} })).toBe('gehen');
  });
});

describe('isWordId', () => {
  it('accepts a UUID', () => {
    expect(isWordId('0b9f6a52-3c1e-4d8a-9f10-5a7e2c4d8b11')).toBe(true);
  });

  it('rejects other text, empty and null', () => {
    expect(isWordId('abc')).toBe(false);
    expect(isWordId('')).toBe(false);
    expect(isWordId(null)).toBe(false);
  });
});
