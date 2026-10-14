import { beforeEach, describe, expect, it, vi } from 'vitest';
import { groupRejected, groupReports, recordsToRestore } from '../../supabase/functions/admin/group.ts';
import { fingerprint } from '../../supabase/functions/_shared/fingerprint.ts';

const fake = vi.hoisted(() => ({
  insert: vi.fn(),
  invoke: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }) },
    from: () => ({ insert: fake.insert }),
    functions: { invoke: fake.invoke },
  }),
}));

const { invokeAdmin, reportSuggestion } = await import('../../src/js/lib/db.js');

beforeEach(() => vi.resetAllMocks());

const REASON = 'x'.repeat(50);

describe('reportSuggestion', () => {
  it('inserts with the signed-in user id and the trimmed reason', async () => {
    fake.insert.mockResolvedValue({ error: null });
    await reportSuggestion('s1', `  ${REASON}  `);
    expect(fake.insert).toHaveBeenCalledWith({ user_id: 'u1', suggestion_id: 's1', reason: REASON });
  });

  it('rejects a reason under 50 characters after trimming, without a request', async () => {
    await expect(reportSuggestion('s1', ` ${'x'.repeat(49)} `)).rejects.toBeDefined();
    expect(fake.insert).not.toHaveBeenCalled();
  });

  it('rejects a reason over 2000 characters', async () => {
    await expect(reportSuggestion('s1', 'x'.repeat(2001))).rejects.toBeDefined();
    expect(fake.insert).not.toHaveBeenCalled();
  });

  it('accepts 50 and 2000 characters', async () => {
    fake.insert.mockResolvedValue({ error: null });
    await reportSuggestion('s1', 'x'.repeat(50));
    await reportSuggestion('s1', 'x'.repeat(2000));
    expect(fake.insert).toHaveBeenCalledTimes(2);
  });

  it('treats a unique violation as success', async () => {
    fake.insert.mockResolvedValue({ error: { code: '23505' } });
    await expect(reportSuggestion('s1', REASON)).resolves.toBeUndefined();
  });

  it('throws on any other error', async () => {
    fake.insert.mockResolvedValue({ error: { code: '23503' } });
    await expect(reportSuggestion('s1', REASON)).rejects.toMatchObject({ code: '23503' });
  });
});

describe('invokeAdmin', () => {
  it('returns the body', async () => {
    fake.invoke.mockResolvedValue({ data: { status: 'ok', entries: [] }, error: null });
    expect(await invokeAdmin({ action: 'list' })).toEqual({ status: 'ok', entries: [] });
  });

  it('maps a 403 to forbidden', async () => {
    fake.invoke.mockResolvedValue({ data: null, error: { context: { status: 403 } } });
    expect(await invokeAdmin({ action: 'list' })).toEqual({ status: 'forbidden' });
  });

  it('throws on other failures', async () => {
    fake.invoke.mockResolvedValue({ data: null, error: { context: { status: 500 } } });
    await expect(invokeAdmin({ action: 'list' })).rejects.toBeDefined();
  });
});

describe('groupReports', () => {
  const suggestion = (term) => ({
    target_lang: 'de',
    native_lang: 'en',
    corrected_key: term.toLowerCase(),
    senses: [{ term }],
    status: 'confirmed',
  });

  it('groups by suggestion, counts, and orders by first report', () => {
    const rows = [
      { suggestion_id: 'b', created_at: '2026-10-02T10:00:00Z', reason: 'second', ai_suggestions: suggestion('Bank') },
      { suggestion_id: 'a', created_at: '2026-10-01T10:00:00Z', reason: 'other', ai_suggestions: suggestion('Haus') },
      { suggestion_id: 'b', created_at: '2026-10-01T09:00:00Z', reason: 'first', ai_suggestions: suggestion('Bank') },
    ];
    const out = groupReports(rows);
    expect(out.map((e) => [e.suggestion_id, e.report_count, e.first_reported_at])).toEqual([
      ['b', 2, '2026-10-01T09:00:00Z'],
      ['a', 1, '2026-10-01T10:00:00Z'],
    ]);
    expect(out[0]).toMatchObject({ term: 'Bank', status: 'confirmed', target_lang: 'de' });
  });

  it('collects the reasons oldest first and skips legacy reports without one', () => {
    const rows = [
      { suggestion_id: 'b', created_at: '2026-10-02T10:00:00Z', reason: 'second', ai_suggestions: suggestion('Bank') },
      { suggestion_id: 'b', created_at: '2026-10-01T09:00:00Z', reason: 'first', ai_suggestions: suggestion('Bank') },
      { suggestion_id: 'b', created_at: '2026-10-03T09:00:00Z', reason: null, ai_suggestions: suggestion('Bank') },
    ];
    const [entry] = groupReports(rows);
    expect(entry.reasons).toEqual(['first', 'second']);
    expect(entry.report_count).toBe(3);
  });

  it('skips a report whose suggestion is missing', () => {
    expect(groupReports([{ suggestion_id: 'x', created_at: '2026-10-01T00:00:00Z', reason: null, ai_suggestions: null }])).toEqual([]);
  });
});

describe('groupRejected', () => {
  const row = (id, term_key, created_at, over = {}) => ({
    id, term_key, created_at, target_lang: 'de', native_lang: 'en', fingerprint: 'noun|bank',
    part_of_speech: 'noun', translations: ['bank'], ...over,
  });

  it('merges the rows of one rejection under two keys into one entry', () => {
    const [entry] = groupRejected([row(2, 'bänke', '2026-10-01T10:00:00Z'), row(1, 'bank', '2026-10-01T10:00:00Z')]);
    expect(entry).toMatchObject({ ids: [1, 2], keys: ['bank', 'bänke'], term: 'bank / bänke', rejected_at: '2026-10-01T10:00:00Z' });
  });

  it('keeps one key as one row entry', () => {
    const out = groupRejected([row(1, 'bank', '2026-10-01T10:00:00Z')]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ term: 'bank', part_of_speech: 'noun', translations: ['bank'] });
  });

  it('keeps different fingerprints, pairs and rejection times apart, newest first', () => {
    const out = groupRejected([
      row(1, 'bank', '2026-10-01T10:00:00Z'),
      row(2, 'bank', '2026-10-01T10:00:00Z', { fingerprint: 'noun|bench' }),
      row(3, 'bank', '2026-10-02T10:00:00Z', { native_lang: 'fr' }),
      row(4, 'bank', '2026-10-03T10:00:00Z'),
    ]);
    expect(out.map((e) => e.ids)).toEqual([[4], [3], [2], [1]]);
  });

  it('returns nothing for no rows', () => {
    expect(groupRejected([])).toEqual([]);
  });
});

describe('recordsToRestore', () => {
  const bank = { part_of_speech: 'noun', translations: ['bank'] };
  const bench = { part_of_speech: 'noun', translations: ['bench'] };

  it('keeps suggestions with a rejected sense of the fingerprint and pairs fingerprints with senses', () => {
    const out = recordsToRestore(
      [
        { id: 'a', senses: [{ ...bank, state: 'rejected' }, { ...bench, state: 'confirmed' }] },
        { id: 'b', senses: [{ ...bank, state: 'confirmed' }] },
        { id: 'c', senses: [{ ...bench, state: 'rejected' }] },
      ],
      fingerprint(bank),
      fingerprint,
    );
    expect(out).toEqual([{ id: 'a', fingerprints: ['noun|bank', 'noun|bench'] }]);
  });
});
