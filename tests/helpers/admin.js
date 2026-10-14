// Service-role helpers for tests. Local Supabase only; the key comes from .env and is test-only.
import { createClient } from '@supabase/supabase-js';

// Fixed ids from supabase/seed.sql
export const ALICE_ID = 'a11ce000-0000-4000-8000-000000000001';
export const BOB_ID = 'b0b00000-0000-4000-8000-000000000002';

export const adminClient = () =>
  createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

const check = ({ error }) => {
  if (error) throw error;
};

// Deletes everything the user owns. Deleting the pairs clears profiles.active_pair_id.
export async function resetUser(admin, userId) {
  for (const table of ['sentence_logs', 'sentence_cards', 'review_logs', 'cards', 'words', 'language_pairs', 'ai_calls']) {
    check(await admin.from(table).delete().eq('user_id', userId));
  }
}

// Gives the user an active de/en pair, as if Setup were done.
export async function seedPair(admin, userId) {
  const { data, error } = await admin
    .from('language_pairs')
    .insert({ user_id: userId, target_lang: 'de', native_lang: 'en' })
    .select()
    .single();
  if (error) throw error;
  check(await admin.from('profiles').update({ active_pair_id: data.id }).eq('id', userId));
  return data;
}

// Inserts a word for the user; the database trigger creates its two cards.
export async function seedWord(admin, userId, pairId, word) {
  const { data, error } = await admin
    .from('words')
    .insert({ user_id: userId, pair_id: pairId, part_of_speech: 'noun', forms: {}, ...word })
    .select()
    .single();
  if (error) throw error;
  return data;
}
