// Pure: no DOM, no network, no clock.

// Case-insensitive substring match on the term or any translation.
export function matchesQuery(word, query) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [word.term, ...word.translations].some((s) => s.toLowerCase().includes(needle));
}

// Earlier due date of the word's cards, or null when it has none.
export function nextDue(cards) {
  if (!cards || cards.length === 0) return null;
  return new Date(Math.min(...cards.map((c) => new Date(c.due).getTime())));
}

export const wordLabel = (word) =>
  word.part_of_speech === 'noun' && word.forms?.article ? `${word.forms.article} ${word.term}` : word.term;

// UUID shape, so a bad ?id= never reaches Postgres as a cast error.
export const isWordId = (value) =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
