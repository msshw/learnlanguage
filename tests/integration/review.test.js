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
let alice, bob, anon, pair;
let seq = 0;

async function newCard() {
  seq += 1;
  const word = await alice
    .from('words')
    .insert({
      user_id: ALICE_ID,
      pair_id: pair.id,
      term: `Wort${seq}`,
      part_of_speech: 'verb',
      translations: ['x'],
    })
    .select()
    .single();
  const card = await alice
    .from('cards')
    .select('*')
    .eq('word_id', word.data.id)
    .eq('direction', 'forward')
    .single();
  expect(card.error).toBeNull();
  return card.data;
}

const payload = (cardId, reviewedAt, over = {}) => ({
  card_id: cardId,
  reviewed_at: reviewedAt,
  typed_answer: 'house',
  grader_result: 'correct',
  rating: 3,
  overridden: false,
  state_before: { state: 'new' },
  duration_ms: 1200,
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
    last_review: reviewedAt,
  },
  ...over,
});

const logsOf = async (cardId) => (await admin.from('review_logs').select('*').eq('card_id', cardId)).data;
const cardOf = async (id) => (await admin.from('cards').select('*').eq('id', id).single()).data;

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

describe('record_review', () => {
  it('logs the answer and moves the card for the owner', async () => {
    const card = await newCard();
    const { error } = await alice.rpc('record_review', { p: payload(card.id, T1) });
    expect(error).toBeNull();

    const logs = await logsOf(card.id);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ user_id: ALICE_ID, rating: 3, typed_answer: 'house', duration_ms: 1200 });
    expect(logs[0].state_before).toEqual({ state: 'new' });

    const after = await cardOf(card.id);
    expect(after).toMatchObject({ state: 'review', reps: 1, scheduled_days: 8, learning_steps: 0 });
    expect(new Date(after.last_review).toISOString()).toBe(T1);
  });

  it('rejects another user and writes nothing', async () => {
    const card = await newCard();
    const before = await cardOf(card.id);
    const { error } = await bob.rpc('record_review', { p: payload(card.id, T1) });
    expect(error).not.toBeNull();
    expect(await logsOf(card.id)).toEqual([]);
    expect(await cardOf(card.id)).toEqual(before);
  });

  it('is repeatable: the same answer twice gives one log row', async () => {
    const card = await newCard();
    expect((await alice.rpc('record_review', { p: payload(card.id, T1) })).error).toBeNull();
    expect((await alice.rpc('record_review', { p: payload(card.id, T1) })).error).toBeNull();
    expect(await logsOf(card.id)).toHaveLength(1);
    expect((await cardOf(card.id)).reps).toBe(1);
  });

  it('logs a late arrival but keeps the newer card state', async () => {
    const card = await newCard();
    await alice.rpc('record_review', { p: payload(card.id, T2, { rating: 4 }) });
    const late = payload(card.id, T1, { rating: 1 });
    late.next.reps = 99;
    expect((await alice.rpc('record_review', { p: late })).error).toBeNull();

    expect(await logsOf(card.id)).toHaveLength(2);
    const after = await cardOf(card.id);
    expect(after.reps).toBe(1);
    expect(new Date(after.last_review).toISOString()).toBe(T2);
  });

  it('forces the log owner to the caller', async () => {
    const card = await newCard();
    await alice.rpc('record_review', { p: payload(card.id, T1, { user_id: BOB_ID }) });
    expect((await logsOf(card.id))[0].user_id).toBe(ALICE_ID);
  });

  it('is not available to anonymous users', async () => {
    const card = await newCard();
    const { error } = await anon.rpc('record_review', { p: payload(card.id, T1) });
    expect(error).not.toBeNull();
    expect(await logsOf(card.id)).toEqual([]);
  });

  it('creates neither log nor card change when the call fails halfway', async () => {
    const card = await newCard();
    const bad = payload(card.id, T1);
    bad.next.reps = 'not a number';
    const { error } = await alice.rpc('record_review', { p: bad });
    expect(error).not.toBeNull();
    expect(await logsOf(card.id)).toEqual([]);
    expect((await cardOf(card.id)).reps).toBe(0);
  });
});

describe('schema', () => {
  it('rejects a second log row with the same card and answer time', async () => {
    const card = await newCard();
    const row = {
      user_id: ALICE_ID,
      card_id: card.id,
      reviewed_at: T1,
      typed_answer: 'x',
      grader_result: 'wrong',
      rating: 1,
      state_before: {},
    };
    expect((await alice.from('review_logs').insert(row)).error).toBeNull();
    expect((await alice.from('review_logs').insert(row)).error).not.toBeNull();
  });

  it('defaults learning_steps to 0 and rejects a negative value', async () => {
    const card = await newCard();
    expect(card.learning_steps).toBe(0);
    const { error } = await alice.from('cards').update({ learning_steps: -1 }).eq('id', card.id);
    expect(error).not.toBeNull();
  });
});
