## Why

M0 gave a signed-in user an empty app. M1 (SPEC §8) lets them choose a language pair and build a vocabulary by hand, so the review loop in M2 has words and cards to work on. Daily use can start after M2 with hand-entered words, so this has to be solid.

## What Changes

- Add a Setup step: a signed-in user with no active language pair is redirected to Setup, which creates the German ← English pair and sets it active. Once set, Setup never shows again.
- Add word with manual fields: type a term and press Enter, get a duplicate warning if an active word already matches, then fill the form and save. Fields depend on part of speech (noun: article and plural; verb: Präteritum, Partizip II, auxiliary, separable prefix). A noun requires a valid article. A noun term typed with a leading article is rejected.
- Saving a word creates its two cards in the database: `de_en` due now, `en_de` due one day later.
- Add the Words screen: table of active words with term, translations and next due date, search by term or translation, edit, and soft delete with a confirmation dialog. Deleted words disappear everywhere.
- Home stops claiming "No words yet" once words exist: it shows the word count and an Add word link.
- New migration: `after insert` trigger on `words` that creates the two cards, and a `set_updated_at` trigger on `words`.
- New pure module `lib/word-form.js` builds and validates `forms` per part of speech and the term-article rule. A pure search filter handles Words search (client-side, ceiling a few thousand words).
- **BREAKING (tests):** M0 e2e "alice lands on Home empty state" now passes through Setup. Test helpers reset alice's data with the service role so e2e and integration runs repeat.
- Out of scope: AI auto-fill, `hint_en` from AI (the field is manual and optional), scheduler, grader, queue, `time.js`, due counts on Home, Settings, the "open Add word from anywhere" shortcut (deferred to M4), pagination.

## Capabilities

### New Capabilities
- `language-setup`: redirect to Setup until a pair is active; creating the pair and activating it; Setup never shows again.
- `word-entry`: Add word flow with manual fields, per part of speech validation, duplicate warning, and automatic creation of the two cards on save.
- `word-list`: Words table, search by term or translation, edit, soft delete with confirmation, exclusion of deleted words everywhere.

### Modified Capabilities
- `app-shell`: Home shows the empty state only for zero words and a word count otherwise; Setup, Add word and Words are no longer placeholders.
- `data-access-control`: inserting a word creates its two cards; `words.updated_at` is maintained by the database.

## Impact

- New and changed files: `src/pages/{setup,add,words,index}.html`, `src/components/word-form.html`, `src/js/pages/*`, `src/js/lib/{db,auth,word-form}.js`, one new migration, tests under `tests/{unit,integration,e2e}` plus a reset helper.
- No new dependencies.
- `db.js` gains the profile, pair, word and card queries; every words query goes through one helper that excludes deleted rows.
- Local Supabase only. The deploy stays postponed.
