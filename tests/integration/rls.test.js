// Needs a running local Supabase (`supabase start`, `supabase db reset`) and a .env with
// VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY.
// Clients are created here directly: the "only db.js imports supabase-js" rule covers src/ only.
import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resetUser } from '../helpers/admin.js';

const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const client = (key) => createClient(url, key, { auth: { persistSession: false } });

async function signedIn(email) {
  const c = client(anonKey);
  const { data, error } = await c.auth.signInWithPassword({ email, password: 'password123' });
  if (error) throw new Error(`sign-in as ${email} failed: ${error.message}`);
  return { c, id: data.user.id };
}

const TABLES = ['profiles', 'language_pairs', 'words', 'cards', 'review_logs', 'ai_calls'];
const ownerCol = (t) => (t === 'profiles' ? 'id' : 'user_id');

const admin = client(serviceKey);
let alice, bob, anon;
let rows = {}; // alice's row per table
let snapshot = {};

async function clean() {
  for (const id of [alice.id, bob.id]) await resetUser(admin, id);
}

const readRow = async (t) => {
  const { data, error } = await admin.from(t).select('*').eq('id', rows[t].id).single();
  if (error) throw error;
  return data;
};

beforeAll(async () => {
  alice = await signedIn('alice@test.local');
  bob = await signedIn('bob@test.local');
  anon = client(anonKey);
  await clean();

  // Alice creates one row per table through her own session, which also proves own writes work.
  const pair = await alice.c
    .from('language_pairs')
    .insert({ user_id: alice.id, target_lang: 'de', native_lang: 'en' })
    .select()
    .single();
  const word = await alice.c
    .from('words')
    .insert({
      user_id: alice.id,
      pair_id: pair.data.id,
      term: 'Haus',
      part_of_speech: 'noun',
      translations: ['house'],
    })
    .select()
    .single();
  // The words insert trigger created the word's cards; alice reads her forward card.
  const card = await alice.c
    .from('cards')
    .select()
    .eq('word_id', word.data.id)
    .eq('direction', 'forward')
    .single();
  const log = await alice.c
    .from('review_logs')
    .insert({
      user_id: alice.id,
      card_id: card.data.id,
      typed_answer: 'house',
      grader_result: 'correct',
      rating: 3,
      state_before: {},
    })
    .select()
    .single();
  const ai = await admin
    .from('ai_calls')
    .insert({ user_id: alice.id, model: 'test', ok: true })
    .select()
    .single();
  const profile = await alice.c.from('profiles').select('*').eq('id', alice.id).single();

  for (const r of [pair, word, card, log, ai, profile]) expect(r.error).toBeNull();
  rows = {
    profiles: profile.data,
    language_pairs: pair.data,
    words: word.data,
    cards: card.data,
    review_logs: log.data,
    ai_calls: ai.data,
  };
  for (const t of TABLES) snapshot[t] = await readRow(t);
});

afterAll(async () => {
  if (alice && bob) await clean();
});

const alicePayload = () => ({
  profiles: { id: alice.id },
  language_pairs: { user_id: alice.id, target_lang: 'fr', native_lang: 'en' },
  words: {
    user_id: alice.id,
    pair_id: rows.language_pairs.id,
    term: 'x',
    part_of_speech: 'noun',
    translations: ['x'],
  },
  cards: { user_id: alice.id, word_id: rows.words.id, direction: 'reverse' },
  review_logs: {
    user_id: alice.id,
    card_id: rows.cards.id,
    typed_answer: 'x',
    grader_result: 'wrong',
    rating: 1,
    state_before: {},
  },
  ai_calls: { user_id: alice.id, model: 'x', ok: true },
});

const patch = {
  profiles: { timezone: 'UTC' },
  language_pairs: { native_lang: 'xx' },
  words: { notes: 'hijacked' },
  cards: { reps: 99 },
  review_logs: { typed_answer: 'hijacked' },
  ai_calls: { model: 'hijacked' },
};

describe.each(TABLES)('%s', (t) => {
  it('bob cannot select alice rows', async () => {
    const { data } = await bob.c.from(t).select('*').eq(ownerCol(t), alice.id);
    expect(data ?? []).toEqual([]);
  });

  it('anonymous cannot select', async () => {
    const { data } = await anon.from(t).select('*');
    expect(data ?? []).toEqual([]);
  });

  it('bob cannot insert a row owned by alice', async () => {
    const { error } = await bob.c.from(t).insert(alicePayload()[t]);
    expect(error).not.toBeNull();
  });

  it('bob cannot update alice rows', async () => {
    const { data } = await bob.c.from(t).update(patch[t]).eq('id', rows[t].id).select();
    expect(data ?? []).toEqual([]);
  });

  it.each([
    ['alice', () => alice],
    ['bob', () => bob],
  ])('%s cannot delete alice rows', async (_n, who) => {
    await who().c.from(t).delete().eq('id', rows[t].id);
    expect(await readRow(t)).toEqual(snapshot[t]);
  });
});

describe('parent rows must belong to the same user', () => {
  it('bob cannot attach a word to alice pair', async () => {
    const { error } = await bob.c.from('words').insert({
      user_id: bob.id,
      pair_id: rows.language_pairs.id,
      term: 'x',
      part_of_speech: 'noun',
      translations: ['x'],
    });
    expect(error).not.toBeNull();
  });

  it('bob cannot attach a card to alice word', async () => {
    const { error } = await bob.c
      .from('cards')
      .insert({ user_id: bob.id, word_id: rows.words.id, direction: 'reverse' });
    expect(error).not.toBeNull();
  });

  it('bob cannot attach a review log to alice card', async () => {
    const { error } = await bob.c.from('review_logs').insert({
      user_id: bob.id,
      card_id: rows.cards.id,
      typed_answer: 'x',
      grader_result: 'wrong',
      rating: 1,
      state_before: {},
    });
    expect(error).not.toBeNull();
  });

  it('bob cannot point his active pair at alice pair', async () => {
    const { data, error } = await bob.c
      .from('profiles')
      .update({ active_pair_id: rows.language_pairs.id })
      .eq('id', bob.id)
      .select();
    expect(error !== null || (data ?? []).length === 0).toBe(true);
    const { data: after } = await admin.from('profiles').select('active_pair_id').eq('id', bob.id).single();
    expect(after.active_pair_id).toBeNull();
  });

  it('bob can attach rows to his own parents', async () => {
    const pair = await bob.c
      .from('language_pairs')
      .insert({ user_id: bob.id, target_lang: 'de', native_lang: 'en' })
      .select()
      .single();
    expect(pair.error).toBeNull();

    const word = await bob.c.from('words').insert({
      user_id: bob.id,
      pair_id: pair.data.id,
      term: 'Bank',
      part_of_speech: 'noun',
      translations: ['bank'],
    });
    expect(word.error).toBeNull();

    const active = await bob.c
      .from('profiles')
      .update({ active_pair_id: pair.data.id })
      .eq('id', bob.id)
      .select();
    expect(active.error).toBeNull();
    expect(active.data).toHaveLength(1);
  });

  it('bob cannot reassign his own row to alice', async () => {
    const { data: own } = await bob.c.from('language_pairs').select('id').eq('user_id', bob.id).limit(1);
    const { error } = await bob.c.from('language_pairs').update({ user_id: alice.id }).eq('id', own[0].id);
    expect(error).not.toBeNull();
  });
});

describe('append-only and server-only tables', () => {
  it('alice cannot update her own review log', async () => {
    const { data } = await alice.c
      .from('review_logs')
      .update({ typed_answer: 'changed' })
      .eq('id', rows.review_logs.id)
      .select();
    expect(data ?? []).toEqual([]);
    expect(await readRow('review_logs')).toEqual(snapshot.review_logs);
  });

  it('alice cannot insert into ai_calls', async () => {
    const { error } = await alice.c.from('ai_calls').insert({ user_id: alice.id, model: 'x', ok: true });
    expect(error).not.toBeNull();
  });

  it('alice can read her own ai_calls', async () => {
    const { data } = await alice.c.from('ai_calls').select('*');
    expect(data).toHaveLength(1);
  });
});

describe('ai_suggestions (service role only)', () => {
  const row = {
    target_lang: 'de',
    native_lang: 'en',
    term_key: 'rls-test',
    corrected_key: 'rls-test',
    senses: [],
    model: 'test',
    status: 'candidate',
  };
  let id;

  beforeAll(async () => {
    const { data, error } = await admin.from('ai_suggestions').insert(row).select().single();
    expect(error).toBeNull();
    id = data.id;
  });
  afterAll(async () => {
    await admin.from('ai_suggestions').delete().eq('term_key', 'rls-test');
  });

  it.each([
    ['alice', () => alice.c],
    ['anon', () => anon],
  ])('%s cannot select, insert, update or delete', async (_n, who) => {
    const c = who();
    const sel = await c.from('ai_suggestions').select('*');
    expect(sel.data ?? []).toEqual([]);
    expect((await c.from('ai_suggestions').insert(row)).error).not.toBeNull();
    const upd = await c.from('ai_suggestions').update({ status: 'confirmed' }).eq('id', id).select();
    expect(upd.data ?? []).toEqual([]);
    await c.from('ai_suggestions').delete().eq('id', id);
    const { data } = await admin.from('ai_suggestions').select('status').eq('id', id).single();
    expect(data.status).toBe('candidate');
  });
});

describe('profiles', () => {
  it('clients cannot insert a profile', async () => {
    const { error } = await bob.c.from('profiles').insert({ id: bob.id });
    expect(error).not.toBeNull();
  });

  it('new users get a profile with defaults', async () => {
    const { data } = await admin.from('profiles').select('*').eq('id', alice.id).single();
    expect(data.new_words_per_day).toBe(10);
    expect(data.timezone).toBe('Europe/Berlin');
  });
});

describe('profiles.is_admin', () => {
  const flag = async (id) => (await admin.from('profiles').select('is_admin').eq('id', id).single()).data.is_admin;

  it('is false by default and readable by its owner', async () => {
    const { data } = await bob.c.from('profiles').select('is_admin').eq('id', bob.id).single();
    expect(data.is_admin).toBe(false);
  });

  it('bob cannot promote himself', async () => {
    const { error } = await bob.c.from('profiles').update({ is_admin: true }).eq('id', bob.id);
    expect(error).not.toBeNull();
    expect(await flag(bob.id)).toBe(false);
  });

  it('bob cannot promote himself together with an allowed field', async () => {
    const { error } = await bob.c.from('profiles').update({ is_admin: true, new_words_per_day: 7 }).eq('id', bob.id);
    expect(error).not.toBeNull();
    expect(await flag(bob.id)).toBe(false);
  });

  it('bob cannot promote alice', async () => {
    await bob.c.from('profiles').update({ is_admin: true }).eq('id', alice.id);
    expect(await flag(alice.id)).toBe(false);
  });

  it('bob can still change his new words per day', async () => {
    const { data, error } = await bob.c.from('profiles').update({ new_words_per_day: 12 }).eq('id', bob.id).select();
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    await bob.c.from('profiles').update({ new_words_per_day: 10 }).eq('id', bob.id);
  });

  it('the service role can set and clear it', async () => {
    expect((await admin.from('profiles').update({ is_admin: true }).eq('id', bob.id)).error).toBeNull();
    expect(await flag(bob.id)).toBe(true);
    expect((await admin.from('profiles').update({ is_admin: false }).eq('id', bob.id)).error).toBeNull();
    expect(await flag(bob.id)).toBe(false);
  });
});

describe('suggestion_reports', () => {
  let suggestionId;

  beforeAll(async () => {
    const { data, error } = await admin
      .from('ai_suggestions')
      .insert({
        target_lang: 'de', native_lang: 'en', term_key: 'report-test', corrected_key: 'report-test',
        senses: [], model: 'test', status: 'confirmed',
      })
      .select()
      .single();
    expect(error).toBeNull();
    suggestionId = data.id;
  });
  afterAll(async () => {
    await admin.from('suggestion_reports').delete().eq('suggestion_id', suggestionId);
    await admin.from('ai_suggestions').delete().eq('term_key', 'report-test');
  });

  const REASON = 'The second meaning is a different word and should not be listed here.';
  const report = (user, id = suggestionId, reason = REASON) => ({ user_id: user.id, suggestion_id: id, reason });

  it('reason limits: 49 characters, whitespace only, missing and 2001 are rejected', async () => {
    for (const reason of ['x'.repeat(49), ' '.repeat(60), `  ${'x'.repeat(48)}  `, undefined, 'x'.repeat(2001)]) {
      const row = { user_id: alice.id, suggestion_id: suggestionId };
      if (reason !== undefined) row.reason = reason;
      expect((await alice.c.from('suggestion_reports').insert(row)).error).not.toBeNull();
    }
    const { data } = await admin.from('suggestion_reports').select('id').eq('suggestion_id', suggestionId);
    expect(data).toHaveLength(0);
  });

  it('50 and 2000 characters are accepted (bob, so alice stays unreported)', async () => {
    expect((await bob.c.from('suggestion_reports').insert(report(bob, suggestionId, 'x'.repeat(50)))).error).toBeNull();
    await admin.from('suggestion_reports').delete().eq('user_id', bob.id);
    expect((await bob.c.from('suggestion_reports').insert(report(bob, suggestionId, 'x'.repeat(2000)))).error).toBeNull();
    await admin.from('suggestion_reports').delete().eq('user_id', bob.id);
  });

  it('alice can report with her own id', async () => {
    expect((await alice.c.from('suggestion_reports').insert(report(alice))).error).toBeNull();
  });

  it('a second report for the same suggestion is rejected', async () => {
    const { error } = await alice.c.from('suggestion_reports').insert(report(alice));
    expect(error?.code).toBe('23505');
  });

  it('bob cannot report as alice', async () => {
    expect((await bob.c.from('suggestion_reports').insert(report(alice))).error).not.toBeNull();
  });

  it('an unknown suggestion is rejected', async () => {
    const { error } = await bob.c
      .from('suggestion_reports')
      .insert(report(bob, '00000000-0000-4000-8000-000000000000'));
    expect(error).not.toBeNull();
  });

  it('nobody can select reports, including their own', async () => {
    for (const c of [alice.c, bob.c, anon]) {
      const { data } = await c.from('suggestion_reports').select('*');
      expect(data ?? []).toEqual([]);
    }
  });

  it('alice cannot close or delete her report', async () => {
    const upd = await alice.c
      .from('suggestion_reports')
      .update({ closed_at: new Date().toISOString(), resolution: 'kept' })
      .eq('suggestion_id', suggestionId)
      .select();
    expect(upd.data ?? []).toEqual([]);
    await alice.c.from('suggestion_reports').delete().eq('suggestion_id', suggestionId);
    const { data } = await admin.from('suggestion_reports').select('closed_at').eq('suggestion_id', suggestionId);
    expect(data).toHaveLength(1);
    expect(data[0].closed_at).toBeNull();
  });

  it('the sense functions are rejected for users and anon, and change nothing', async () => {
    for (const c of [alice.c, bob.c, anon]) {
      const moderate = await c.rpc('moderate_suggestion', { p_id: suggestionId, p_action: 'remove', p_fingerprints: [] });
      expect(moderate.error).not.toBeNull();
      const confirm = await c.rpc('confirm_sense', { p_id: suggestionId, p_index: 0 });
      expect(confirm.error).not.toBeNull();
      const allow = await c.rpc('allow_sense_again', { p_ids: [1], p_records: [] });
      expect(allow.error).not.toBeNull();
    }
    const { data } = await admin.from('ai_suggestions').select('senses').eq('id', suggestionId).single();
    expect(data.senses).toEqual([]);
  });

  it('rejected_senses is closed to users and anon', async () => {
    for (const c of [alice.c, bob.c, anon]) {
      const read = await c.from('rejected_senses').select('*');
      expect(read.error !== null || (read.data ?? []).length === 0).toBe(true);
      const write = await c.from('rejected_senses').insert({
        target_lang: 'de', native_lang: 'en', term_key: 'x', fingerprint: 'noun|x', part_of_speech: 'noun', translations: ['x'],
      });
      expect(write.error).not.toBeNull();
    }
  });

  it('ai_suggestions is closed to users and anon', async () => {
    for (const c of [alice.c, bob.c, anon]) {
      const read = await c.from('ai_suggestions').select('*');
      expect(read.error !== null || (read.data ?? []).length === 0).toBe(true);
    }
  });
});

describe('admin_users and admin_ai_calls (service role only)', () => {
  const args = { admin_users: { p_offset: 0, p_limit: 50 }, admin_ai_calls: { p_offset: 0, p_limit: 50 } };

  it.each(['admin_users', 'admin_ai_calls'])('%s is refused for users and anon', async (fn) => {
    for (const c of [alice.c, bob.c, anon]) {
      const { data, error } = await c.rpc(fn, args[fn]);
      expect(error).not.toBeNull();
      expect(data).toBeNull();
    }
  });

  it('admin_users gives counts and account fields only', async () => {
    const { data, error } = await admin.rpc('admin_users', args.admin_users);
    expect(error).toBeNull();
    const row = data.find((r) => r.email === 'alice@test.local');
    expect(Object.keys(row).sort()).toEqual([
      'ai_calls_month', 'created_at', 'email', 'id', 'input_tokens_month', 'is_admin', 'last_sign_in_at',
      'output_tokens_month', 'review_count', 'sentence_count', 'word_count',
    ]);
    expect(row).toMatchObject({ word_count: 1, review_count: 1, sentence_count: 0, ai_calls_month: 1 });
  });

  it('admin_users does not count deleted words', async () => {
    const { data: gone, error: insertError } = await admin
      .from('words')
      .insert({
        user_id: alice.id, pair_id: rows.language_pairs.id, term: 'Weg', part_of_speech: 'noun',
        translations: ['gone'], deleted_at: new Date().toISOString(),
      })
      .select()
      .single();
    expect(insertError).toBeNull();
    const { data } = await admin.rpc('admin_users', args.admin_users);
    await admin.from('words').delete().eq('id', gone.id);
    expect(data.find((r) => r.email === 'alice@test.local').word_count).toBe(1);
  });

  it('admin_ai_calls has the email and no error column', async () => {
    const { data, error } = await admin.rpc('admin_ai_calls', args.admin_ai_calls);
    expect(error).toBeNull();
    const row = data.find((r) => r.email === 'alice@test.local');
    expect(Object.keys(row).sort()).toEqual([
      'created_at', 'email', 'id', 'input_tokens', 'kind', 'latency_ms', 'model', 'ok', 'output_tokens',
    ]);
  });
});

describe('alice data is unchanged after every attempt above', () => {
  it.each(TABLES)('%s', async (t) => {
    expect(await readRow(t)).toEqual(snapshot[t]);
  });
});
