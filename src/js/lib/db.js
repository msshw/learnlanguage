import { createClient } from '@supabase/supabase-js';
import { normalizeTerm } from './word-form.js';

// The only file in src/ that imports supabase-js.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);

const unwrap = ({ data, error }) => {
  if (error) throw error;
  return data;
};

async function currentUserId() {
  const { data } = await supabase.auth.getSession();
  return data.session.user.id;
}

// profile and language pairs

export async function getProfile() {
  const id = await currentUserId();
  return unwrap(await supabase.from('profiles').select('*').eq('id', id).single());
}

// Upsert on the unique key, so a retry after a half failure converges.
export async function createActivePair(targetLang, nativeLang) {
  const userId = await currentUserId();
  const pair = unwrap(
    await supabase
      .from('language_pairs')
      .upsert(
        { user_id: userId, target_lang: targetLang, native_lang: nativeLang },
        { onConflict: 'user_id,target_lang,native_lang' },
      )
      .select()
      .single(),
  );
  unwrap(await supabase.from('profiles').update({ active_pair_id: pair.id }).eq('id', userId).select().single());
  return pair;
}

export async function updateProfileLimit(limit) {
  const id = await currentUserId();
  return unwrap(
    await supabase.from('profiles').update({ new_words_per_day: limit }).eq('id', id).select().single(),
  );
}

// words: every read goes through activeWords so deleted rows never leak into the app.

const activeWords = (pairId, columns = '*', options) =>
  supabase.from('words').select(columns, options).eq('pair_id', pairId).is('deleted_at', null);

export async function countWords(pairId) {
  const { count, error } = await activeWords(pairId, 'id', { count: 'exact', head: true });
  if (error) throw error;
  return count;
}

export async function listWords(pairId) {
  return unwrap(await activeWords(pairId, '*, cards(due)').order('created_at', { ascending: false }));
}

// One active word by id, or null. RLS limits it to the caller's own words.
export async function getWord(id) {
  return unwrap(await supabase.from('words').select('*').eq('id', id).is('deleted_at', null).maybeSingle());
}

// ilike with the wildcards escaped is a case-insensitive equality check.
export async function findDuplicates(pairId, term) {
  const escaped = normalizeTerm(term).replace(/[\\%_]/g, '\\$&');
  return unwrap(await activeWords(pairId, 'id, term').ilike('term', escaped));
}

// The database trigger creates the word's two cards.
export async function insertWord(pairId, value, source = 'manual') {
  const userId = await currentUserId();
  return unwrap(
    await supabase
      .from('words')
      .insert({ ...value, user_id: userId, pair_id: pairId, source })
      .select()
      .single(),
  );
}

export async function updateWord(id, value) {
  return unwrap(
    await supabase.from('words').update(value).eq('id', id).is('deleted_at', null).select().single(),
  );
}

export async function softDeleteWord(id) {
  unwrap(
    await supabase
      .from('words')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single(),
  );
}

// review

// PostgREST returns at most 1000 rows per request, so read in pages.
async function fetchAll(build) {
  const size = 1000;
  const rows = [];
  for (let from = 0; ; from += size) {
    const page = unwrap(await build().range(from, from + size - 1));
    rows.push(...page);
    if (page.length < size) return rows;
  }
}

// ponytail: every card of the pair is loaded on each Home and Review visit. A few thousand
// words is fine; past that, filter by due date in the query and fetch siblings separately.
export async function listQueueCards(pairId) {
  const rows = await fetchAll(() =>
    supabase
      .from('cards')
      .select('*, words!inner(*)')
      .eq('words.pair_id', pairId)
      .is('words.deleted_at', null)
      .order('id'),
  );
  return rows.map(({ words, ...card }) => ({ ...card, word: words }));
}

// Answers given since `start`, with the card direction (needed even if the word was deleted since).
export async function listLogsSince(start) {
  return fetchAll(() =>
    supabase
      .from('review_logs')
      .select('card_id, reviewed_at, state_before, cards(direction)')
      .gte('reviewed_at', start.toISOString())
      .order('id'),
  );
}

// One transaction: appends the log row and moves the card. Safe to call again with the same payload.
export async function recordReview(payload) {
  const { error } = await supabase.rpc('record_review', { p: payload });
  if (error) throw error;
}

// practice: sentence cards are separate from review cards

// Practice cards of the pair's active words, each with its word and the state of the word's de_en review card.
export async function listPracticeCards(pairId) {
  const rows = await fetchAll(() =>
    supabase
      .from('sentence_cards')
      .select('*, words!inner(*, cards(direction, state))')
      .eq('words.pair_id', pairId)
      .is('words.deleted_at', null)
      .order('id'),
  );
  return rows.map(({ words: { cards, ...word }, ...card }) => ({
    ...card,
    word,
    deEnState: cards.find((c) => c.direction === 'de_en')?.state ?? null,
  }));
}

// Attempts made since `start`.
export async function listPracticeLogsSince(start) {
  return fetchAll(() =>
    supabase
      .from('sentence_logs')
      .select('sentence_card_id, practiced_at, state_before')
      .gte('practiced_at', start.toISOString())
      .order('id'),
  );
}

// One transaction: appends the log row and moves the practice card. Safe to call again with the same payload.
export async function recordSentence(payload) {
  const { error } = await supabase.rpc('record_sentence', { p: payload });
  if (error) throw error;
}

// ai: the autofill edge function. Throws on any HTTP or network failure; ai.js maps that to a fallback.

export async function invokeAutofill(body, signal) {
  const { data, error } = await supabase.functions.invoke('autofill', { body, signal });
  if (error) throw error;
  return data;
}

// The check-sentence edge function. Throws on any HTTP or network failure; ai.js maps that to a fallback.
export async function invokeCheckSentence(body, signal) {
  const { data, error } = await supabase.functions.invoke('check-sentence', { body, signal });
  if (error) throw error;
  return data;
}

export const REPORT_MIN = 50;
export const REPORT_MAX = 2000;

// Reports a stored suggestion by id with a reason (50 to 2000 characters after trimming). A repeat
// report hits the unique key and counts as done. No select(): users have no read access to reports.
export async function reportSuggestion(id, reason) {
  const text = String(reason ?? '').trim();
  if (text.length < REPORT_MIN || text.length > REPORT_MAX) throw new Error('reason length');
  const userId = await currentUserId();
  const { error } = await supabase
    .from('suggestion_reports')
    .insert({ user_id: userId, suggestion_id: id, reason: text });
  if (error && error.code !== '23505') throw error;
}

// The admin edge function. A 403 means the caller is not an admin: { status: 'forbidden' }.
// Every other failure throws.
export async function invokeAdmin(body) {
  const { data, error } = await supabase.functions.invoke('admin', { body });
  if (error) {
    if (error.context?.status === 403) return { status: 'forbidden' };
    throw error;
  }
  return data;
}

// Everything the user owns, for the export. Words include deleted ones, on purpose (unlike activeWords).
// RLS limits each table to the caller's rows. All three reads must succeed, or this throws.
export async function exportRows() {
  const all = (table) => fetchAll(() => supabase.from(table).select('*').order('id'));
  const [words, cards, review_logs] = await Promise.all([all('words'), all('cards'), all('review_logs')]);
  return { words, cards, review_logs };
}
