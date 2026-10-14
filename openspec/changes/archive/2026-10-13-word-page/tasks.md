## 1. Data and helpers

- [x] 1.1 Add `getWord(id)` to `src/js/lib/db.js` (active words only, `maybeSingle`) and `isWordId(value)` to `src/js/lib/word-list.js`; verify unit tests for `isWordId` cover a UUID, `abc`, empty and null
- [ ] 1.2 Add `word` to the `pages` list and an optional `pages` match list on the Words nav entry in `vite.config.js`; verify the built output contains `word.html` and its Words link has `aria-current="page"`

## 2. Word page

- [ ] 2.1 Create `src/pages/word.html` (base layout, "Back to words" with `Esc` chip, hint, part of speech, translations, examples, "Word not found", load error with "Retry") and `src/js/pages/word.js` (session, `isWordId`, `getWord`, `textContent` only, empty sections hidden, Escape to Words); verify by the e2e in 3.1

## 3. Words list and tests

- [ ] 3.1 Make the row word a link to `/word.html?id=` in `src/pages/words.html` and add the row click listener in `src/js/pages/words.js` (ignores buttons, links and text selection); extend `tests/e2e/words.spec.js` to open a word by clicking a row cell, check every shown field, return with Escape and with "Back to words", check "Edit" still opens the dialog, and check "Word not found" for a deleted id and `?id=abc`; Maks runs `npm test`
