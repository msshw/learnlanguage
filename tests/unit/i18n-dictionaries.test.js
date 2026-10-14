import { describe, expect, it } from 'vitest';
import { DICTIONARIES } from '../../src/js/lib/i18n.js';
import { LANGUAGES } from '../../src/js/lib/languages.js';

const en = DICTIONARIES.en;
const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
const PLURAL = /\.(one|few|many|other)$/;
// Plural keys are grouped by base: en has one/other, ru adds few/many.
const base = (key) => key.replace(PLURAL, '');
const bases = (dict) => new Set(Object.keys(dict).map(base));
const pluralBases = (dict) => new Set(Object.keys(dict).filter((k) => PLURAL.test(k)).map(base));

describe('dictionaries', () => {
  it('every native language has a dictionary', () => {
    const natives = Object.entries(LANGUAGES).filter(([, l]) => l.native).map(([code]) => code);
    for (const code of natives) expect(DICTIONARIES, code).toHaveProperty(code);
  });

  for (const [lang, dict] of Object.entries(DICTIONARIES)) {
    describe(lang, () => {
      it('has the same keys as English', () => {
        const missing = [...bases(en)].filter((k) => !bases(dict).has(k));
        const extra = [...bases(dict)].filter((k) => !bases(en).has(k));
        expect({ missing, extra }).toEqual({ missing: [], extra: [] });
      });

      it('has the same placeholders as English for every key', () => {
        const enOf = (key) => en[key] ?? en[`${base(key)}.other`];
        const wrong = Object.entries(dict)
          .filter(([key, text]) => enOf(key) !== undefined && placeholders(text) !== placeholders(enOf(key)))
          .map(([key]) => key);
        expect(wrong).toEqual([]);
      });

      it('has no empty text', () => {
        expect(Object.entries(dict).filter(([, text]) => !String(text).trim())).toEqual([]);
      });

      it('has every plural category of its language for each plural key', () => {
        const categories = new Intl.PluralRules(lang).resolvedOptions().pluralCategories;
        const missing = [];
        for (const key of pluralBases(en)) {
          for (const c of categories) if (!(`${key}.${c}` in dict)) missing.push(`${key}.${c}`);
          if (!(`${key}.other` in dict)) missing.push(`${key}.other`);
        }
        expect(missing).toEqual([]);
      });

      it('follows the copy rules: no em dashes', () => {
        expect(Object.entries(dict).filter(([, text]) => text.includes('—'))).toEqual([]);
      });
    });
  }

  it('Russian has one, few, many and other for each plural key', () => {
    for (const key of pluralBases(en)) {
      for (const c of ['one', 'few', 'many', 'other']) expect(DICTIONARIES.ru, `${key}.${c}`).toHaveProperty(`${key}.${c}`);
    }
  });
});
