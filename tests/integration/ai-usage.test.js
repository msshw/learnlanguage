// Needs a running local Supabase (`supabase start`, `supabase db reset`) and a .env with
// VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY.
import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { adminClient, ALICE_ID, BOB_ID, resetUser } from '../helpers/admin.js';

const client = () =>
  createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });

const admin = adminClient();
let alice;
const anon = client();

const call = (user_id, created_at, input_tokens, output_tokens) => ({
  user_id,
  created_at,
  input_tokens,
  output_tokens,
  model: 'test-model',
  ok: true,
});

const usage = async (user, from) => {
  const { data, error } = await admin.rpc('ai_usage_since', { p_user: user, p_from: from });
  expect(error).toBeNull();
  return data[0];
};

beforeAll(async () => {
  alice = client();
  const { error } = await alice.auth.signInWithPassword({ email: 'alice@test.local', password: 'password123' });
  if (error) throw error;
  await resetUser(admin, ALICE_ID);
  await resetUser(admin, BOB_ID);
});

afterAll(async () => {
  await resetUser(admin, ALICE_ID);
  await resetUser(admin, BOB_ID);
});

describe('ai_usage_since', () => {
  it('returns zero when there are no rows', async () => {
    expect(await usage(ALICE_ID, '2026-10-01T00:00:00Z')).toEqual({ input_tokens: 0, output_tokens: 0 });
  });

  it('sums rows at or after the start time, for that user only', async () => {
    const rows = [
      call(ALICE_ID, '2026-09-30T23:59:59Z', 1000, 100),
      call(ALICE_ID, '2026-10-01T00:00:00Z', 10, 1),
      call(ALICE_ID, '2026-10-05T12:00:00Z', 20, 2),
      call(BOB_ID, '2026-10-05T12:00:00Z', 500, 50),
    ];
    const { error } = await admin.from('ai_calls').insert(rows);
    expect(error).toBeNull();
    expect(await usage(ALICE_ID, '2026-10-01T00:00:00Z')).toEqual({ input_tokens: 30, output_tokens: 3 });
    expect(await usage(BOB_ID, '2026-10-01T00:00:00Z')).toEqual({ input_tokens: 500, output_tokens: 50 });
  });

  it('is rejected for a signed-in user', async () => {
    const { error } = await alice.rpc('ai_usage_since', { p_user: ALICE_ID, p_from: '2026-10-01T00:00:00Z' });
    expect(error).not.toBeNull();
  });

  it('is rejected for an anonymous client', async () => {
    const { error } = await anon.rpc('ai_usage_since', { p_user: ALICE_ID, p_from: '2026-10-01T00:00:00Z' });
    expect(error).not.toBeNull();
  });
});

describe('ai_calls access', () => {
  it('lets the owner read their rows', async () => {
    const { data, error } = await alice.from('ai_calls').select('user_id');
    expect(error).toBeNull();
    expect(data.length).toBeGreaterThan(0);
    expect(data.every((r) => r.user_id === ALICE_ID)).toBe(true);
  });

  it('rejects an insert by a signed-in user', async () => {
    const { error } = await alice.from('ai_calls').insert(call(ALICE_ID, new Date().toISOString(), 1, 1));
    expect(error).not.toBeNull();
  });
});
