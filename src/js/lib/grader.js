// Pure: no DOM, no network, no clock.
const RATING = { correct: 3, typo: 3, article_wrong: 2, wrong: 1 };

import { profileOf } from './languages.js';

// NFC, trim, lowercase, collapse spaces, then the typing equivalences of the language typed.
export const normalize = (s, lang) =>
  profileOf(lang).fold.reduce(
    (acc, [from, to]) => acc.replaceAll(from, to),
    String(s ?? '').normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' '),
  );

// Typos are only forgiven in words of 4+ letters, counted before typing equivalences are applied.
const letterCount = (s) => String(s).normalize('NFC').toLowerCase().replace(/\s/g, '').length;

// Exactly one inserted, deleted or substituted character. A swap of two letters is two edits.
function oneEdit(a, b) {
  if (a === b) return false;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (long.length - short.length > 1) return false;
  if (long.length === short.length) {
    let diffs = 0;
    for (let i = 0; i < short.length; i++) if (short[i] !== long[i]) diffs++;
    return diffs === 1;
  }
  let i = 0;
  while (i < short.length && short[i] === long[i]) i++;
  return short.slice(i) === long.slice(i + 1);
}

const result = (kind, expected) => ({ result: kind, rating: RATING[kind], expected });

// forward: the user types a native translation; any listed one counts.
function gradeTranslation(typed, translations, lang) {
  for (const t of translations) if (normalize(t, lang) === typed) return result('correct', t);
  for (const t of translations) {
    if (letterCount(t) >= 4 && oneEdit(normalize(t, lang), typed)) return result('typo', t);
  }
  return result('wrong', translations.join(', '));
}

// reverse: the user types the target term; nouns carry their article when the profile has articles.
function gradeTerm(typed, word, lang) {
  const profile = profileOf(lang);
  const term = normalize(word.term, lang);
  const article = word.part_of_speech === 'noun' && profile.articles.length ? word.forms?.article : null;
  const expected = article ? `${article} ${word.term}` : word.term;
  const typoAllowed = letterCount(word.term) >= 4;

  if (!article) {
    if (typed === term) return result('correct', expected);
    if (typoAllowed && oneEdit(term, typed)) return result('typo', expected);
    return result('wrong', expected);
  }

  const match = typed.match(new RegExp(`^(${profile.articles.join('|')})\\s+(.+)$`));
  const typedArticle = match ? match[1] : null;
  const typedTerm = match ? match[2] : typed;

  if (typedTerm === term) {
    return typedArticle === article ? result('correct', expected) : result('article_wrong', expected);
  }
  if (typoAllowed && oneEdit(term, typedTerm) && typedArticle === article) return result('typo', expected);
  return result('wrong', expected);
}

// answer: the text as typed. word: { term, part_of_speech, forms, translations }.
// direction: 'forward' (target shown, native typed) or 'reverse'. pair: { target_lang, native_lang }.
// Returns { result, rating, expected }.
export function grade(answer, word, direction, pair) {
  if (direction === 'forward') {
    return gradeTranslation(normalize(answer, pair.native_lang), word.translations, pair.native_lang);
  }
  return gradeTerm(normalize(answer, pair.target_lang), word, pair.target_lang);
}
