// Needs a running local Supabase (`supabase start`, `supabase db reset`) and a .env with
// VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY.
import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { adminClient, ALICE_ID, BOB_ID, resetUser, seedPair, seedWord } from '../helpers/admin.js';

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
let alice, bob, anon, pair;
let seq = 0;

async function newWord() {
  seq += 1;
  const word = await seedWord(admin, ALICE_ID, pair.id, { term: `Satz${seq}`, translations: ['x'] });
  const { data } = await admin.from('sentence_cards').select('*').eq('word_id', word.id);
  expect(data).toHaveLength(1);
  return { word, card: data[0] };
}

const payload = (cardId, practicedAt, over = {}) => ({
  sentence_card_id: cardId,
  practiced_at: practicedAt,
  sentence: 'Ich gehe zu die Bank.',
  corrected: 'Ich gehe zur Bank.',
  issues: [{ start: 9, end: 15, message: 'zu takes the dative.' }],
  check_status: 'ok',
  rating: 2,
  state_before: { state: 'new' },
  duration_ms: 4000,
  next: {
    state: 'review',
    due: '2026-10-20T09:00:00.000Z',
    stability: 3.2,
    difficulty: 5.1,
    elapsed_days: 0,
    scheduled_days: 8,
    learning_steps: 0,
    reps: 1,
    lapses: 0,
    last_review: practicedAt,
  },
  ...over,
});

const logsOf = async (cardId) => (await admin.from('sentence_logs').select('*').eq('sentence_card_id', cardId)).data;
const cardOf = async (id) => (await admin.from('sentence_cards').select('*').eq('id', id).single()).data;

const T1 = '2026-10-12T09:00:00.000Z';
const T2 = '2026-10-12T10:00:00.000Z';

beforeAll(async () => {
  alice = await signedIn('alice@test.local');
  bob = await signedIn('bob@test.local');
  anon = client();
  await resetUser(admin, ALICE_ID);
  await resetUser(admin, BOB_ID);
  pair = await seedPair(admin, ALICE_ID);
});

afterAll(async () => {
  await resetUser(admin, ALICE_ID);
  await resetUser(admin, BOB_ID);
});

describe('practice cards', () => {
  it('creates one new practice card per word, next to the two review cards', async () => {
    const { word, card } = await newWord();
    expect(card).toMatchObject({ user_id: ALICE_ID, state: 'new', reps: 0, learning_steps: 0 });
    const reviewCards = await admin.from('cards').select('id').eq('word_id', word.id);
    expect(reviewCards.data).toHaveLength(2);
  });

  it('backfill statement adds a missing card and never duplicates', async () => {
    const { word, card } = await newWord();
    await admin.from('sentence_cards').delete().eq('id', card.id);
    // Same conflict rule as the migration backfill (insert ... on conflict (word_id) do nothing).
    const upsert = () =>
      admin
        .from('sentence_cards')
        .upsert({ user_id: ALICE_ID, word_id: word.id }, { onConflict: 'word_id', ignoreDuplicates: true });
    expect((await upsert()).error).toBeNull();
    expect((await upsert()).error).toBeNull();
    expect((await admin.from('sentence_cards').select('id').eq('word_id', word.id)).data).toHaveLength(1);
  });

  it('allows only one practice card per word', async () => {
    const { word } = await newWord();
    const { error } = await admin.from('sentence_cards').insert({ user_id: ALICE_ID, word_id: word.id });
    expect(error).not.toBeNull();
  });
});

describe('RLS', () => {
  it('hides alice cards and logs from bob', async () => {
    const { card } = await newWord();
    await alice.rpc('record_sentence', { p: payload(card.id, T1) });
    expect((await bob.from('sentence_cards').select('*').eq('id', card.id)).data).toEqual([]);
    expect((await bob.from('sentence_logs').select('*').eq('sentence_card_id', card.id)).data).toEqual([]);
    expect((await alice.from('sentence_cards').select('*').eq('id', card.id)).data).toHaveLength(1);
    expect((await alice.from('sentence_logs').select('*').eq('sentence_card_id', card.id)).data).toHaveLength(1);
  });

  it('hides everything from anonymous users', async () => {
    const { data } = await anon.from('sentence_cards').select('*');
    expect(data ?? []).toEqual([]);
  });

  it("rejects a practice card on another user's word", async () => {
    const { word, card } = await newWord();
    await admin.from('sentence_cards').delete().eq('id', card.id);
    const { error } = await bob.from('sentence_cards').insert({ user_id: BOB_ID, word_id: word.id });
    expect(error).not.toBeNull();
  });

  it("rejects a log on another user's card", async () => {
    const { card } = await newWord();
    const row = {
      user_id: BOB_ID,
      sentence_card_id: card.id,
      sentence: 'x',
      check_status: 'unavailable',
      rating: 3,
      state_before: {},
    };
    expect((await bob.from('sentence_logs').insert(row)).error).not.toBeNull();
    expect((await alice.from('sentence_logs').insert({ ...row, user_id: BOB_ID })).error).not.toBeNull();
    expect((await alice.from('sentence_logs').insert({ ...row, user_id: ALICE_ID })).error).toBeNull();
  });

  it('keeps logs append-only: updates change nothing', async () => {
    const { card } = await newWord();
    await alice.rpc('record_sentence', { p: payload(card.id, T1) });
    await alice.from('sentence_logs').update({ rating: 4 }).eq('sentence_card_id', card.id);
    expect((await logsOf(card.id))[0].rating).toBe(2);
  });

  it('refuses deletes of cards and logs', async () => {
    const { card } = await newWord();
    await alice.rpc('record_sentence', { p: payload(card.id, T1) });
    await alice.from('sentence_logs').delete().eq('sentence_card_id', card.id);
    await alice.from('sentence_cards').delete().eq('id', card.id);
    expect(await logsOf(card.id)).toHaveLength(1);
    expect(await cardOf(card.id)).not.toBeNull();
  });

  it('rejects an over-long sentence', async () => {
    const { card } = await newWord();
    const { error } = await alice.rpc('record_sentence', {
      p: payload(card.id, T1, { sentence: 'a'.repeat(301) }),
    });
    expect(error).not.toBeNull();
    expect(await logsOf(card.id)).toEqual([]);
  });
});

describe('record_sentence', () => {
  it('logs the attempt and moves the practice card, leaving review data alone', async () => {
    const { word, card } = await newWord();
    const reviewBefore = (await admin.from('cards').select('*').eq('word_id', word.id)).data;
    const { error } = await alice.rpc('record_sentence', { p: payload(card.id, T1) });
    expect(error).toBeNull();

    const logs = await logsOf(card.id);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      user_id: ALICE_ID,
      sentence: 'Ich gehe zu die Bank.',
      corrected: 'Ich gehe zur Bank.',
      check_status: 'ok',
      rating: 2,
      duration_ms: 4000,
    });
    expect(logs[0].state_before).toEqual({ state: 'new' });
    expect(logs[0].issues).toHaveLength(1);

    const after = await cardOf(card.id);
    expect(after).toMatchObject({ state: 'review', reps: 1, scheduled_days: 8 });
    expect(new Date(after.last_review).toISOString()).toBe(T1);

    expect((await admin.from('cards').select('*').eq('word_id', word.id)).data).toEqual(reviewBefore);
    const reviewLogs = await admin.from('review_logs').select('id').in('card_id', reviewBefore.map((c) => c.id));
    expect(reviewLogs.data).toEqual([]);
  });

  it('is repeatable: the same attempt twice gives one log row', async () => {
    const { card } = await newWord();
    expect((await alice.rpc('record_sentence', { p: payload(card.id, T1) })).error).toBeNull();
    expect((await alice.rpc('record_sentence', { p: payload(card.id, T1) })).error).toBeNull();
    expect(await logsOf(card.id)).toHaveLength(1);
    expect((await cardOf(card.id)).reps).toBe(1);
  });

  it("rejects another user's card and writes nothing", async () => {
    const { card } = await newWord();
    const before = await cardOf(card.id);
    const { error } = await bob.rpc('record_sentence', { p: payload(card.id, T1) });
    expect(error).not.toBeNull();
    expect(await logsOf(card.id)).toEqual([]);
    expect(await cardOf(card.id)).toEqual(before);
  });

  it('logs a late arrival but keeps the newer card state', async () => {
    const { card } = await newWord();
    await alice.rpc('record_sentence', { p: payload(card.id, T2, { rating: 4 }) });
    const late = payload(card.id, T1, { rating: 1 });
    late.next.reps = 99;
    expect((await alice.rpc('record_sentence', { p: late })).error).toBeNull();
    expect(await logsOf(card.id)).toHaveLength(2);
    const after = await cardOf(card.id);
    expect(after.reps).toBe(1);
    expect(new Date(after.last_review).toISOString()).toBe(T2);
  });

  it('forces the log owner to the caller', async () => {
    const { card } = await newWord();
    await alice.rpc('record_sentence', { p: payload(card.id, T1, { user_id: BOB_ID }) });
    expect((await logsOf(card.id))[0].user_id).toBe(ALICE_ID);
  });

  it('is not available to anonymous users', async () => {
    const { card } = await newWord();
    const { error } = await anon.rpc('record_sentence', { p: payload(card.id, T1) });
    expect(error).not.toBeNull();
    expect(await logsOf(card.id)).toEqual([]);
  });

  it('writes nothing when the call fails halfway', async () => {
    const { card } = await newWord();
    const bad = payload(card.id, T1);
    bad.next.reps = 'not a number';
    const { error } = await alice.rpc('record_sentence', { p: bad });
    expect(error).not.toBeNull();
    expect(await logsOf(card.id)).toEqual([]);
    expect((await cardOf(card.id)).reps).toBe(0);
  });
});
