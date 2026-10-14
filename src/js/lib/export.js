import { localDate } from './time.js';

// Pure. rows: { words, cards, review_logs } as stored, every user row, deleted words included.
export const buildExport = (rows, now) => ({
  version: 1,
  exported_at: now.toISOString(),
  words: rows.words,
  cards: rows.cards,
  review_logs: rows.review_logs,
});

export const exportFilename = (now, tz) => `vocab-export-${localDate(now, tz)}.json`;
