## Why

M1 lets a user build a vocabulary, but nothing reads it back. M2 (SPEC §8) adds the review loop: type an answer, have code grade it, schedule the next review on an FSRS schedule, and keep an append-only log. After M2 the app is usable every day with hand-entered words.

## What Changes

- Add pure modules with unit tests: `time.js` (logical day in the profile timezone, 04:00 rollover), `grader.js`, `queue.js`, `scheduler.js` (wraps `ts-fsrs` with default parameters).
- Add the Review screen: one card at a time, typed answer, feedback with the grader's pre-selected rating, keys 1 to 4 to change it, Enter to submit and to continue. Again cards return to the end of the same session. A summary follows: cards reviewed, passed against failed, words to watch, next due time. A "nothing due" state covers an empty queue.
- Queue rules: due cards first, most overdue first; then new `de_en` cards, oldest first, within the daily limit minus words introduced today; one card per word per session. A `review`-state card is due when its due time falls before the next 04:00 rollover; `learning` and `relearning` cards are due when `due <= now`. A new `en_de` card becomes eligible only after its `de_en` card was first reviewed on an earlier day.
- Recording: each final answer writes one `review_logs` row (with the FSRS state before) and updates the card, in one transaction, safe to retry. Failed saves go to a local pending list, retried until saved, with a banner after 3 failed attempts.
- Home shows the review status: no words yet, cards due with a "Start review" button, nothing due (with the next due time), or all done today. The word count stays as a secondary line.
- Database (new migration): `cards.learning_steps` column for ts-fsrs, a unique index on `review_logs (card_id, reviewed_at)`, and a `record_review` function that inserts the log and updates the card atomically and idempotently.
- Add dependency `ts-fsrs`.
- Check that the M1 and M0 e2e tests still pass with the new Home (`words.spec.js` expects "1 word", now a secondary line).
- **SPEC amendments for Maks to make in the source doc** (Claude does not edit `SPEC.md`): add `learning_steps` to `cards` in §4; add the unique index on `review_logs` in §4; replace "`due <= now()`" in the due-queue key query with the rollover rule above.
- Out of scope: AI, Settings, the full review end-to-end test (M4 per SPEC), the "open Add word from anywhere" shortcut (M4), offline reviews, FSRS tuning.

## Capabilities

### New Capabilities
- `answer-grading`: normalization, grading results, default ratings.
- `review-queue`: which cards are in a session, the logical day and its rollover, the daily new-word limit, the sibling rule.
- `review-session`: the Review screen flow, keyboard use, Again requeue, summary, nothing-due state.
- `review-recording`: FSRS scheduling of each answer, the append-only log, atomic and repeatable saving, pending-save retry.

### Modified Capabilities
- `app-shell`: Home review status states; Review is no longer a placeholder.
- `data-access-control`: `learning_steps` column, unique review log key, `record_review` rules (own cards only, no stale overwrite).

## Impact

- New files: `src/js/lib/{time,grader,queue,scheduler,pending}.js`, `src/js/pages/review.js`, `src/pages/review.html`, one migration, tests under `tests/{unit,integration}`.
- Changed files: `db.js`, `src/pages/index.html`, `src/js/pages/index.js`, `tests/e2e/words.spec.js`.
- One new dependency: `ts-fsrs` (named in SPEC §1 and CLAUDE.md). Maks runs `npm install`.
- Local Supabase only. The deploy stays postponed.
