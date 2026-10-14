import { describe, expect, it } from 'vitest';
import { buildExport, exportFilename } from '../../src/js/lib/export.js';

const now = new Date('2026-10-12T09:30:00Z');

describe('buildExport', () => {
  it('has the version, time and the three tables as given', () => {
    const rows = {
      language_pairs: [{ id: 'p1', target_lang: 'de', native_lang: 'en' }],
      words: [{ id: 'w1', deleted_at: null }, { id: 'w2', deleted_at: '2026-10-10T10:00:00Z' }],
      cards: [{ id: 'c1' }],
      review_logs: [{ id: 1 }, { id: 2 }],
    };
    expect(buildExport(rows, now)).toEqual({ version: 2, exported_at: '2026-10-12T09:30:00.000Z', ...rows });
  });

  it('keeps deleted words', () => {
    const out = buildExport({ language_pairs: [], words: [{ id: 'w', deleted_at: 'x' }], cards: [], review_logs: [] }, now);
    expect(out.words[0].deleted_at).toBe('x');
  });

  it('gives empty arrays for an empty account', () => {
    const out = buildExport({ language_pairs: [], words: [], cards: [], review_logs: [] }, now);
    expect([out.language_pairs, out.words, out.cards, out.review_logs]).toEqual([[], [], [], []]);
  });
});

describe('exportFilename', () => {
  it('uses the date in the profile timezone', () => {
    expect(exportFilename(new Date('2026-10-11T23:30:00Z'), 'Europe/Berlin')).toBe('vocab-export-2026-10-12.json');
  });

  it('does not roll over at 04:00', () => {
    expect(exportFilename(new Date('2026-10-12T01:00:00Z'), 'Europe/Berlin')).toBe('vocab-export-2026-10-12.json');
  });
});
