// Pure: no DOM, no network, no clock. Interface text from per-language dictionaries.
import en from './i18n/en.js';
import ru from './i18n/ru.js';
import { LANGUAGES, languageName } from './languages.js';

export const DICTIONARIES = { en, ru };

const hasDictionary = (lang) => Object.prototype.hasOwnProperty.call(DICTIONARIES, lang);
const fill = (text, vars) => text.replace(/\{(\w+)\}/g, (m, name) => (vars && name in vars ? String(vars[name]) : m));

// The text for a key: the language's own, else English, else the key itself.
export function t(lang, key, vars) {
  const text = (hasDictionary(lang) ? DICTIONARIES[lang][key] : undefined) ?? en[key] ?? key;
  return fill(text, vars);
}

// Text with a count. Keys are `key.one|few|many|other`; a missing form falls back to `.other`.
export function plural(lang, key, n, vars) {
  const pick = (l) => {
    const dict = hasDictionary(l) ? DICTIONARIES[l] : null;
    return dict?.[`${key}.${new Intl.PluralRules(l).select(n)}`] ?? dict?.[`${key}.other`];
  };
  return fill(pick(lang) ?? pick('en') ?? key, { n, ...vars });
}

// The first browser language that is a native language with a dictionary, else English.
export function pickLanguage(browserLangs) {
  for (const tag of browserLangs ?? []) {
    const code = String(tag).toLowerCase().split('-')[0];
    if (LANGUAGES[code]?.native && hasDictionary(code)) return code;
  }
  return 'en';
}

// Part of speech value to its name; the value 'other' uses key pos.misc.
export const posLabel = (lang, value) => t(lang, `pos.${value === 'other' ? 'misc' : value}`);

export const uiLanguage = (nativeLang) => (hasDictionary(nativeLang) ? nativeLang : 'en');

// A language's name written in the interface language.
export function languageLabel(lang, code) {
  try {
    return new Intl.DisplayNames([lang], { type: 'language' }).of(code) ?? languageName(code);
  } catch {
    return languageName(code);
  }
}
