// Needs a running local Supabase (`supabase start`, `supabase db reset`) and a .env with
// VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY.
import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { adminClient, ALICE_ID, BOB_ID, resetUser, seedPair } from '../helpers/admin.js';

const client = () =>
  createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });

async function signedIn(email) {
  const c = client();
  const { error } = await c.auth.signInWithPassword({ email, password: 'password123' });
  if (error) throw new Error(`sign-in as ${email} failed: ${error.message}`);
  return c;
}

const admin = adminClient();
let alice, bob, pair;

const newWord = (over = {}) => ({
  user_id: ALICE_ID,
  pair_id: pair.id,
  term: 'Haus',
  part_of_speech: 'noun',
  translations: ['house'],
  forms: { article: 'das' },
  ...over,
});

const insertWord = async (over) => {
  const { data, error } = await alice.from('words').insert(newWord(over)).select().single();
  expect(error).toBeNull();
  return data;
};

beforeAll(async () => {
  alice = await signedIn('alice@test.local');
  bob = await signedIn('bob@test.local');
  await resetUser(admin, ALICE_ID);
  await resetUser(admin, BOB_ID);
  pair = await seedPair(admin, ALICE_ID);
});

afterAll(async () => {
  await resetUser(admin, ALICE_ID);
  await resetUser(admin, BOB_ID);
});

describe('cards are created with the word', () => {
  it('creates a forward card due now and a reverse card due a day later', async () => {
    const word = await insertWord();
    const { data: cards } = await alice.from('cards').select('*').eq('word_id', word.id);

    expect(cards).toHaveLength(2);
    const byDirection = Object.fromEntries(cards.map((c) => [c.direction, c]));
    expect(byDirection.forward.state).toBe('new');
    expect(byDirection.reverse.state).toBe('new');
    expect(byDirection.forward.user_id).toBe(ALICE_ID);

    const created = new Date(word.created_at).getTime();
    expect(new Date(byDirection.forward.due).getTime()).toBe(created);
    expect(new Date(byDirection.reverse.due).getTime() - created).toBe(24 * 60 * 60 * 1000);
  });

  it('creates no cards when the word insert is rejected', async () => {
    const before = await admin.from('cards').select('id', { count: 'exact', head: true });
    const { error } = await alice.from('words').insert(newWord({ part_of_speech: 'bogus' }));
    expect(error).not.toBeNull();
    const after = await admin.from('cards').select('id', { count: 'exact', head: true });
    expect(after.count).toBe(before.count);
  });

  it('hides the cards from other users', async () => {
    const { data } = await bob.from('cards').select('*').eq('user_id', ALICE_ID);
    expect(data ?? []).toEqual([]);
  });
});

describe('updated_at', () => {
  it('is set by the database on every update and ignores the client value', async () => {
    const word = await insertWord({ term: 'Tisch' });

    const bumped = await alice.from('words').update({ notes: 'x' }).eq('id', word.id).select().single();
    expect(new Date(bumped.data.updated_at).getTime()).toBeGreaterThan(new Date(word.updated_at).getTime());

    const forged = await alice
      .from('words')
      .update({ notes: 'y', updated_at: '2000-01-01T00:00:00Z' })
      .eq('id', word.id)
      .select()
      .single();
    expect(new Date(forged.data.updated_at).getFullYear()).toBeGreaterThan(2020);
  });
});

describe('soft delete and search', () => {
  it('soft delete by update works and a real delete still does nothing', async () => {
    const word = await insertWord({ term: 'Stuhl' });

    await alice.from('words').delete().eq('id', word.id);
    const still = await admin.from('words').select('id').eq('id', word.id);
    expect(still.data).toHaveLength(1);

    const { data, error } = await alice
      .from('words')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', word.id)
      .select()
      .single();
    expect(error).toBeNull();
    expect(data.deleted_at).not.toBeNull();
  });

  it('ilike without wildcards matches ignoring case, including umlauts', async () => {
    await insertWord({ term: 'Äpfel', forms: { article: 'die' } });
    const { data } = await alice.from('words').select('term').ilike('term', 'äpfel');
    expect(data.map((w) => w.term)).toEqual(['Äpfel']);
  });

  it('an escaped underscore is literal', async () => {
    await insertWord({ term: 'abc' });
    const { data } = await alice.from('words').select('term').ilike('term', 'a\\_c');
    expect(data).toEqual([]);
  });
});
