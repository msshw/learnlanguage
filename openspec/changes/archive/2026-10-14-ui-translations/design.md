## Context

Copy lives in about 14 HTML pages and partials (about 30 KB) and in 29+ `textContent` assignments in page modules. `languages.js` already marks `en` and `ru` as native languages. The active pair is known after `getProfile` / pair load in the sidebar flow. See proposal.md for motivation.

## Goals / Non-Goals

**Goals:** full non-admin UI in each native language; no flash for a returning user; no new dependency; parity enforced by test.

**Non-Goals:** admin pages, edge function error text, a separate per-account interface language setting, right-to-left layout, translating DESIGN/SPEC docs.

## Decisions

1. **Language source = active pair native language.** Rejected: a separate Settings language (extra column, UI, and the AI language would not match the UI). Accepted oddity: one account with two pairs of different natives sees the UI change with the pair.
2. **Pure module `src/js/lib/i18n.js`**: `t(lang, key, vars)`, `plural(lang, key, n, vars)` (uses `Intl.PluralRules`, keys `key.one/few/many/other`), `pickLanguage(browserLangs)`, `uiLanguage(nativeLang)`. No DOM, no `Date.now()`, so it fits the pure-module rule. Dictionaries are plain objects in `src/js/lib/i18n/en.js` and `ru.js`. Rejected: i18next-style library (new dependency, no need).
3. **DOM binding.** A small `applyTranslations(root, lang)` in a non-pure module (`i18n-dom.js`) sets `textContent` for `[data-i18n]`, and `placeholder`, `aria-label`, `title` for `data-i18n-placeholder|aria|title`. Static HTML keeps its English text as the fallback and as the markup default, so English e2e selectors and first paint stay valid. Page modules call `t()` for dynamic text. Rejected: replacing HTML with empty elements filled by JS (flash, worse fallback).
4. **No flash.** The last used language is cached in `localStorage` (wrapped in try/catch) and applied before first render; the pair load then corrects it if different. Cache is only a convenience, the pair stays the source of truth.
5. **Language names** from `Intl.DisplayNames(lang, { type: 'language' })` with the English `LANGUAGES[code].name` as fallback. No hand-kept name tables.
6. **Setup live switch.** The native select `change` event calls `applyTranslations` with the picked language; the target list labels are re-rendered.
7. **Russian copy rules**: mirror the English rules: sentence case, no em dashes, imperative buttons ("Сохранить слово"), plain words, no title case.
8. **Admin pages and function errors stay English**; admin pages do not load the translator.
9. **Parity test** (`tests/unit/i18n.test.js`): same keys and placeholders as `en`; every native language has a dictionary; plural keys complete for the language's plural categories.
10. **Translations written by Claude, reviewed by Maks** for Russian before archive.

## Risks / Trade-offs

- [Russian text longer than English, layout breaks] → check sidebar, buttons and the review card in a Russian browser pass; allow wrapping.
- [Stale hard-coded strings are missed] → a unit test greps page modules for `textContent = '...'` literals outside the dictionaries (allow list for admin files).
- [e2e tests assert English text] → test users stay on native `en`; new e2e runs the Russian flow.
- [Wrong Russian plural/case] → plural keys via `Intl.PluralRules`; Maks reviews wording.
- [Flash on pair switch] → pair switch re-applies translations in place.

## Proposed doc updates

- **CLAUDE.md** (Architecture rules): add `i18n.js` to the pure modules list, and "Every user-facing string on non-admin pages goes through the dictionaries in `src/js/lib/i18n/`; add a key to every language, a unit test keeps them equal. Admin pages and edge function errors stay English."
- **SPEC.md**: a short "Interface language" note: the UI follows the active pair's native language (`en`, `ru` at launch), English fallback, admin pages and function errors in English.

## Open Questions

- None blocking.
