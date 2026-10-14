// Service-role tests of allow_sense_again. Needs a running local Supabase (`supabase db reset`)
// and a .env as in rls.test.js.
import { createClient } from '@supabase/supabase-js';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { fingerprint } from '../../supabase/functions/_shared/fingerprint.ts';

const admin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const KEY = 'allow-test';
const KEY2 = 'allow-test-corrected';
const OTHER = 'allow-test-other';

const sense = (translations, over = {}) => ({
  term: 'Bank', part_of_speech: 'noun', translations, hint_native: 'bank (money)',
  forms: { article: 'die' }, example_target: 'Ich gehe zur Bank.', example_native: 'I go to the bank.', ...over,
});
const A = sense(['bank']);
const B = sense(['bench'], { hint_native: 'bench (seat)' });

const make = async (senses, { status = 'candidate', deleted = false, key = KEY, corrected = KEY2, native = 'en' } = {}) => {
  const { data, error } = await admin
    .from('ai_suggestions')
    .insert({
      target_lang: 'de', native_lang: native, term_key: key, corrected_key: corrected, senses, model: 'test', status,
      deleted_at: deleted ? new Date().toISOString() : null,
    })
    .select()
    .single();
  expect(error).toBeNull();
  return data.id;
};
const reject = async (s, keys = [KEY, KEY2]) => {
  const { data, error } = await admin
    .from('rejected_senses')
    .insert(keys.map((term_key) => ({
      target_lang: 'de', native_lang: 'en', term_key, fingerprint: fingerprint(s),
      part_of_speech: s.part_of_speech, translations: s.translations,
    })))
    .select('id');
  expect(error).toBeNull();
  return data.map((r) => r.id);
};
const stored = async () =>
  (await admin.from('rejected_senses').select('id, term_key, fingerprint').in('term_key', [KEY, KEY2, OTHER])).data;
const record = async (id) => (await admin.from('ai_suggestions').select('*').eq('id', id).single()).data;
const allow = (p_ids, p_records) => admin.rpc('allow_sense_again', { p_ids, p_records });
const rec = (id, senses) => ({ id, fingerprints: senses.map(fingerprint) });

async function cleanup() {
  await admin.from('rejected_senses').delete().in('term_key', [KEY, KEY2, OTHER]);
  await admin.from('ai_suggestions').delete().in('term_key', [KEY, OTHER]);
}
beforeAll(cleanup);
afterEach(cleanup);
afterAll(cleanup);

describe('allow_sense_again', () => {
  it('deletes the rows of every key and restores only the matching rejected sense', async () => {
    const id = await make([{ ...A, state: 'rejected', judged: true }, { ...B, state: 'rejected' }]);
    const ids = await reject(A);
    await reject(B);
    const { data, error } = await allow(ids, [rec(id, [A, B])]);
    expect(error).toBeNull();
    expect(data).toBe(2);
    expect((await stored()).map((r) => r.fingerprint)).toEqual([fingerprint(B), fingerprint(B)]);
    const r = await record(id);
    expect(r.senses[0].state).toBe('candidate');
    expect(r.senses[0]).not.toHaveProperty('judged');
    expect(r.senses[1].state).toBe('rejected');
    expect(r.status).toBe('candidate');
  });

  it('keeps status confirmed when another sense is confirmed, and leaves confirmed_at', async () => {
    const id = await make([{ ...A, state: 'confirmed', judged: true }, { ...B, state: 'rejected' }], { status: 'confirmed' });
    const before = await record(id);
    await allow(await reject(B), [rec(id, [A, B])]);
    const r = await record(id);
    expect(r.status).toBe('confirmed');
    expect(r.senses.map((s) => s.state)).toEqual(['confirmed', 'candidate']);
    expect(r.senses[0].judged).toBe(true);
    expect(r.confirmed_at).toBe(before.confirmed_at);
  });

  it('restores a suggestion found by its corrected key too, and leaves other suggestions alone', async () => {
    const viaCorrected = await make([{ ...A, state: 'rejected' }], { key: OTHER, corrected: KEY2 });
    const unrelated = await make([{ ...A, state: 'rejected' }], { key: 'allow-test', corrected: 'zzz' });
    const otherPair = await make([{ ...A, state: 'rejected' }], { key: OTHER, corrected: 'yyy', native: 'fr' });
    const ids = await reject(A, [KEY2]);
    const { error } = await allow(ids, [rec(viaCorrected, [A])]);
    expect(error).toBeNull();
    expect((await record(viaCorrected)).senses[0].state).toBe('candidate');
    expect((await record(unrelated)).senses[0].state).toBe('rejected');
    expect((await record(otherPair)).senses[0].state).toBe('rejected');
  });

  it('works when the suggestion is gone', async () => {
    const ids = await reject(A);
    const { data, error } = await allow(ids, []);
    expect(error).toBeNull();
    expect(data).toBe(2);
    expect(await stored()).toEqual([]);
  });

  it('keeps deleted_at on a first-version deleted record', async () => {
    const id = await make([{ ...A, state: 'rejected' }, { ...B, state: 'rejected' }], { deleted: true });
    await allow(await reject(A), [rec(id, [A, B])]);
    const r = await record(id);
    expect(r.deleted_at).not.toBeNull();
    expect(r.senses.map((s) => s.state)).toEqual(['candidate', 'rejected']);
    expect(r.status).toBe('candidate');
  });

  it('raises and changes nothing for an unknown id', async () => {
    const ids = await reject(A);
    const { error } = await allow([...ids, 999999999], []);
    expect(error).not.toBeNull();
    expect(await stored()).toHaveLength(2);
  });

  it('raises and changes nothing when the rows are not one sense', async () => {
    const id = await make([{ ...A, state: 'rejected' }]);
    const ids = [...(await reject(A)), ...(await reject(B))];
    const { error } = await allow(ids, [rec(id, [A])]);
    expect(error).not.toBeNull();
    expect(await stored()).toHaveLength(4);
    expect((await record(id)).senses[0].state).toBe('rejected');
  });

  it('raises and rolls back the delete when a fingerprint array does not match the senses', async () => {
    const id = await make([{ ...A, state: 'rejected' }, { ...B, state: 'rejected' }]);
    const ids = await reject(A);
    const { error } = await allow(ids, [{ id, fingerprints: [fingerprint(A)] }]);
    expect(error).not.toBeNull();
    expect(await stored()).toHaveLength(2);
    expect((await record(id)).senses[0].state).toBe('rejected');
  });

  it('raises when a named suggestion does not belong to the entry', async () => {
    const stranger = await make([{ ...A, state: 'rejected' }], { key: OTHER, corrected: 'yyy' });
    const ids = await reject(A);
    const { error } = await allow(ids, [rec(stranger, [A])]);
    expect(error).not.toBeNull();
    expect(await stored()).toHaveLength(2);
    expect((await record(stranger)).senses[0].state).toBe('rejected');
  });

  it('raises for no ids', async () => {
    expect((await allow([], [])).error).not.toBeNull();
  });
});
