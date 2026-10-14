import { describe, expect, it } from 'vitest';
import { sessionSummary } from '../../src/js/lib/session.js';

const haus = { term: 'Haus' };
const bank = { term: 'Bank' };
const gehen = { term: 'gehen' };
const answer = (cardId, word, rating, result) => ({ cardId, word, rating, result });

describe('sessionSummary', () => {
  it('is empty for no answers', () => {
    expect(sessionSummary([])).toEqual({ reviewed: 0, remembered: 0, toWatch: [] });
  });

  it('counts Good and Easy as remembered, Again and Hard as to watch', () => {
    const s = sessionSummary([
      answer('c1', haus, 3, 'correct'),
      answer('c2', bank, 2, 'article_wrong'),
      answer('c3', gehen, 4, 'correct'),
    ]);
    expect(s.reviewed).toBe(3);
    expect(s.remembered).toBe(2);
    expect(s.toWatch).toEqual([{ word: bank, reason: 'wrong article' }]);
  });

  it('counts an Again card once, even after it is answered again', () => {
    const s = sessionSummary([answer('c1', haus, 1, 'wrong'), answer('c1', haus, 3, 'correct')]);
    expect(s).toEqual({ reviewed: 1, remembered: 0, toWatch: [{ word: haus, reason: 'wrong' }] });
  });

  it('keeps the reason of the first Again or Hard answer', () => {
    const s = sessionSummary([answer('c1', haus, 1, 'wrong'), answer('c1', haus, 2, 'typo')]);
    expect(s.toWatch).toEqual([{ word: haus, reason: 'wrong' }]);
  });

  it('names the reason when the user overrode the grade', () => {
    const s = sessionSummary([
      answer('c1', haus, 2, 'typo'),
      answer('c2', bank, 2, 'correct'),
      answer('c3', gehen, 1, 'correct'),
    ]);
    expect(s.toWatch.map((w) => w.reason)).toEqual(['typo', 'rated Hard', 'rated Again']);
  });

  it('keeps the order the words were answered in', () => {
    const s = sessionSummary([answer('c2', bank, 1, 'wrong'), answer('c1', haus, 1, 'wrong')]);
    expect(s.toWatch.map((w) => w.word)).toEqual([bank, haus]);
  });
});
