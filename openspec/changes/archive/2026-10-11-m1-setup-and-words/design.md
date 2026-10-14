## Context

M0 is archived: Vite multi-page with `root: 'src/pages'`, `requireSession()`, RLS on six tables, no client DELETE. Motivation in `proposal.md`; requirements in `specs/`. `db.js` is the only `supabase-js` importer in `src/` and will hold every query. Local Supabase only; the deploy is postponed.

## Goals / Non-Goals

**Goals:**
- Setup, Add word and Words work end to end against local Supabase.
- Word cards can never be missing or duplicated, even if the client fails midway.
- Validation and search logic is pure and unit-tested.

**Non-Goals:**
- AI, scheduler, grader, queue, `time.js`, due counts, Settings, pagination.
- The "open Add word from anywhere" shortcut (M4).
- Restoring deleted words.

## Decisions

**1. Cards come from a trigger, not the client.** `create_cards_for_word()` is an `after insert on words` trigger, `security definer`, `set search_path = ''`, inserting `de_en` with `due = now()` and `en_de` with `due = now() + interval '1 day'`, `user_id = new.user_id`. One word insert is one transaction, so a word cannot exist without both cards, and the client needs no cards insert. Execute is revoked from `public`, `anon`, `authenticated`. The definer bypass is safe because the word row has already passed its RLS `WITH CHECK`. Alternatives: an RPC `create_word` (more client plumbing, same result); two client inserts (rejected, clients cannot delete so a half-failed save could not be cleaned up).

**2. `updated_at` trigger.** `before update on words` sets `new.updated_at := now()`. Same migration file (`..._word_triggers.sql`), invoker rights. The client never sends `updated_at`.

**3. Setup guard and layout flags.** `db.getProfile()` returns the profile. `auth.requireSetup()` calls it, redirects to `/setup.html` when `active_pair_id` is null, and never resolves (same pattern as `requireSession`). Protected page modules become `await requireSession(); const profile = await requireSetup();`. The Setup module calls `requireSession()`, then redirects to `/` if a pair is active. `base.html` replaces the `bare` flag with two: `nosidebar` (sign-in, Setup) and `public` (sign-in only: body is not hidden). `requireSession()` already reveals the body, so a protected page without a sidebar works.

**4. Pair creation.** `db.createActivePair('de', 'en')`: `upsert` on `(user_id, target_lang, native_lang)` returning the row, then `update profiles set active_pair_id`. Double submit or a retry after a half failure converges. A function in `db.js` returns after both steps; Setup shows an inline error on any failure. The upsert needs the existing UPDATE policy on `language_pairs`; no policy change.

**5. All queries in `db.js`.** New functions: `getProfile`, `createActivePair`, `countWords`, `listWords`, `findDuplicates`, `getWord`, `insertWord`, `updateWord`, `softDeleteWord`. A private `activeWords(pairId)` builds `from('words').select(...).eq('pair_id', pairId).is('deleted_at', null)`; every read goes through it, which is how "deleted excluded everywhere" holds in one place. It cannot be an RLS select policy: the soft-delete update's returned row would fail it, and the M4 export needs deleted rows.

**6. Duplicate check.** `findDuplicates(term, pairId)` normalizes (trim, collapse whitespace), escapes `\`, `%`, `_`, and calls `.ilike('term', escaped)` on `activeWords`. With no wildcards left, `ilike` is case-insensitive equality. PostgREST cannot call `lower()` in a filter, so this is the SPEC's `lower(term)` match by other means. Umlaut case-folding relies on the database locale; an integration test covers `Äpfel`/`äpfel`.

**7. Pure modules.**
- `lib/word-form.js`: `normalizeTerm(s)`, `buildWord(raw, pairId)` returning `{ ok: true, value }` or `{ ok: false, errors }`. It splits translations and tags on commas, drops empties, trims, builds `forms` with only the keys for the part of speech, enforces the article, auxiliary and term-article rules.
- `lib/word-list.js`: `matchesQuery(word, q)`, `nextDue(cards)`, `wordLabel(word)` (article plus term for nouns), `homeCount(n)` text helper if needed.
Both have no DOM and no `Date.now()`.

**8. Word form view.** `components/word-form.html` is a partial included in `add.html` and, inside a `<dialog>`, in `words.html`. `lib/word-form-view.js` (DOM, not pure) shows or hides part-of-speech fields, reads the form into the raw object for `buildWord`, fills it from a word, and renders errors with `textContent`. Add and Words pages share it so the two forms cannot diverge.

**9. Words page.** One `listWords` call: `select('*, cards(due)')` through `activeWords`, newest first. Filtering runs client-side with `matchesQuery` on each input event; ceiling a few thousand words (`ponytail:` comment in the page module, upgrade path a view with a trigram index, as SPEC §4 allows). Edit and delete use native `<dialog>` (Escape closes). `?edit=<id>` is read once after load; it looks the id up in the loaded list, so an unknown or deleted id is ignored without another query. Load failure shows a message and a "Retry" button.

**10. Home count.** `countWords` uses `select('id', { count: 'exact', head: true })` through `activeWords`. Zero shows the M0 empty state markup, otherwise "N words".

**11. Test data and repeatability.**
- `tests/helpers/admin.js`: `adminClient()` (service role from env), `resetUser(userId)` (delete review logs, cards, words, pairs for the user; the `on delete set null` clears `active_pair_id`), `seedPair(userId)`.
- The M0 integration test's `clean()` becomes a call to `resetUser`.
- Playwright config loads `.env` with `process.loadEnvFile()` so spec files can reach the service role. Each e2e test resets alice in `beforeEach`; tests that expect Home call `seedPair`.
- M0 e2e tests 2 and 3 (Home empty state, return to `/review.html`) seed a pair first. A new spec `tests/e2e/words.spec.js` covers first sign-in to Setup and never again, noun without article rejected, add and duplicate warning, search by term and translation, and delete.
- Unit: `word-form`, `word-list`. Integration: trigger creates two cards with the right due times and state, rejected word makes no cards, bob cannot see them, `updated_at` bump and ignore of client value, soft delete via update works while real DELETE still fails, `findDuplicates`-style `ilike` with umlaut and `_`.

**12. Migration.** One new file `supabase/migrations/20261011130000_word_triggers.sql`. M0 migrations stay untouched.

## Risks / Trade-offs

- [Security-definer trigger inserts cards past RLS] → It only runs after the word row passed its policy and copies `new.user_id`; covered by the bob test.
- [`en_de` due is `now() + 1 day`, not the 04:00 rollover day] → Acceptable for M1; M2's queue uses `time.js` and the stored `due`.
- [Client-side search loads every word] → Single user, thousands at most; documented ceiling.
- [`ilike` case folding depends on DB locale] → Integration test; ß has no uppercase in `lower()` anyway.
- [Existing M0 e2e tests change] → They are in `tasks.md` as explicit edits, not silent.
- [Trigger makes `cards` inserts from the client unnecessary but the RLS insert policy remains] → Left as is; a later change can drop it if wanted.

## Migration Plan

1. Maks runs `supabase db reset` (applies the new migration and seed).
2. `npm run test:unit`, then `npm run test:e2e` (Playwright reset helper needs `SUPABASE_SERVICE_ROLE_KEY` in `.env`).
3. Manual: `npm run dev`, sign in as alice, complete Setup, add a noun and a verb, search, edit, delete.

Rollback: forward-only; a faulty trigger is fixed with a new migration, never an edit.

## Open Questions

- None that change the specs or tasks.
