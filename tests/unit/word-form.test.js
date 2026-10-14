import { describe, expect, it } from 'vitest';
import { profileOf } from '../../src/js/lib/languages.js';
import { buildWord as build, confirmTarget, matchesSense, normalizeTerm, senseToFormValues } from '../../src/js/lib/word-form.js';

const noun = (over = {}) => ({
  term: 'Haus',
  part_of_speech: 'noun',
  translations: 'house, home',
  article: 'das',
  ...over,
});

const de = profileOf('de');
const fr = profileOf('fr');
const buildWord = (raw, profile = de) => build(raw, profile);

describe('normalizeTerm', () => {
  it('trims and collapses spaces', () => {
    expect(normalizeTerm('  zu   Hause ')).toBe('zu Hause');
  });
});

describe('buildWord', () => {
  it('builds a noun with article and plural', () => {
    const r = buildWord(noun({ plural: 'Häuser' }));
    expect(r.ok).toBe(true);
    expect(r.value.forms).toEqual({ article: 'das', plural: 'Häuser' });
    expect(r.value.translations).toEqual(['house', 'home']);
  });

  it('requires an article for a noun', () => {
    const r = buildWord(noun({ article: '' }));
    expect(r.ok).toBe(false);
    expect(r.errors.article).toBeTruthy();
  });

  it('rejects an article typed in the term', () => {
    const r = buildWord(noun({ term: 'die Bank', article: 'die' }));
    expect(r.errors.term).toBe('Enter the article in its own field');
  });

  it('allows a term that merely starts with the letters of an article', () => {
    expect(buildWord(noun({ term: 'Dasein' })).ok).toBe(true);
  });

  it('accepts a verb with only term and translation', () => {
    const r = buildWord({ term: 'gehen', part_of_speech: 'verb', translations: 'to go' });
    expect(r.ok).toBe(true);
    expect(r.value.forms).toEqual({});
  });

  it('keeps verb forms and validates the auxiliary', () => {
    const base = { term: 'anrufen', part_of_speech: 'verb', translations: 'to call' };
    const ok = buildWord({ ...base, praeteritum: 'rief an', partizip2: 'angerufen', auxiliary: 'haben', separable_prefix: 'an' });
    expect(ok.value.forms).toEqual({
      praeteritum: 'rief an',
      partizip2: 'angerufen',
      auxiliary: 'haben',
      separable_prefix: 'an',
    });
    expect(buildWord({ ...base, auxiliary: 'werden' }).errors.auxiliary).toBeTruthy();
  });

  it('drops values that do not apply to the part of speech', () => {
    const r = buildWord(noun({ part_of_speech: 'adjective', plural: 'x', praeteritum: 'y' }));
    expect(r.ok).toBe(true);
    expect(r.value.forms).toEqual({});
  });

  it.each(['', '  ', ' , ,'])('requires a translation for %j', (translations) => {
    expect(buildWord(noun({ translations })).errors.translations).toBeTruthy();
  });

  it('requires a term and a known part of speech', () => {
    const r = buildWord({ term: ' ', part_of_speech: 'fish', translations: 'x' });
    expect(r.errors.term).toBeTruthy();
    expect(r.errors.part_of_speech).toBeTruthy();
  });

  it('splits tags and turns empty optionals into null', () => {
    const r = buildWord(noun({ tags: ' food , ,home', hint_native: '  ', notes: '' }));
    expect(r.value.tags).toEqual(['food', 'home']);
    expect(r.value.hint_native).toBeNull();
    expect(r.value.notes).toBeNull();
  });
});

describe('senseToFormValues', () => {
  const base = {
    term: 'Bank',
    part_of_speech: 'noun',
    translations: ['bank'],
    hint_native: 'bank (money)',
    forms: { article: 'die', plural: 'Banken' },
    example_target: 'Ich gehe zur Bank.',
    example_native: 'I go to the bank.',
  };

  it('keeps a noun with its forms and word-shaped extras', () => {
    expect(senseToFormValues(base)).toEqual({ ...base, notes: null, tags: [] });
  });

  it('keeps verb forms', () => {
    const forms = { praeteritum: 'rief an', partizip2: 'angerufen', auxiliary: 'haben', separable_prefix: 'an' };
    expect(senseToFormValues({ ...base, part_of_speech: 'verb', forms }).forms).toEqual(forms);
  });

  it('gives empty forms for other parts of speech', () => {
    expect(senseToFormValues({ ...base, part_of_speech: 'adjective', forms: {} }).forms).toEqual({});
    expect(senseToFormValues({ ...base, forms: undefined }).forms).toEqual({});
  });

  it('builds a valid word when passed through buildWord', () => {
    const w = senseToFormValues(base);
    const r = buildWord({ ...w, translations: w.translations.join(', '), article: w.forms.article, plural: w.forms.plural });
    expect(r.ok).toBe(true);
    expect(r.value.forms).toEqual({ article: 'die', plural: 'Banken' });
  });
});

describe('matchesSense', () => {
  const sense = {
    term: 'Bank',
    part_of_speech: 'noun',
    translations: ['bank', 'bench'],
    hint_native: 'bank (money)',
    forms: { article: 'die', plural: 'Banken' },
    example_target: 'Ich gehe zur Bank.',
    example_native: 'I go to the bank.',
  };
  const raw = {
    term: 'Bank',
    part_of_speech: 'noun',
    translations: 'bank, bench',
    hint_native: 'bank (money)',
    article: 'die',
    plural: 'Banken',
    example_target: 'Ich gehe zur Bank.',
    example_native: 'I go to the bank.',
  };
  const check = (over = {}) => matchesSense(buildWord({ ...raw, ...over }).value, sense);

  it('matches an unchanged sense', () => expect(check()).toBe(true));

  it.each([
    ['term', { term: 'Banken' }],
    ['part of speech', { part_of_speech: 'verb' }],
    ['translations', { translations: 'bank' }],
    ['hint', { hint_native: '' }],
    ['article', { article: 'der' }],
    ['plural', { plural: 'Bänke' }],
    ['german example', { example_target: 'Ich sitze.' }],
    ['english example', { example_native: '' }],
  ])('does not match when %s changed', (_n, over) => expect(check(over)).toBe(false));

  it('ignores notes and tags', () => expect(check({ notes: 'a note', tags: 'money' })).toBe(true));

  it('ignores form key order', () => {
    const s = { ...sense, forms: { plural: 'Banken', article: 'die' } };
    expect(matchesSense(buildWord(raw).value, s)).toBe(true);
  });
});

describe('confirmTarget', () => {
  const sense = {
    term: 'Bank', part_of_speech: 'noun', translations: ['bank'], hint_native: 'bank (money)',
    forms: { article: 'die' }, example_target: 'Ich gehe zur Bank.', example_native: 'I go to the bank.',
    index: 3, state: 'candidate',
  };
  const raw = {
    term: 'Bank', part_of_speech: 'noun', translations: 'bank', hint_native: 'bank (money)', article: 'die',
    example_target: 'Ich gehe zur Bank.', example_native: 'I go to the bank.',
  };
  const value = (over = {}) => buildWord({ ...raw, ...over }).value;
  const picked = (over = {}) => ({ index: 0, sense: { ...sense, ...over } });

  it('confirms an unchanged candidate with its stored index, not its list position', () => {
    expect(confirmTarget(picked(), 'id1', value())).toEqual({ id: 'id1', index: 3 });
  });
  it('does not confirm an already confirmed sense', () => {
    expect(confirmTarget(picked({ state: 'confirmed' }), 'id1', value())).toBeNull();
  });
  it('does not confirm an edited save', () => {
    expect(confirmTarget(picked(), 'id1', value({ translations: 'bank, lender' }))).toBeNull();
  });
  it('does nothing without a pick or a suggestion id', () => {
    expect(confirmTarget(null, 'id1', value())).toBeNull();
    expect(confirmTarget(picked(), null, value())).toBeNull();
  });
});

describe('generic profile', () => {
  it('saves a noun without an article and with empty forms', () => {
    const r = buildWord({ term: 'maison', part_of_speech: 'noun', translations: 'house', article: 'la', plural: 'x' }, fr);
    expect(r.ok).toBe(true);
    expect(r.value.forms).toEqual({});
  });

  it('accepts a term that starts with a German article word', () => {
    expect(buildWord({ term: 'die Bank', part_of_speech: 'noun', translations: 'x' }, fr).ok).toBe(true);
  });

  it('ignores verb forms', () => {
    const r = buildWord({ term: 'aller', part_of_speech: 'verb', translations: 'to go', auxiliary: 'werden' }, fr);
    expect(r.ok).toBe(true);
    expect(r.value.forms).toEqual({});
  });
});
