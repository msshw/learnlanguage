// Pure: wording and keyboard logic for the sidebar pair switcher.
import { languageLabel, t } from './i18n.js';

// pair: a language_pairs row. code is shown when the sidebar is collapsed.
export function pairLabel(pair, lang = 'en') {
  const name = languageLabel(lang, pair.target_lang);
  const from = t(lang, 'sidebar.pairFrom', { name: languageLabel(lang, pair.native_lang) });
  return { name, from, code: pair.target_lang.toUpperCase(), accessible: `${name} ${from}` };
}

export const otherPairs = (pairs, activeId) => pairs.filter((p) => p.id !== activeId);

// Next focused index in a menu of `count` items; null when the key is not a movement key.
export function moveIndex(current, key, count) {
  if (count <= 0) return null;
  if (key === 'ArrowDown') return (current + 1) % count;
  if (key === 'ArrowUp') return (current - 1 + count) % count;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return null;
}
