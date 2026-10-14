## 1. Database

- [x] 1.1 Add migration `<timestamp>_sentence_practice.sql`: `sentence_cards` and `sentence_logs` with RLS copied from `cards` and `review_logs`, delete revokes, the word insert trigger creating a practice card, backfill for existing words, and `record_sentence(p jsonb)`; verify `supabase db reset` applies it (Maks runs it)
- [x] 1.2 Add integration tests: cross-user read, own-parent checks, logs append-only, no deletes, one practice card per word after insert and after backfill, `record_sentence` repeated call and another user's card; verify Maks runs them green

## 2. Shared AI code

- [x] 2.1 Move model ID, effort, prices, cap and `cost.ts`, plus the session check, `readSpend` and `logCall(kind)`, into `supabase/functions/_shared/` and import them from `autofill`; verify the existing `autofill-cost` and `autofill-validate` unit tests pass with the new paths and autofill behaves the same with `curl` (Maks runs it)

## 3. check-sentence function

- [x] 3.1 Add pure `placeIssues(sentence, issues)` and the output validator in `supabase/functions/check-sentence/validate.ts`; verify unit tests cover an exact quote, repeated text, a missing quote, more than 5 issues and message length
- [x] 3.2 Add `prompt.ts`, `schema.ts` and `index.ts` (session, body checks, word read scoped to the caller and active, cap, model with one retry, `kind: 'sentence_check'` logging, reply); verify with `curl` as alice for a correct sentence, `Ich gehe zu die Bank.`, bob using alice's word id, and a 301-character sentence (Maks runs it)

## 4. Client logic

- [x] 4.1 Add `src/js/lib/practice-queue.js` (`practiceQueue`, `practiceStatus`, `PRACTICE_NEW_PER_DAY`) and verify unit tests cover due order, eligibility, deleted words, the daily limit across the 04:00 rollover, and one appearance per session
- [x] 4.2 Add `src/js/lib/practice.js` (`highlightSegments`, `defaultRating`, `validIssues`) and `checkSentence` in `ai.js`; verify unit tests cover segments around 0, 1 and 2 issues, each default rating, bad offsets, and `checkSentence` ok, error, over_cap and 10 s timeout
- [x] 4.3 Add `listPracticeCards`, `listPracticeLogsSince` and `recordSentence` to `src/js/lib/db.js`; verify by the e2e in 6.1

## 5. Page and sidebar

- [x] 5.1 Build `src/pages/practice.html` (focus layout, no sidebar) and `src/js/pages/practice.js` (load error, "Nothing due for practice", prompt, "Checking sentence" with "Skip check", feedback with `<mark>` highlights via `textContent`, "Check unavailable", ratings 1 to 4, "Could not save this attempt" with "Retry", summary, Escape to Home), and add `practice` to the Vite `pages`; verify the build emits `practice.html` and the e2e in 6.1
- [x] 5.2 Add the Practice nav entry (Alt+P, chip, icon, count pill) after Review in `vite.config.js` and show its count from `sidebar.js` with `practiceStatus`; verify the built Home has the Practice link between Review and Add word

## 6. End-to-end and docs

- [x] 6.1 Add `tests/e2e/practice.spec.js` (stubbed `check-sentence`, words seeded with `de_en` in review state): highlighted issue and corrected sentence, default Hard, keyboard through to the summary, check unavailable with rating required, save failure and Retry, Escape ends the session, Practice count in the sidebar, Alt+P from Words; Maks runs `npm test`
- [x] 6.2 Hand Maks the "Proposed SPEC.md additions" and CLAUDE.md wording from design.md; do not edit those files
