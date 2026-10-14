## Context

See proposal.md for motivation. Current state that shapes the approach:

- Review: `queue.js` (pure queue and Home status), `scheduler.js` (`schedule(cardState, rating, now)`, `fsrsFields`), `record_review(p jsonb)` (security invoker, log insert `on conflict do nothing`, card update only when newer), the focus layout in `review.html` without the sidebar, and the due pill in `sidebar.js`.
- Cards are created by a trigger on `words` insert (`20261011130000_word_triggers.sql`).
- AI: one function, `autofill`, with `config.ts` (model, prices, cap), `cost.ts` (cost, cap, month start, usage), `ai_usage_since` summing all of a user's `ai_calls` rows regardless of `kind`. `ai_calls.kind` has no check constraint.
- `sidebar-polish` must be applied first (Practice joins its nav data and shortcuts); `ai-word-cache` is recommended first only because both touch the autofill function folder.

## Goals / Non-Goals

**Goals:**
- Reuse `scheduler.js`, `time.js`, the record pattern and the AI cost path; no new dependency.
- Word reviews stay exactly as they are.

**Non-Goals:**
- AI-generated example sentences (the other half of the next milestone).
- Practice settings (daily limit, eligibility rule) in the Settings page.
- Practice data in the export (follow-up; see Open Questions).
- Offline or pending-list retries for practice attempts.
- Again cards returning in the same practice session.

## Decisions

**Tables.** `sentence_cards`: `id uuid pk`, `user_id`, `word_id unique references words`, the same FSRS columns as `cards` (state, due, stability, difficulty, elapsed_days, scheduled_days, learning_steps, reps, lapses, last_review). `sentence_logs`: `id bigint identity pk`, `user_id`, `sentence_card_id`, `practiced_at`, `sentence text not null`, `corrected text`, `issues jsonb`, `check_status text check in ('ok','unavailable')`, `rating smallint check 1..4`, `state_before jsonb not null`, `duration_ms int`, `unique (sentence_card_id, practiced_at)`. RLS policies copy the `cards` and `review_logs` ones (own rows, own parent; logs insert and select only; deletes revoked). Alternative: a third `direction` value on `cards`; it would change the review queue's one-card-per-word and sibling rules and every query on `cards`. Rejected, as Maks chose option B.

**Card creation.** Extend the word insert trigger to also insert the `sentence_cards` row (state `new`, due now), and backfill existing words in the same migration (`insert ... select from words on conflict do nothing`). Deleted words get a card too; the queue excludes them as it does for review cards.

**Queue.** New pure `src/js/lib/practice-queue.js`: `practiceQueue({cards, logsToday, now, tz, limit})` and `practiceStatus(...)` for the due count, using `dayStart` from `time.js`. A new card is eligible when the word's `de_en` card state is `review`. New-per-day limit is a constant `PRACTICE_NEW_PER_DAY = 5` in that module. `db.js` gets `listPracticeCards(pairId)` (sentence cards with the word and its `de_en` card state, active words only) and `listPracticeLogsSince(start)`.

**Recording.** `record_sentence(p jsonb)` mirrors `record_review` (security invoker, `on conflict do nothing`, card moved only when newer). The page awaits it; on failure it shows "Could not save this attempt" with "Retry" and keeps the payload. Alternative: reuse `pending.js`; it is keyed to review card ids and the Home banner, and practice is low-volume. Rejected for now.

**Shared AI config.** Move the model ID, effort, prices, cap and `cost.ts` into `supabase/functions/_shared/` (the Supabase convention for code shared by functions, not deployed on its own), and import it from both functions. This keeps "model ID and prices in one config constant". The session check, `readSpend` and `logCall(kind)` move there too.

**check-sentence function.** `supabase/functions/check-sentence/` with `index.ts`, `prompt.ts`, `schema.ts`, `validate.ts`. Order: session → body → word read with the service role filtered by `user_id = user.id` and `deleted_at is null` → spend and cap → model (one retry) → validate → log (`kind: 'sentence_check'`) → reply. The model returns `{corrected, uses_word, issues: [{quote, message}]}`; a pure `placeIssues(sentence, issues)` turns quotes into non-overlapping `{start, end, message}` sorted by `start`, or reports failure. Offsets from the model directly were the alternative; models count characters poorly. Rejected. Model call timeout 8 s inside a 10 s client timeout.

**Client.** `ai.js` gets `checkSentence(wordId, sentence)` (10 s timeout, never throws, returns `{status: 'ok', corrected, usesWord, issues}` or `{status: 'unavailable'}`), and a pure `validIssues(sentence, issues)` re-checks offsets. A pure `highlightSegments(sentence, issues)` in a new `src/js/lib/practice.js` returns `[{text, issue}]`; the page appends text nodes and `<mark>` elements with `textContent`. `defaultRating(check)` lives there too (Again / Hard / Good / none).

**Page.** `src/pages/practice.html` (`nosidebar`, focus layout) and `src/js/pages/practice.js`, structured like `review.js`: states load error, empty, prompt, checking, feedback, summary. `sidebar.js` shows the Practice count in a second pill using `practiceStatus`.

**Tests.**
- Unit: `practiceQueue` (due order, daily limit across the 04:00 boundary, eligibility, deleted words, one appearance per session); `highlightSegments`; `defaultRating`; `validIssues`; `placeIssues` (exact quote, repeated text, missing quote, overlap); `checkSentence` (ok, error, over_cap, timeout, bad offsets).
- Integration: RLS for both tables (cross-user read, own parent, logs append-only, no deletes), trigger and backfill create one practice card per word, `record_sentence` idempotency and another user's card.
- E2E (stubbed `check-sentence`): one card with issues highlighted, rating defaults, Enter through to the summary; check unavailable with rating required; save failure and Retry; Escape ends the session.
- Manual (Maks): the real function over a handful of sentences, checking quotes are placed and messages make sense.

## Risks / Trade-offs

- [Option+P types "π" in fields] → handled by `event.code` like the other shortcuts.
- [Model quotes text that is not in the sentence] → invalid, one retry, then "Check unavailable"; rating stays possible.
- [Cost per check is higher than autofill (longer output)] → shared $2 cap; usage shown in Settings already includes it.
- [Practice cards for every word, even unused] → one small row per word.
- [Eligibility and daily limit are fixed constants] → one place each; Settings can expose them later.

## Migration Plan

New migration `<timestamp>_sentence_practice.sql` (tables, RLS, revokes, trigger change, backfill, `record_sentence`). Order: migration, `_shared` refactor with `autofill` redeployed unchanged in behavior, `check-sentence` deploy, site. Rollback: hide the Practice link and page; tables can stay.

## Open Questions

- Should the Settings export include `sentence_cards` and `sentence_logs`? Deferrable; adding them later does not change this design.

## Proposed SPEC.md additions (not made; Maks edits SPEC.md)

**§1 Scope.** Move "Write & check sentences" from "Next milestone" into a described feature; "AI-generated example sentences" stays next.

**§2 Screens.** New row: Practice | Write a German sentence with a learned word, get AI feedback, rate it | Sentence prompt, checking, feedback (with and without AI), summary, nothing due. Sidebar order: Home, Review, Practice, Add word, Words, Settings.

**§3 Learning model, new "Sentence practice".**
- One practice card per word with its own FSRS schedule, independent of the two review cards.
- A word joins practice once its DE→EN card is in review state; up to 5 new practice words per day; due practice cards first, most overdue first.
- The user writes one sentence; AI marks issues and gives a corrected sentence; the user rates 1–4 with a suggested default (word unused → Again, any issue → Hard, else Good). Without AI the user rates alone.
- Every attempt is appended to a practice log.

**§4 Data model.** `sentence_cards` (one per word; FSRS columns as `cards`) and `sentence_logs` (append-only: card, time, sentence, corrected, issues, check status, rating, state before, duration), both with `user_id` and RLS. `ai_calls.kind`: `autofill` or `sentence_check`.

**§5 AI contracts, "Sentence check endpoint".**
1. `POST /functions/v1/check-sentence` with the JWT and `{ "word_id": "...", "sentence": "Ich gehe zu die Bank." }`. Sentence up to 300 characters.
2. Same cap check as autofill, over all `ai_calls` of the month.
3. Model returns the corrected sentence, whether the word is used, and up to 5 issues quoting the faulty text; the function places quotes as offsets, validates, retries once, logs.
4. Response: `{ "status": "ok", "corrected": "Ich gehe zur Bank.", "uses_word": true, "issues": [ { "start": 9, "end": 15, "message": "zu takes the dative: zu der, contracted to zur." } ] }`. `status` is `ok`, `over_cap` or `error`.
5. Fallback: timeout 10 s or any failure → "Check unavailable", the user rates alone.

**§6 Architecture.** Two AI edge functions (`autofill`, `check-sentence`) sharing one config module for model ID, prices and the cap.

**§8 Milestone M5, Sentence practice.**
- [ ] Every word has one practice card; reviews and practice never change each other's cards.
- [ ] Practice shows due practice cards, then up to 5 new learned words a day.
- [ ] A checked sentence shows highlighted issues and the corrected sentence; with the function stopped, "Check unavailable" appears within 10 seconds and the attempt can still be rated.
- [ ] Every attempt writes one `sentence_logs` row and every check one `ai_calls` row of kind `sentence_check`; the $2 cap covers both kinds.

**CLAUDE.md (proposed).** "Only `ai.js` calls AI, and only through the `autofill` edge function" becomes "... only through the AI edge functions (`autofill`, `check-sentence`)". "Model ID and per-token prices live in one config constant in the edge function" becomes "... in `supabase/functions/_shared/config.ts`". The pure-module list gains `practice-queue.js` and `practice.js`.
