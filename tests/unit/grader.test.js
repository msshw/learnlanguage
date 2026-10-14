import { describe, expect, it } from 'vitest';
import { grade } from '../../src/js/lib/grader.js';

const noun = (term, article, translations = ['x']) => ({
  term,
  part_of_speech: 'noun',
  forms: { article },
  translations,
});
const verb = (term, translations = ['x']) => ({ term, part_of_speech: 'verb', forms: {}, translations });

const DE = { target_lang: 'de', native_lang: 'en' };
const haus = noun('Haus', 'das', ['house', 'home']);

describe('normalization', () => {
  it.each([
    ['maedchen', verb('Mädchen')],
    ['das maedchen', noun('Mädchen', 'das')],
    ['DAS   MÄDCHEN', noun('Mädchen', 'das')],
    ['strasse', verb('Straße')],
    ['STRASSE', verb('Straße')],
    ['  zu   hause ', verb('zu Hause')],
  ])('%j is correct', (answer, word) => {
    expect(grade(answer, word, 'reverse', DE).result).toBe('correct');
  });

  it('treats ü and ue the same when German is the typed language in forward', () => {
    expect(grade('Muede', { translations: ['müde'] }, 'forward', { target_lang: 'en', native_lang: 'de' }).result).toBe('correct');
  });
});

describe('forward', () => {
  it('accepts any listed translation', () => {
    expect(grade('home', haus, 'forward', DE)).toEqual({ result: 'correct', rating: 3, expected: 'home' });
    expect(grade('House', haus, 'forward', DE).result).toBe('correct');
  });

  it('forgives one letter in a translation of four or more letters', () => {
    expect(grade('hous', haus, 'forward', DE)).toEqual({ result: 'typo', rating: 3, expected: 'house' });
  });

  it('checks typos against each translation', () => {
    expect(grade('homme', haus, 'forward', DE)).toEqual({ result: 'typo', rating: 3, expected: 'home' });
  });

  it('does not forgive typos in short translations', () => {
    const ear = { translations: ['ear'] };
    expect(grade('ier', ear, 'forward', DE).result).toBe('wrong');
  });

  it('reports all translations when wrong', () => {
    expect(grade('cat', haus, 'forward', DE)).toEqual({ result: 'wrong', rating: 1, expected: 'house, home' });
  });
});

describe('typos in reverse', () => {
  it('forgives one substituted, missing or extra letter', () => {
    const w = verb('gehen');
    expect(grade('gehan', w, 'reverse', DE).result).toBe('typo');
    expect(grade('gehn', w, 'reverse', DE).result).toBe('typo');
    expect(grade('gehhen', w, 'reverse', DE).result).toBe('typo');
  });

  it('reports the correct spelling and rates Good', () => {
    expect(grade('das hous', noun('Haus', 'das'), 'reverse', DE).expected).toBe('das Haus');
    expect(grade('das hous', noun('Haus', 'das'), 'reverse', DE).rating).toBe(3);
  });

  it('does not forgive words under four letters', () => {
    expect(grade('Ohr', noun('Uhr', 'die'), 'reverse', DE).result).toBe('wrong');
    expect(grade('die Ohr', noun('Uhr', 'die'), 'reverse', DE).result).toBe('wrong');
  });

  it('counts letters before ä is expanded to ae', () => {
    expect(grade('Bar', noun('Bär', 'der'), 'reverse', DE).result).toBe('wrong');
  });

  it('treats a swap of two letters as two edits', () => {
    expect(grade('das Huas', haus, 'reverse', DE).result).toBe('wrong');
  });

  it('is wrong when two letters are off', () => {
    expect(grade('gohan', verb('gehen'), 'reverse', DE).result).toBe('wrong');
  });
});

describe('nouns and articles in reverse', () => {
  it('is correct with the right article', () => {
    expect(grade('das Haus', haus, 'reverse', DE)).toEqual({ result: 'correct', rating: 3, expected: 'das Haus' });
  });

  it('is article wrong with a wrong article', () => {
    expect(grade('der Haus', haus, 'reverse', DE)).toEqual({ result: 'article_wrong', rating: 2, expected: 'das Haus' });
  });

  it('is article wrong when the article is missing', () => {
    expect(grade('Haus', haus, 'reverse', DE)).toEqual({ result: 'article_wrong', rating: 2, expected: 'das Haus' });
  });

  it('is a typo with a correct article and a typo in the term', () => {
    expect(grade('das Hous', haus, 'reverse', DE).result).toBe('typo');
  });

  it('is wrong with a wrong article and a typo in the term', () => {
    expect(grade('die Hous', haus, 'reverse', DE).result).toBe('wrong');
  });

  it('is wrong with a missing article and a typo in the term', () => {
    expect(grade('Hous', haus, 'reverse', DE).result).toBe('wrong');
  });

  it('expects no article for a verb', () => {
    expect(grade('gehen', verb('gehen'), 'reverse', DE).result).toBe('correct');
    expect(grade('das gehen', verb('gehen'), 'reverse', DE).result).toBe('wrong');
  });
});

describe('wrong answers', () => {
  it('rates unrelated and empty answers Again', () => {
    expect(grade('xyz', haus, 'reverse', DE)).toEqual({ result: 'wrong', rating: 1, expected: 'das Haus' });
    expect(grade('', haus, 'reverse', DE).rating).toBe(1);
    expect(grade('   ', haus, 'forward', DE).rating).toBe(1);
  });
});

describe('determinism', () => {
  it('gives identical results for identical input and never defaults to Easy', () => {
    const a = grade('das Haus', haus, 'reverse', DE);
    const b = grade('das Haus', haus, 'reverse', DE);
    expect(a).toEqual(b);
    expect(a.rating).not.toBe(4);
  });
});

const RU = { target_lang: 'ru', native_lang: 'en' };
const FR = { target_lang: 'fr', native_lang: 'en' };
const plain = (term, translations = ['x']) => ({ term, part_of_speech: 'noun', forms: {}, translations });

describe('other languages', () => {
  it('treats ё and е as equal in Russian', () => {
    expect(grade('елка', verb('ёлка'), 'reverse', RU).result).toBe('correct');
    expect(grade('ёлка', verb('елка'), 'reverse', RU).result).toBe('correct');
  });

  it('ignores Cyrillic case', () => {
    expect(grade('МОСКВА', verb('Москва'), 'reverse', RU).result).toBe('correct');
  });

  it('forgives one Cyrillic letter', () => {
    expect(grade('сабака', verb('собака'), 'reverse', RU).result).toBe('typo');
  });

  it('applies the native profile in forward (Russian translations)', () => {
    const w = { translations: ['ёлка'] };
    expect(grade('елка', w, 'forward', { target_lang: 'de', native_lang: 'ru' }).result).toBe('correct');
  });

  it('keeps Ukrainian letters significant', () => {
    expect(grade('кит', verb('кіт'), 'reverse', { target_lang: 'uk', native_lang: 'en' }).result).not.toBe('correct');
  });

  it('keeps French accents significant: a missing one is a typo, not correct', () => {
    expect(grade('cafe', verb('café'), 'reverse', FR).result).toBe('typo');
    expect(grade('ecole', verb('école'), 'reverse', FR)).toEqual({ result: 'typo', rating: 3, expected: 'école' });
    expect(grade('cafe', verb('café'), 'reverse', FR).result).not.toBe('correct');
  });

  it('matches composed and decomposed letters', () => {
    expect(grade('caf\u00e9', verb('cafe\u0301'), 'reverse', FR).result).toBe('correct');
    expect(grade('cafe\u0301', verb('caf\u00e9'), 'reverse', FR).result).toBe('correct');
  });

  it('does not fold umlauts for English answers', () => {
    expect(grade('mude', { translations: ['müde'] }, 'forward', DE).result).not.toBe('correct');
  });

  it('is wrong, not article wrong, when a generic target gets an article', () => {
    expect(grade('la maison', plain('maison'), 'reverse', FR).result).toBe('wrong');
    expect(grade('maison', plain('maison'), 'reverse', FR).result).toBe('correct');
  });
});
