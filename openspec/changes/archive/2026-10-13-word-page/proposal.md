## Why

The word list only offers Edit. There is no place to read a word on its own with its translations and example sentences.

## What Changes

- Clicking a word in the Words list opens a word page (`word.html?id=`).
- The page shows the word with its article badge, `hint_en`, part of speech, translations (the "definition"), and the example sentences, with a Back button that returns to the Words list.
- New `db.js` getter for one active (not deleted) word.

## Capabilities

### New Capabilities
- `word-detail`: read-only page for a single word.

### Modified Capabilities
- `word-list`: rows link to the word page.

## Impact

New `src/pages/word.html` and `src/js/pages/word.js`, `db.js` getter, `src/pages/words.html`/`words.js`, vite multi-page input, tests. No schema changes.
