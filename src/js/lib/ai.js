// The only module that calls AI, and only through the AI edge functions (autofill, check-sentence).
import { validIssues } from './practice.js';

const UNAVAILABLE = { status: 'unavailable', senses: [] };
const idOrNull = (v) => (typeof v === 'string' && v ? v : null);

// db.js is loaded on demand so this module can be tested without a Supabase client.
const defaultInvoke = async (body, signal) => (await import('./db.js')).invokeAutofill(body, signal);
const defaultInvokeCheck = async (body, signal) => (await import('./db.js')).invokeCheckSentence(body, signal);

// Resolves with the response body. Rejects on timeout (aborting the request) or any failure.
async function callWithTimeout(body, invoke, timeoutMs) {
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('timeout'));
    }, timeoutMs);
  });
  try {
    const request = invoke(body, controller.signal);
    request.catch(() => {}); // an abandoned request must not become an unhandled rejection
    return await Promise.race([request, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

// Returns { status, senses, suggestionId, confirmed } (the last two only on ok) with status ok, not_a_word or unavailable. Never throws:
// timeout, network, HTTP error, error, over_cap and malformed bodies are all "unavailable".
export async function suggest(term, { invoke = defaultInvoke, timeoutMs = 8000 } = {}) {
  try {
    const data = await callWithTimeout({ term, target_lang: 'de', native_lang: 'en' }, invoke, timeoutMs);
    if (data?.status === 'ok' && Array.isArray(data.senses) && data.senses.length > 0) {
      return {
        status: 'ok',
        senses: data.senses,
        suggestionId: idOrNull(data.suggestion_id),
        confirmed: data.confirmed === true,
      };
    }
    if (data?.status === 'not_a_word') return { status: 'not_a_word', senses: [] };
    console.warn('Autofill gave no suggestions', data);
    return UNAVAILABLE;
  } catch (err) {
    console.warn('Autofill request failed', err);
    return UNAVAILABLE;
  }
}

// This month's spend: { spent, cap } in dollars, or null when it cannot be read. Never throws.
export async function getUsage({ invoke = defaultInvoke, timeoutMs = 8000 } = {}) {
  try {
    const data = await callWithTimeout({ action: 'usage' }, invoke, timeoutMs);
    if (data?.status === 'ok' && Number.isFinite(data.spent_usd) && Number.isFinite(data.cap_usd)) {
      return { spent: data.spent_usd, cap: data.cap_usd };
    }
    console.warn('Usage answer not usable', data);
    return null;
  } catch (err) {
    console.warn('Usage request failed', err);
    return null;
  }
}

// Tells the function the user saved the picked sense unchanged. Sends only the id and index.
// Returns true on success; never throws.
export async function confirmSuggestion(id, senseIndex, { invoke = defaultInvoke, timeoutMs = 8000 } = {}) {
  try {
    const data = await callWithTimeout({ action: 'confirm', suggestion_id: id, sense_index: senseIndex }, invoke, timeoutMs);
    return data?.status === 'ok';
  } catch (err) {
    console.warn('Confirm request failed', err);
    return false;
  }
}

// Checks a sentence written with one of the user's words. The server reads the word itself; only the
// id and the sentence are sent. Returns { status: 'ok', corrected, usesWord, issues } or
// { status: 'unavailable' }. Never throws and never retries: timeout (10 s), network, HTTP error,
// error, over_cap and an unusable body (bad offsets, overlaps) are all "unavailable".
export async function checkSentence(wordId, sentence, { invoke = defaultInvokeCheck, timeoutMs = 10000 } = {}) {
  try {
    const data = await callWithTimeout({ word_id: wordId, sentence }, invoke, timeoutMs);
    const issues = data?.status === 'ok' ? validIssues(sentence, data.issues) : null;
    if (issues && typeof data.corrected === 'string' && typeof data.uses_word === 'boolean') {
      return { status: 'ok', corrected: data.corrected, usesWord: data.uses_word, issues };
    }
    console.warn('Sentence check not usable', data);
    return { status: 'unavailable' };
  } catch (err) {
    console.warn('Sentence check failed', err);
    return { status: 'unavailable' };
  }
}
