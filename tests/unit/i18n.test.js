import { describe, expect, it } from 'vitest';
import { languageLabel, pickLanguage, plural, t, uiLanguage } from '../../src/js/lib/i18n.js';

describe('t', () => {
  it('returns the language text and fills placeholders', () => {
    expect(t('en', 'review.progress', { n: 2, total: 5 })).toBe('Card 2 of 5');
    expect(t('ru', 'review.progress', { n: 2, total: 5 })).toBe('Карточка 2 из 5');
  });
  it('falls back to English for an unknown language', () => {
    expect(t('xx', 'common.retry')).toBe('Retry');
    expect(t('constructor', 'common.retry')).toBe('Retry');
  });
  it('shows the key when it is missing everywhere', () => {
    expect(t('ru', 'no.such.key')).toBe('no.such.key');
  });
  it('keeps a placeholder that has no value', () => {
    expect(t('en', 'review.progress', { n: 1 })).toBe('Card 1 of {total}');
  });
});

describe('plural', () => {
  it('uses one and other in English', () => {
    expect(plural('en', 'format.day', 1)).toBe('1 day');
    expect(plural('en', 'format.day', 3)).toBe('3 days');
  });
  it('uses one, few and many in Russian', () => {
    expect(plural('ru', 'format.day', 1)).toBe('1 день');
    expect(plural('ru', 'format.day', 2)).toBe('2 дня');
    expect(plural('ru', 'format.day', 5)).toBe('5 дней');
    expect(plural('ru', 'format.day', 21)).toBe('21 день');
  });
  it('passes extra vars and falls back to .other, then the key', () => {
    expect(plural('en', 'add.reportCount', 20, { n: 3, min: 20 })).toBe('3 of 20 characters');
    expect(plural('ru', 'no.such.key', 2)).toBe('no.such.key');
  });
});

describe('pickLanguage', () => {
  it('takes the first supported native language, by primary subtag', () => {
    expect(pickLanguage(['ja', 'ru-RU', 'en'])).toBe('ru');
    expect(pickLanguage(['en-GB'])).toBe('en');
  });
  it('skips languages that are not native or have no dictionary', () => {
    expect(pickLanguage(['de', 'fr'])).toBe('en');
  });
  it('gives English for nothing usable', () => {
    expect(pickLanguage(['ja'])).toBe('en');
    expect(pickLanguage([])).toBe('en');
    expect(pickLanguage(undefined)).toBe('en');
  });
});

describe('uiLanguage', () => {
  it('uses the native language when it has a dictionary, else English', () => {
    expect(uiLanguage('ru')).toBe('ru');
    expect(uiLanguage('en')).toBe('en');
    expect(uiLanguage('de')).toBe('en');
    expect(uiLanguage(undefined)).toBe('en');
  });
});

describe('languageLabel', () => {
  it('names a language in the interface language', () => {
    expect(languageLabel('ru', 'de')).toMatch(/немецк/i);
    expect(languageLabel('en', 'de')).toBe('German');
  });
  it('falls back to the English name for a bad code', () => {
    expect(languageLabel('en', 'not a code!')).toBe('not a code!');
  });
});
