import { describe, expect, it } from 'vitest';
import * as client from '../../src/js/lib/languages.js';
import * as functions from '../../supabase/functions/_shared/languages.ts';

describe('isAllowedPair', () => {
  it.each([
    ['fr', 'ru', true],
    ['de', 'en', true],
    ['ru', 'en', true],
    ['en', 'ru', true],
    ['en', 'en', false],
    ['de', 'fr', false],
    ['xx', 'en', false],
    ['de', 'xx', false],
    ['toString', 'en', false],
  ])('%s from %s is %s', (target, native, ok) => {
    expect(client.isAllowedPair(target, native)).toBe(ok);
  });
});

describe('profileOf and languageName', () => {
  it('maps codes to profiles', () => {
    expect(client.profileOf('de').id).toBe('german');
    expect(client.profileOf('ru').id).toBe('russian');
    expect(client.profileOf('fr').id).toBe('generic');
    expect(client.profileOf('xx').id).toBe('generic');
  });

  it('names languages in English', () => {
    expect(client.languageName('fr')).toBe('French');
  });
});

describe('copies', () => {
  it('are equal', () => {
    expect(functions.LANGUAGES).toEqual(client.LANGUAGES);
    expect(functions.PROFILES).toEqual(client.PROFILES);
    for (const code of ['de', 'ru', 'fr', 'xx']) {
      expect(functions.profileOf(code)).toEqual(client.profileOf(code));
      expect(functions.languageName(code)).toBe(client.languageName(code));
    }
  });
});
