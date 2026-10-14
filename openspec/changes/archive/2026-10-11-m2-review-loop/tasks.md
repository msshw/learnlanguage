Claude writes files only. Maks runs every command; each "Verify" names what he checks.

## 1. Dependency and database

- [x] 1.1 Add `ts-fsrs` `^5.4.0` to `package.json`. Typings for 5.4.2 were read from the published tarball: `Card` has `learning_steps`, `next(card, now, grade)` returns `{ card, log }`. Verify: `npm install` succeeds.
- [x] 1.2 Write `supabase/migrations/20261011140000_review_recording.sql`: `cards.learning_steps`, unique index on `review_logs (card_id, reviewed_at)`, `record_review(p jsonb)` per design decision 5 with execute revoked from `public` and `anon` and granted to `authenticated`. Verify: `supabase db reset` applies cleanly and the integration tests in 6.1 pass.

## 2. Pure modules and unit tests

- [x] 2.1 Write `src/js/lib/time.js` (`dayStart`, `nextDayStart`) and `tests/unit/time.test.js`: 03:59 and 04:00 boundaries, Europe/Berlin spring-forward and fall-back days (23 and 25 hour days), America/New_York. Verify: `npm run test:unit` passes this file.
- [x] 2.2 Write `src/js/lib/grader.js` and `tests/unit/grader.test.js`, table-driven over every rule in the answer-grading spec (normalization, any translation, typo threshold, under four letters, swaps, article cases, empty answer, determinism). Verify: this file passes.
- [x] 2.3 Write `src/js/lib/scheduler.js` and `tests/unit/scheduler.test.js`: mapping round trip, determinism, input not mutated, interval ordering by rating, lapse count, `learning_steps` carried, last review and reps set. Verify: this file passes.
- [x] 2.4 Write `src/js/lib/queue.js` (`buildQueue`, `homeStatus`, `nextAvailable`) and `tests/unit/queue.test.js`: ordering, rollover rule for `review` cards, learning cards, daily limit and introductions (including pending), limit zero, `en_de` eligibility, one card per word, deleted and pending exclusion, next available cases. Verify: this file passes.
- [x] 2.5 Write `src/js/lib/pending.js` (`createPendingList`, `userPending`) and `tests/unit/pending.test.js` with a fake storage and a fake send: order kept, attempts counted, banner threshold, success removes, storage failure falls back to memory, no duplicates. Verify: this file passes.
- [x] 2.6 Write `src/js/lib/format.js` (`formatNextDue`) and `tests/unit/format.test.js`. Verify: this file passes.

## 3. Data layer

- [x] 3.1 Extend `src/js/lib/db.js` with `listQueueCards(pairId)` (active words only, paged past the 1000 row limit), `listLogsSince(start)` and `recordReview(payload)`. Verify: `grep -rn "from('words')\|from('cards')" src` matches only `db.js`, and card reads embed active words only.

## 4. Pages

- [x] 4.1 Write `src/pages/review.html` and `src/js/pages/review.js`: session start with pending flush, prompt, answer form, feedback with ratings and keys 1 to 4, Enter to continue, Again requeue starting from the new state, summary, nothing-due and load error views, banner, 15 second flush. Verify: a session with a typo, an article error, an override and an Again, using only the keyboard, ends in the summary.
- [x] 4.2 Update `src/pages/index.html` and `src/js/pages/index.js` for the four Home states, "Start review", next due time, word count line, retry and banner. Verify: Home shows each state as words are added, reviewed and finished.

## 5. Existing tests

- [x] 5.1 Check that `tests/e2e/words.spec.js` and `tests/e2e/signin.spec.js` still match the new Home and Review pages, and adjust only if they do not. Verify: `npm run test:e2e` passes.

## 6. Integration tests

- [x] 6.1 Write `tests/integration/review.test.js`: `record_review` for an own card, another user's card, repeat, late arrival, forced owner, anonymous rejection, unique key, `learning_steps` default and check. Verify: `npm run test:unit` passes this file after `supabase db reset`.
