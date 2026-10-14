// Language choices shared by Setup and Settings. options are pure; fillSelect touches the DOM.
import { languageLabel } from './i18n.js';
import { LANGUAGES, isAllowedPair } from './languages.js';

// Names are written in the interface language `lang`.
export const nativeOptions = (lang = 'en') =>
  Object.entries(LANGUAGES).filter(([, l]) => l.native).map(([code]) => ({ code, name: languageLabel(lang, code) }));

// Targets of the list, leaving out the chosen native language.
export const targetOptions = (native, lang = 'en') =>
  Object.entries(LANGUAGES)
    .filter(([code]) => isAllowedPair(code, native))
    .map(([code]) => ({ code, name: languageLabel(lang, code) }));

// Replaces the options with a placeholder (when given) and `options`; keeps `value` if still offered, else clears.
export function fillSelect(select, options, value, placeholder) {
  const nodes = [];
  if (placeholder) {
    const o = document.createElement('option');
    o.value = '';
    o.textContent = placeholder;
    nodes.push(o);
  }
  for (const { code, name } of options) {
    const o = document.createElement('option');
    o.value = code;
    o.textContent = name;
    nodes.push(o);
  }
  select.replaceChildren(...nodes);
  select.value = options.some((o) => o.code === value) ? value : placeholder ? '' : options[0]?.code ?? '';
}
