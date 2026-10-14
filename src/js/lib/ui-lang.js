// The interface language of the current page, and the switch that applies it to the document.
// Not pure: it touches the DOM and localStorage. Pure modules get `lang` passed in.
import { applyTranslations, cacheLanguage, readCachedLanguage, setDocumentLanguage } from './i18n-dom.js';
import { t, uiLanguage } from './i18n.js';

// Admin pages stay English: their <html> carries data-i18n-off and nothing here changes them.
const off = typeof document !== 'undefined' && document.documentElement.hasAttribute('data-i18n-off');

// Live binding: read it when you need it, after the pair is known.
export let lang = off ? 'en' : readCachedLanguage() ?? 'en';

const listeners = [];
// fn runs after every language change, for text that is built from script.
export const onLanguage = (fn) => listeners.push(fn);

// cache: false for a language that is only a preview (browser language, setup choice).
export function setLang(next, { cache = true } = {}) {
  if (off) return;
  lang = uiLanguage(next);
  if (cache) cacheLanguage(lang);
  setDocumentLanguage(lang);
  applyTranslations(document, lang);
  const key = document.documentElement.dataset.titleKey;
  if (key) document.title = `${t(lang, key)} - Vocab`;
  // The collapsed sidebar shows the link name from data-label.
  for (const chip of document.querySelectorAll('.v-sidebar .v-key[data-label]')) {
    chip.dataset.label = chip.parentElement.querySelector('.nav-label').textContent;
  }
  for (const fn of listeners) fn(lang);
}
