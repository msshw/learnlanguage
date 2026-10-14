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

// Gives the user a pair, as if Setup were done (default de/en). It becomes the active pair unless
// `active` is false. Returns the pair row.
export async function seedPair(admin, userId, { target = 'de', native = 'en', active = true } = {}) {
  const { data, error } = await admin
    .from('language_pairs')
    .insert({ user_id: userId, target_lang: target, native_lang: native })
    .select()
    .single();
  if (error) throw error;
  if (active) check(await admin.from('profiles').update({ active_pair_id: data.id }).eq('id', userId));
  return data;
}

// Makes the learned-state review card of a word eligible for practice and due for review.
export async function learnWord(admin, wordId) {
  const ago = (days) => new Date(Date.now() - days * 86400e3).toISOString();
  check(
    await admin
      .from('cards')
      .update({ state: 'review', due: ago(1), stability: 5, difficulty: 5, reps: 2, scheduled_days: 5, elapsed_days: 5, last_review: ago(6) })
      .eq('word_id', wordId)
      .eq('direction', 'forward'),
  );
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
