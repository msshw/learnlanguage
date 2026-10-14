Claude writes files only. Maks runs every command; each "Verify" names what he checks.

## 1. Database

- [x] 1.1 Write `supabase/migrations/20261011130000_word_triggers.sql`: `create_cards_for_word()` (`security definer`, `set search_path = ''`, execute revoked) with an `after insert` trigger on `words` creating `de_en` due `now()` and `en_de` due `now() + interval '1 day'`; `set_updated_at()` with a `before update` trigger on `words`. Verify: `supabase db reset` applies cleanly and the integration tests in 6.2 pass.

## 2. Pure modules

- [x] 2.1 Write `src/js/lib/word-form.js` (`normalizeTerm`, `buildWord(raw)` per design decision 7) and `tests/unit/word-form.test.js` covering: noun needs article, article typed in term rejected, verb with no optional forms, bad auxiliary, empty or comma-only translations, hidden values dropped on part-of-speech switch, translations and tags split and trimmed, term whitespace collapsed. Verify: `npm run test:unit` passes this file.
- [x] 2.2 Write `src/js/lib/word-list.js` (`matchesQuery`, `nextDue`, `wordLabel`, `countLabel`) and `tests/unit/word-list.test.js` covering: match by term and by translation ignoring case, empty query matches all, `nextDue` picks the earlier card and handles no cards, article shown for nouns only, "1 word" vs "N words". Verify: `npm run test:unit` passes this file.

## 3. Data layer and guards

- [x] 3.1 Extend `src/js/lib/db.js` with `getProfile`, `createActivePair`, `countWords`, `listWords`, `findDuplicates`, `insertWord`, `updateWord`, `softDeleteWord`, all word reads through a private `activeWords(pairId, columns, options)` that excludes deleted rows. Verify: `grep -rn "from('words')" src` matches only `db.js`, and only inside `activeWords`, `insertWord`, `updateWord`, `softDeleteWord`.
- [x] 3.2 Update `src/js/lib/auth.js`: `requireSession({ reveal })` option, new `requireSetup()` (session, then profile, redirect to `/setup.html` when no active pair, reveal only after both pass). Verify with the e2e in 6.3.
- [x] 3.3 Replace the `bare` layout flag with `nosidebar` and `public` in `src/layouts/base.html` and update `src/pages/signin.html`. Verify: sign-in still shows no sidebar and is visible without a session.
- [x] 3.4 Add shared button, input and error classes to `src/styles/main.css`. Verify: styles apply on the new pages in `npm run dev`.

## 4. Pages

- [x] 4.1 Write `src/pages/setup.html` and `src/js/pages/setup.js`: fixed German and English choices, "Start learning" button, inline error, redirect to Home when a pair is already active, no sidebar. Verify: a user without a pair presses the button and lands on Home; reopening `/setup.html` redirects to Home.
- [x] 4.2 Write `src/components/word-form.html` and `src/js/lib/word-form-view.js` (show or hide fields by part of speech, read, fill, reset, show and clear errors via `textContent`). Verify with 4.3 and 4.4.
- [x] 4.3 Write `src/pages/add.html` and `src/js/pages/add.js`: term step with "Check word", duplicate warning with "Open word" and "Add anyway", details form with "Save word" and "Cancel", "Word saved" confirmation, inline save errors that keep values. Verify: add a noun without article (error), with article (saved), re-enter the term (duplicate warning).
- [x] 4.4 Write `src/pages/words.html` and `src/js/pages/words.js`: table with newest first, search, "No words yet" and "No results" states, edit dialog with the shared form, `?edit=<id>`, delete confirmation dialog, load error with "Retry". Verify: search by term and by translation, edit, delete, and `/words.html?edit=<id>` opens the dialog.
- [x] 4.5 Update `src/pages/index.html` and `src/js/pages/index.js` for the word count state, empty state and load error with "Retry"; switch `review.js` and `settings.js` to `requireSetup()`. Verify: Home shows "No words yet" with zero words and "N words" after adding.

## 5. Test support

- [x] 5.1 Write `tests/helpers/admin.js` (`adminClient`, `ALICE_ID`, `BOB_ID`, `resetUser`, `seedPair`), `tests/helpers/e2e.js` (`signInAs`), set `workers: 1` and `process.loadEnvFile()` in `playwright.config.js`, and make `tests/integration/rls.test.js` use `resetUser` and read alice's trigger-created `de_en` card instead of inserting one. Verify: `npm run test:unit` still passes the M0 RLS tests.

## 6. Tests

- [x] 6.1 Update `tests/e2e/signin.spec.js`: reset and seed alice's pair before each test so Home and return-to cases pass. Verify: `npm run test:e2e` passes this file.
- [x] 6.2 Write `tests/integration/words.test.js`: trigger creates two cards with state `new` and due times a day apart, rejected word creates no cards, bob cannot see them, `updated_at` bump and client value ignored, soft delete by update works, `ilike` matches `Äpfel` for `äpfel` and treats an escaped `_` literally. Verify: `npm run test:unit` passes this file against a fresh `supabase db reset`.
- [x] 6.3 Write `tests/e2e/words.spec.js`: first sign-in shows Setup and never again; add flow with article error, article-in-term error, saved, duplicate warning; search by term and translation, no results; delete leaves "No words yet". Verify: `npm run test:e2e` passes.
