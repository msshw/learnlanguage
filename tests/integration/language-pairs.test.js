// Schema checks for the language-pairs migration. Needs a running local Supabase and a .env as in rls.test.js.
import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { adminClient, ALICE_ID, BOB_ID, resetUser, seedPair } from '../helpers/admin.js';

const admin = adminClient();
const signedIn = async (email) => {
  const c = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { error } = await c.auth.signInWithPassword({ email, password: 'password123' });
  if (error) throw new Error(`sign-in as ${email} failed: ${error.message}`);
  return c;
};
const DAY = 24 * 60 * 60 * 1000;
const KEY = 'pairs-test';
let alice, bob, pair;

const cleanup = async () => {
  await resetUser(admin, ALICE_ID);
  await resetUser(admin, BOB_ID);
  await admin.from('ai_suggestions').delete().eq('term_key', KEY);
};
beforeAll(async () => {
  alice = await signedIn('alice@test.local');
  bob = await signedIn('bob@test.local');
  await cleanup();
  pair = await seedPair(admin, ALICE_ID);
});
afterAll(cleanup);

const word = (over = {}) => ({
  user_id: ALICE_ID, pair_id: pair.id, term: 'Haus', part_of_speech: 'noun', translations: ['house'], ...over,
});

describe('words and cards', () => {
  it('has the renamed word columns and not the old ones', async () => {
    const ok = await admin.from('words').select('hint_native, example_target, example_native').limit(1);
    expect(ok.error).toBeNull();
    for (const col of ['hint_en', 'example_de', 'example_en']) {
      expect((await admin.from('words').select(col).limit(1)).error).not.toBeNull();
    }
  });

  it('a new word gets forward due now, reverse due +24 h and its practice card', async () => {
    const { data: w, error } = await alice.from('words').insert(word()).select().single();
    expect(error).toBeNull();
    const { data: cards } = await admin.from('cards').select('*').eq('word_id', w.id);
    const by = Object.fromEntries(cards.map((c) => [c.direction, c]));
    expect(Object.keys(by).sort()).toEqual(['forward', 'reverse']);
    const created = new Date(w.created_at).getTime();
    expect(new Date(by.forward.due).getTime()).toBe(created);
    expect(new Date(by.reverse.due).getTime() - created).toBe(DAY);
    const { data: sc } = await admin.from('sentence_cards').select('state').eq('word_id', w.id);
    expect(sc).toEqual([{ state: 'new' }]);
  });

  it('rejects the old direction values', async () => {
    const { data: w } = await alice.from('words').insert(word({ term: 'Auto' })).select().single();
    await admin.from('cards').delete().eq('word_id', w.id);
    for (const direction of ['de_en', 'en_de']) {
      expect((await admin.from('cards').insert({ user_id: ALICE_ID, word_id: w.id, direction })).error).not.toBeNull();
    }
  });
});

describe('rename_sense_keys', () => {
  const legacy = [
    { term: 'Bank', translations: ['bank'], hint_en: 'bank (money)', example_de: 'Ich gehe zur Bank.', example_en: 'I go to the bank.', forms: { article: 'die' }, state: 'confirmed', judged: true },
    { term: 'Bank', translations: ['bench'], hint_en: 'bench (seat)', example_de: 'Die Bank ist hart.', example_en: 'The bench is hard.', forms: {}, state: 'rejected', judged: true },
    { term: 'Bank', translations: ['x'], hint_en: null, example_de: 'a', example_en: 'b', state: 'candidate', judged: false },
    { term: 'Bank', translations: ['y'], hint_en: 'h', example_de: 'c', state: 'candidate', judged: false },
  ];

  it('renames the keys and keeps values, order, state and judged', async () => {
    const { data, error } = await admin.rpc('rename_sense_keys', { p: legacy });
    expect(error).toBeNull();
    expect(data).toHaveLength(4);
    data.forEach((s, i) => {
      const old = legacy[i];
      expect(s.translations).toEqual(old.translations);
      expect(s.state).toBe(old.state);
      expect(s.judged).toBe(old.judged);
      expect(s.hint_native).toEqual(old.hint_en);
      expect(s.example_target).toEqual(old.example_de);
      expect(s.example_native).toEqual(old.example_en);
      expect(s.forms).toEqual(old.forms);
      for (const k of ['hint_en', 'example_de', 'example_en']) expect(k in s).toBe(false);
    });
    expect('example_native' in data[3]).toBe(false);
    expect(data[2].hint_native).toBeNull();
  });

  it('is closed to clients and applies to stored rows', async () => {
    expect((await alice.rpc('rename_sense_keys', { p: [] })).error).not.toBeNull();
    expect((await admin.rpc('rename_sense_keys', { p: [] })).data).toEqual([]);
  });
});

describe('language_pairs limit and hardening', () => {
  it('defaults the limit to 10 and rejects a negative one', async () => {
    expect(pair.new_words_per_day).toBe(10);
    const { error } = await alice.from('language_pairs').update({ new_words_per_day: -1 }).eq('id', pair.id);
    expect(error).not.toBeNull();
    const { data, error: e2 } = await alice.from('language_pairs').update({ new_words_per_day: 4 }).eq('id', pair.id).select();
    expect(e2).toBeNull();
    expect(data[0].new_words_per_day).toBe(4);
  });

  it('bob cannot update alice pair', async () => {
    const { data } = await bob.from('language_pairs').update({ new_words_per_day: 99 }).eq('id', pair.id).select();
    expect(data ?? []).toEqual([]);
    expect((await admin.from('language_pairs').select('new_words_per_day').eq('id', pair.id).single()).data.new_words_per_day).toBe(4);
  });

  it('clients cannot change a pair language', async () => {
    for (const patch of [{ target_lang: 'fr' }, { native_lang: 'ru' }, { user_id: BOB_ID }]) {
      expect((await alice.from('language_pairs').update(patch).eq('id', pair.id)).error).not.toBeNull();
    }
    const { data } = await admin.from('language_pairs').select('target_lang, native_lang').eq('id', pair.id).single();
    expect(data).toEqual({ target_lang: 'de', native_lang: 'en' });
  });

  it('rejects en/en and keeps one pair on a duplicate insert', async () => {
    const same = await alice.from('language_pairs').insert({ user_id: ALICE_ID, target_lang: 'en', native_lang: 'en' });
    expect(same.error).not.toBeNull();
    const dup = await alice
      .from('language_pairs')
      .upsert({ user_id: ALICE_ID, target_lang: 'de', native_lang: 'en' }, { onConflict: 'user_id,target_lang,native_lang', ignoreDuplicates: true });
    expect(dup.error).toBeNull();
    const { data } = await admin.from('language_pairs').select('id').eq('user_id', ALICE_ID).eq('target_lang', 'de').eq('native_lang', 'en');
    expect(data).toHaveLength(1);
  });

  it('profiles no longer has new_words_per_day', async () => {
    expect((await admin.from('profiles').select('new_words_per_day').limit(1)).error).not.toBeNull();
  });
});
