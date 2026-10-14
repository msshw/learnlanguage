// Pure: no DOM, no network, no clock.
import { t } from './i18n.js';

export const PARTS_OF_SPEECH = ['noun', 'verb', 'adjective', 'adverb', 'phrase', 'other'];

export const normalizeTerm = (s) => String(s ?? '').trim().replace(/\s+/g, ' ');

const splitList = (s) =>
  String(s ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

const optional = (s) => {
  const v = String(s ?? '').trim();
  return v === '' ? null : v;
};

// raw: the form's values as strings. profile: from languages.js (forms, articles, auxiliaries).
// Returns { ok: true, value } or { ok: false, errors }.
// value has no user_id, pair_id or source; db.js adds those on insert.
export function buildWord(raw, profile, lang = 'en') {
  const errors = {};
  const term = normalizeTerm(raw.term);
  const partOfSpeech = raw.part_of_speech;
  const translations = splitList(raw.translations);
  const forms = {};

  if (!term) errors.term = t(lang, 'wordFormError.term');
  if (!PARTS_OF_SPEECH.includes(partOfSpeech)) errors.part_of_speech = t(lang, 'wordFormError.partOfSpeech');
  if (translations.length === 0) errors.translations = t(lang, 'wordFormError.translations');

  for (const key of profile.forms[partOfSpeech] ?? []) {
    const v = optional(raw[key]);
    if (key === 'article') {
      if (profile.articles.includes(v)) forms.article = v;
      else errors.article = t(lang, 'wordFormError.article');
      if (new RegExp(`^(${profile.articles.join('|')})\\s`, 'i').test(term)) {
        errors.term = t(lang, 'wordFormError.articleInTerm');
      }
    } else if (key === 'auxiliary') {
      if (v && profile.auxiliaries.includes(v)) forms.auxiliary = v;
      else if (v) errors.auxiliary = t(lang, 'wordFormError.auxiliary', { options: profile.auxiliaries.join(` ${t(lang, 'wordFormError.or')} `) });
    } else if (v) forms[key] = v;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      term,
      part_of_speech: partOfSpeech,
      translations,
      hint_native: optional(raw.hint_native),
      forms,
      example_target: optional(raw.example_target),
      example_native: optional(raw.example_native),
      notes: optional(raw.notes),
      tags: splitList(raw.tags),
    },
  };
}

// A suggested sense as a word-shaped object, so the form can fill from it like from a saved word.
export const senseToFormValues = (sense) => ({
  term: sense.term,
  part_of_speech: sense.part_of_speech,
  translations: sense.translations,
  hint_native: sense.hint_native,
  forms: sense.forms ?? {},
  example_target: sense.example_target,
  example_native: sense.example_native,
  notes: null,
  tags: [],
});

// True when a built word still equals the picked sense after the form's cleanup.
// Notes and tags are not compared: the sense has neither.
export function matchesSense(value, sense) {
  const text = (s) => optional(s) ?? null;
  const entries = (o) => JSON.stringify(Object.entries(o ?? {}).sort(([a], [b]) => (a < b ? -1 : 1)));
  return (
    value.term === normalizeTerm(sense.term) &&
    value.part_of_speech === sense.part_of_speech &&
    JSON.stringify(value.translations) === JSON.stringify(sense.translations.map((t) => t.trim())) &&
    value.hint_native === text(sense.hint_native) &&
    entries(value.forms) === entries(sense.forms) &&
    value.example_target === text(sense.example_target) &&
    value.example_native === text(sense.example_native)
  );
}

// What to confirm after a save, or null: the picked sense of a stored suggestion, only while it is
// still a candidate and the word was saved unchanged. Returns { id, index } with the sense's
// stored index (not its position in the list).
export function confirmTarget(picked, suggestionId, value) {
  if (!picked || !suggestionId || picked.sense.state !== 'candidate') return null;
  if (!Number.isInteger(picked.sense.index) || !matchesSense(value, picked.sense)) return null;
  return { id: suggestionId, index: picked.sense.index };
}
