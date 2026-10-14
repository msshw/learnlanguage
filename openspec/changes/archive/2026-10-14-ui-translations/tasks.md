## 1. Core module

- [x] 1.1 Add `src/js/lib/i18n.js` (`t`, `plural`, `pickLanguage`, `uiLanguage`, `languageLabel`) and unit tests for fallback, placeholders, missing key, plural one/few/many, browser language pick; `npm run test:unit` passes
- [x] 1.2 Add `src/js/lib/i18n-dom.js` (`applyTranslations`, cached language read/write with try/catch) and verify with a small unit test using a DOM fragment

## 2. Dictionaries

- [x] 2.1 Collect every user string from non-admin pages, partials and page modules into `src/js/lib/i18n/en.js`; verify no literal UI string remains outside it (grep test)
- [x] 2.2 Write `src/js/lib/i18n/ru.js` with the Russian copy rules; `tests/unit/i18n.test.js` parity test passes (keys, placeholders, plural forms, native languages have dictionaries)

## 3. Pages

- [x] 3.1 Mark static HTML with `data-i18n*` attributes and apply them in each page module and in the sidebar; English e2e still passes
- [x] 3.2 Replace `textContent = '...'` literals in page modules with `t()` / `plural()`; set `<html lang>`; verify with e2e
- [x] 3.3 Language names via `Intl.DisplayNames` in setup, switcher and Settings
- [x] 3.4 Sign-in uses `pickLanguage(navigator.languages)`; setup re-renders live on native change; cache language for first paint; verify with e2e

## 4. Tests and docs

- [x] 4.1 e2e: Russian native pair shows Russian text on Home, Review, Add word, Settings; switching pairs changes language; sign-in with browser language `ru`; setup live switch
- [x] 4.2 (CLAUDE.md and SPEC.md edits applied) run `npm test`, build and `openspec validate --strict`
- [x] 4.3 (Maks) Review the Russian wording and the layout in a Russian pair in the browser
