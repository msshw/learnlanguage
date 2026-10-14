// DOM side of i18n. Static HTML keeps its English text; this overwrites it for the active language.
import { t, uiLanguage } from './i18n.js';

const CACHE_KEY = 'ui-language';
const ATTRIBUTES = [
  ['data-i18n-placeholder', 'placeholder'],
  ['data-i18n-aria', 'aria-label'],
  ['data-i18n-title', 'title'],
];

// vars: optional placeholder values shared by every key in `root`.
export function applyTranslations(root, lang, vars) {
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(lang, el.getAttribute('data-i18n'), vars);
  for (const [attr, target] of ATTRIBUTES) {
    for (const el of root.querySelectorAll(`[${attr}]`)) el.setAttribute(target, t(lang, el.getAttribute(attr), vars));
  }
}

export const setDocumentLanguage = (lang) => {
  document.documentElement.lang = lang;
};

// The last language used on this device, to avoid a flash before the pair loads. null when none.
export function readCachedLanguage() {
  try {
    const value = localStorage.getItem(CACHE_KEY);
    return value ? uiLanguage(value) : null;
  } catch {
    return null;
  }
}

export function cacheLanguage(lang) {
  try {
    localStorage.setItem(CACHE_KEY, lang);
  } catch {
    // Not kept; the pair still decides the language.
  }
}
