// Service-role tests of the per-sense SQL functions, the reopen rule and the backfill rows.
// Needs a running local Supabase (`supabase db reset`) and a .env as in rls.test.js.
import { createClient } from '@supabase/supabase-js';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { fingerprint, toRejected } from '../../supabase/functions/_shared/fingerprint.ts';
import { backfillRows } from '../../scripts/backfill-rejected-senses.ts';

const admin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const ALICE = 'a11ce000-0000-4000-8000-000000000001';
const BOB = 'b0b00000-0000-4000-8000-000000000002';
const KEY = 'sense-test';
const KEY2 = 'sense-test-corrected';
const REASON = 'This suggestion lists a meaning that the word does not have at all.';

const sense = (translations, over = {}) => ({
  term: 'Bank', part_of_speech: 'noun', translations, hint_native: 'bank (money)',
  forms: { article: 'die' }, example_target: 'Ich gehe zur Bank.', example_native: 'I go to the bank.', ...over,
});

const make = async (senses, { status = 'candidate', deleted = false } = {}) => {
  const { data, error } = await admin
    .from('ai_suggestions')
    .insert({
      target_lang: 'de', native_lang: 'en', term_key: KEY, corrected_key: KEY2, senses, model: 'test', status,
      deleted_at: deleted ? new Date().toISOString() : null,
    })
    .select()
    .single();
  expect(error).toBeNull();
  return data.id;
};

const report = async (id, userId = ALICE, extra = {}) => {
  const { error } = await admin.from('suggestion_reports').insert({ user_id: userId, suggestion_id: id, reason: REASON, ...extra });
  expect(error).toBeNull();
};
const reports = async (id) =>
  (await admin.from('suggestion_reports').select('user_id, closed_at, resolution').eq('suggestion_id', id).order('user_id')).data;
const record = async (id) => (await admin.from('ai_suggestions').select('*').eq('id', id).single()).data;
const rejectedRows = async () =>
  (await admin.from('rejected_senses').select('term_key, fingerprint').in('term_key', [KEY, KEY2]).order('term_key')).data;

const moderate = (id, p_action, extra = {}) => admin.rpc('moderate_suggestion', { p_id: id, p_action, ...extra });
const prints = (senses) => senses.map(toRejected);

const A = sense(['bank']);
const B = sense(['bench'], { hint_native: 'bench (seat)' });

async function cleanup() {
  await admin.from('suggestion_reports').delete().in('user_id', [ALICE, BOB]);
  await admin.from('rejected_senses').delete().in('term_key', [KEY, KEY2]);
  await admin.from('ai_suggestions').delete().in('term_key', [KEY]);
}
beforeAll(cleanup);
afterEach(cleanup);
afterAll(cleanup);

describe('confirm_sense', () => {
  it('confirms only the picked sense and sets the summary', async () => {
    const id = await make([{ ...A, state: 'candidate' }, { ...B, state: 'candidate' }]);
    expect((await admin.rpc('confirm_sense', { p_id: id, p_index: 1 })).error).toBeNull();
    const r = await record(id);
    expect(r.senses.map((s) => s.state)).toEqual(['candidate', 'confirmed']);
    expect(r.senses.map((s) => s.judged)).toEqual([undefined, undefined]);
    expect(r.status).toBe('confirmed');
    expect(r.confirmed_at).not.toBeNull();
  });

  it('is idempotent on a confirmed sense', async () => {
    const id = await make([{ ...A, state: 'confirmed' }], { status: 'confirmed' });
    expect((await admin.rpc('confirm_sense', { p_id: id, p_index: 0 })).error).toBeNull();
    expect((await record(id)).senses[0].state).toBe('confirmed');
  });

  it('errors on a rejected sense, an out-of-range index and an unknown id', async () => {
    const id = await make([{ ...A, state: 'rejected' }]);
    expect((await admin.rpc('confirm_sense', { p_id: id, p_index: 0 })).error).not.toBeNull();
    expect((await admin.rpc('confirm_sense', { p_id: id, p_index: 5 })).error).not.toBeNull();
    expect((await admin.rpc('confirm_sense', { p_id: '00000000-0000-4000-8000-000000000000', p_index: 0 })).error).not.toBeNull();
    const r = await record(id);
    expect(r.senses[0].state).toBe('rejected');
    expect(r.status).toBe('candidate');
  });
});

describe('moderate_suggestion', () => {
  it('approve confirms and marks judged; reports stay open while another sense is unjudged', async () => {
    const id = await make([{ ...A, state: 'candidate' }, { ...B, state: 'candidate' }]);
    await report(id);
    const { data, error } = await moderate(id, 'approve', { p_index: 1 });
    expect(error).toBeNull();
    expect(data.reports_closed).toBe(false);
    expect(data.senses.map((s) => [s.state, s.judged ?? false])).toEqual([['candidate', false], ['confirmed', true]]);
    expect((await record(id)).status).toBe('confirmed');
    expect((await reports(id))[0].closed_at).toBeNull();
  });

  it('the last judgment closes the reports with that action as resolution', async () => {
    const id = await make([{ ...A, state: 'candidate' }, { ...B, state: 'candidate' }]);
    await report(id, ALICE);
    await report(id, BOB);
    await moderate(id, 'reject', { p_index: 1, p_fingerprints: prints([A, B]) });
    expect((await reports(id)).every((r) => r.closed_at === null)).toBe(true);
    const { data } = await moderate(id, 'approve', { p_index: 0 });
    expect(data.reports_closed).toBe(true);
    expect((await reports(id)).map((r) => r.resolution)).toEqual(['approved', 'approved']);
  });

  it('a user-confirmed sense stays unjudged until approved', async () => {
    const id = await make([{ ...A, state: 'confirmed' }, { ...B, state: 'candidate' }], { status: 'confirmed' });
    await report(id);
    const { data } = await moderate(id, 'reject', { p_index: 1, p_fingerprints: prints([A, B]) });
    expect(data.reports_closed).toBe(false);
    expect((await reports(id))[0].closed_at).toBeNull();
    const done = await moderate(id, 'approve', { p_index: 0 });
    expect(done.data.reports_closed).toBe(true);
    expect((await reports(id))[0].resolution).toBe('approved');
  });

  it('edit replaces the sense as confirmed and judged and closes as edited', async () => {
    const id = await make([{ ...A, state: 'candidate' }]);
    await report(id);
    const edited = sense(['bank', 'lender'], { forms: { article: 'die', plural: 'Banken' } });
    const { data } = await moderate(id, 'edit', { p_index: 0, p_sense: edited });
    expect(data.senses[0]).toMatchObject({ translations: ['bank', 'lender'], state: 'confirmed', judged: true });
    expect((await reports(id))[0].resolution).toBe('edited');
  });

  it('edit on index 0 moves corrected_key; on another index it does not', async () => {
    const id = await make([{ ...A, state: 'candidate' }, { ...B, state: 'candidate' }]);
    await moderate(id, 'edit', { p_index: 1, p_sense: sense(['x'], { term: 'Bänke' }), p_corrected_key: 'bänke' });
    expect((await record(id)).corrected_key).toBe(KEY2);
    await moderate(id, 'edit', { p_index: 0, p_sense: sense(['bank'], { term: 'Bänke' }), p_corrected_key: 'bänke' });
    expect((await record(id)).corrected_key).toBe('bänke');
  });

  it('reject marks the sense, stores its fingerprint under both keys once, and a repeat adds nothing', async () => {
    const id = await make([{ ...A, state: 'candidate' }, { ...B, state: 'candidate' }]);
    await moderate(id, 'reject', { p_index: 0, p_fingerprints: prints([A, B]) });
    expect((await record(id)).senses[0].state).toBe('rejected');
    const want = [KEY, KEY2].sort().map((k) => ({ term_key: k, fingerprint: fingerprint(A) }));
    expect(await rejectedRows()).toEqual(want);
    expect((await moderate(id, 'reject', { p_index: 0, p_fingerprints: prints([A, B]) })).error).toBeNull();
    expect(await rejectedRows()).toEqual(want);
  });

  it('a rejected sense cannot be approved or edited', async () => {
    const id = await make([{ ...A, state: 'rejected' }]);
    expect((await moderate(id, 'approve', { p_index: 0 })).error).not.toBeNull();
    expect((await moderate(id, 'edit', { p_index: 0, p_sense: A })).error).not.toBeNull();
  });

  it('remove rejects every sense, stores fingerprints and closes the reports at once', async () => {
    const id = await make([{ ...A, state: 'candidate' }, { ...B, state: 'confirmed' }], { status: 'confirmed' });
    await report(id, ALICE);
    await report(id, BOB);
    const { data } = await moderate(id, 'remove', { p_fingerprints: prints([A, B]) });
    expect(data.reports_closed).toBe(true);
    expect(data.senses.every((s) => s.state === 'rejected')).toBe(true);
    expect((await record(id)).status).toBe('candidate');
    expect((await reports(id)).map((r) => r.resolution)).toEqual(['removed', 'removed']);
    expect(await rejectedRows()).toHaveLength(4);
  });

  it('a late report on a fully judged record is closed by one approve', async () => {
    const id = await make([{ ...A, state: 'confirmed', judged: true }], { status: 'confirmed' });
    await report(id);
    const { data } = await moderate(id, 'approve', { p_index: 0 });
    expect(data.reports_closed).toBe(true);
    expect((await reports(id))[0].resolution).toBe('approved');
  });

  it('a failed action changes nothing', async () => {
    const id = await make([{ ...A, state: 'candidate' }]);
    await report(id);
    expect((await moderate(id, 'approve', { p_index: 5 })).error).not.toBeNull();
    expect((await moderate(id, 'remove', { p_fingerprints: [] })).error).not.toBeNull();
    expect((await moderate(id, 'burn', { p_index: 0 })).error).not.toBeNull();
    expect((await record(id)).senses[0].state).toBe('candidate');
    expect((await reports(id))[0].closed_at).toBeNull();
    expect(await rejectedRows()).toEqual([]);
  });
});

describe('reopen rule for reports the first version closed', () => {
  const closedAt = new Date().toISOString();

  it('reopens legacy kept reports, keeps legacy removed and fully judged ones closed', async () => {
    // kept: closed without any sense being judged
    const kept = await make([{ ...A, state: 'confirmed' }], { status: 'confirmed' });
    await report(kept, ALICE, { closed_at: closedAt, resolution: 'kept' });
    // removed: all senses rejected (the conversion of a deleted record)
    const removed = await make([{ ...A, state: 'rejected' }, { ...B, state: 'rejected' }], { deleted: true });
    await report(removed, ALICE, { closed_at: closedAt, resolution: 'removed' });
    // closed on a record whose senses are all judged
    const judged = await make([{ ...A, state: 'confirmed', judged: true }, { ...B, state: 'rejected' }], { status: 'confirmed' });
    await report(judged, ALICE, { closed_at: closedAt, resolution: 'approved' });
    // an open report is left alone
    const open = await make([{ ...A, state: 'candidate' }]);
    await report(open, ALICE);

    expect((await admin.rpc('reopen_unjudged_reports')).error).toBeNull();

    expect(await reports(kept)).toEqual([{ user_id: ALICE, closed_at: null, resolution: null }]);
    expect((await reports(removed))[0]).toMatchObject({ resolution: 'removed' });
    expect((await reports(removed))[0].closed_at).not.toBeNull();
    expect((await reports(judged))[0]).toMatchObject({ resolution: 'approved' });
    expect((await reports(open))[0].closed_at).toBeNull();
  });

  it('the function is closed to users', async () => {
    const anon = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    expect((await anon.rpc('reopen_unjudged_reports')).error).not.toBeNull();
  });
});

describe('backfill rows', () => {
  it('equal the fingerprint.ts output under both keys for umlaut translations, and a second run adds none', async () => {
    const senses = [
      { part_of_speech: 'noun', translations: ['Äpfel', 'Straße'] },
      { part_of_speech: 'verb', translations: ['Größe'] },
    ];
    const id = await make(senses.map((s) => ({ ...A, ...s, state: 'rejected' })), { deleted: true });
    const { data: records } = await admin
      .from('ai_suggestions')
      .select('target_lang, native_lang, term_key, corrected_key, senses')
      .eq('id', id);

    const rows = backfillRows(records);
    const upsert = () =>
      admin.from('rejected_senses').upsert(rows, { onConflict: 'target_lang,native_lang,term_key,fingerprint', ignoreDuplicates: true });
    expect((await upsert()).error).toBeNull();
    const stored = await rejectedRows();
    expect(stored).toHaveLength(4);
    for (const key of [KEY, KEY2]) {
      expect(stored.filter((r) => r.term_key === key).map((r) => r.fingerprint).sort()).toEqual(
        senses.map(fingerprint).sort(),
      );
    }
    expect((await upsert()).error).toBeNull();
    expect(await rejectedRows()).toHaveLength(4);
  });
});
