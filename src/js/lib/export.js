import { localDate } from './time.js';

// Pure. rows: { language_pairs, words, cards, review_logs } as stored, every user row, deleted words included.
export const buildExport = (rows, now) => ({
  version: 2,
  exported_at: now.toISOString(),
  language_pairs: rows.language_pairs,
  words: rows.words,
  cards: rows.cards,
  review_logs: rows.review_logs,
});

export const exportFilename = (now, tz) => `vocab-export-${localDate(now, tz)}.json`;
