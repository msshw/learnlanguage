import { describe, expect, it } from 'vitest';
import { PAGE_SIZE, parseOffset, shapeCall, shapeSuggestion, shapeUser, trimPage } from '../../supabase/functions/admin/views.ts';
import { costUsd } from '../../supabase/functions/_shared/cost.ts';

describe('parseOffset', () => {
  it('defaults to 0 and accepts integers from 0', () => {
    expect(parseOffset(undefined)).toBe(0);
    expect(parseOffset(0)).toBe(0);
    expect(parseOffset(50)).toBe(50);
  });
  it.each([-1, 1.5, '50', null, NaN, Infinity])('rejects %s', (v) => expect(parseOffset(v)).toBeNull());
});

describe('trimPage', () => {
  const rows = (n) => Array.from({ length: n }, (_, i) => i);
  it('flags more when an extra row exists', () => {
    const p = trimPage(rows(PAGE_SIZE + 1));
    expect(p.rows).toHaveLength(PAGE_SIZE);
    expect(p.has_more).toBe(true);
  });
  it('has no more at exactly a page or less', () => {
    expect(trimPage(rows(PAGE_SIZE)).has_more).toBe(false);
    expect(trimPage(rows(10))).toEqual({ rows: rows(10), has_more: false });
  });
});

describe('shapeUser', () => {
  const src = {
    id: 'u', email: 'a@b.c', created_at: 't1', last_sign_in_at: null, is_admin: false,
    word_count: '2', review_count: 5, sentence_count: 2, ai_calls_month: 4,
    input_tokens_month: 1000, output_tokens_month: 200, term: 'Haus', translations: ['house'], typed_answer: 'x',
  };
  it('returns only the allowed keys with cost from the shared prices', () => {
    const u = shapeUser(src);
    expect(Object.keys(u).sort()).toEqual([
      'ai_calls_month', 'cost_month_usd', 'created_at', 'email', 'is_admin', 'last_sign_in_at',
      'practice_attempts', 'reviews', 'words',
    ]);
    expect(u).toMatchObject({ words: 2, reviews: 5, practice_attempts: 2, ai_calls_month: 4, last_sign_in_at: null });
    expect(u.cost_month_usd).toBeCloseTo(costUsd(1000, 200), 6);
  });
});

describe('shapeCall', () => {
  it('returns no error text or user id', () => {
    const c = shapeCall({
      id: 1, user_id: 'u', email: 'a@b.c', kind: 'sentence_check', model: 'm', input_tokens: 800,
      output_tokens: 120, latency_ms: 300, ok: false, error: 'secret', created_at: 't',
    });
    expect(Object.keys(c).sort()).toEqual([
      'cost_usd', 'created_at', 'email', 'input_tokens', 'kind', 'latency_ms', 'model', 'ok', 'output_tokens',
    ]);
    expect(c.ok).toBe(false);
    expect(c.cost_usd).toBeCloseTo(costUsd(800, 120), 6);
  });
});

describe('shapeSuggestion', () => {
  const base = {
    id: 's1', target_lang: 'de', native_lang: 'en', corrected_key: 'bank', status: 'confirmed', deleted_at: null,
    created_at: 't', senses: [{ term: 'Bank', state: 'confirmed', translations: ['bank'] }, { state: 'confirmed' }, { state: 'rejected' }],
  };
  it('counts sense states, open reports, and keeps no sense content', () => {
    const s = shapeSuggestion(base, new Map([['s1', 3]]));
    expect(s).toEqual({
      term: 'Bank', target_lang: 'de', native_lang: 'en', status: 'confirmed',
      senses: { candidate: 0, confirmed: 2, rejected: 1 }, open_reports: 3, created_at: 't',
    });
  });
  it('treats a missing state as candidate, a missing term as the key, and marks removed', () => {
    const s = shapeSuggestion({ ...base, senses: [{}], deleted_at: 'x' }, new Map());
    expect(s).toMatchObject({ term: 'bank', status: 'removed', senses: { candidate: 1, confirmed: 0, rejected: 0 }, open_reports: 0 });
  });
});
