## Context

M0 and M1 are archived. Words have two cards each, created by a trigger (`de_en` due at creation, `en_de` a day later). `db.js` holds every query; pages load through `lib`; `profiles.timezone` and `new_words_per_day` already exist. Motivation in `proposal.md`, requirements in `specs/`. Clients cannot delete rows, and `review_logs` is append-only. Local Supabase only.

## Goals / Non-Goals

**Goals:**
- A session that is predictable (same inputs, same queue), keyboard-only, and never loses a confirmed answer.
- All scheduling, grading, queue and day logic in pure modules with unit tests.

**Non-Goals:**
- AI, Settings, the review end-to-end test (M4), FSRS tuning, offline reviews, a session size cap.

## Decisions

**1. Pure modules and their shapes.** None touches the DOM, network or clock; every function takes `now`.
- `time.js`: `dayStart(now, tz)`, `nextDayStart(now, tz)`. Local wall-clock parts come from `Intl.DateTimeFormat(..., { timeZone, hourCycle: 'h23' })`. The logical date is the local date, minus one day when the local hour is below 4. The instant for "04:00 on that date" is found by taking the UTC guess, subtracting the zone offset at the guess, and re-checking the offset once at the result (handles DST). `nextDayStart` repeats this for the next date, so 23 and 25 hour days fall out without special cases.
- `grader.js`: `grade(answer, word, direction)` returns `{ result, rating, expected }`. Normalization folds ä/ö/ü/ß to ae/oe/ue/ss on both sides, lowercases, trims, collapses spaces. Typo check is Levenshtein distance 1 (insert, delete, substitute) on the folded strings; the 4-letter rule is measured on the unfolded lowercase target without article. For nouns in `en_de` the answer is split into an optional leading `der|die|das` and the rest.
- `scheduler.js`: `schedule(cardState, rating, now)` maps the DB card (state name, ISO strings) to a ts-fsrs `Card` (state enum 0 to 3, `Date`s, `learning_steps`), calls `fsrs().next(card, now, rating)` and maps the resulting card back. Default parameters, `enable_fuzz` off (the default), so it is deterministic. The exact `Card` fields (`elapsed_days`, `scheduled_days`, `learning_steps`) are checked against the installed 5.x typings in the first task.
- `queue.js`: `buildQueue({ cards, logsToday, pending, now, tz, limit })` and `homeStatus({ cards, logsToday, pending, now, tz, limit, wordCount })`. Cards arrive with their word embedded. Steps: drop deleted words and pending cards; mark due cards; add eligible new `en_de`; add new `de_en` up to `limit - introduced`; keep the first card per word in queue order. `introduced` counts `logsToday` entries whose `state_before.state` is `new` and whose card direction is `de_en` (pending answers are mapped into the same shape). `homeStatus` also returns `nextAvailable` per the review-queue spec.
- `pending.js`: functions over an injected storage object (`get`, `set`) plus an injected `send` function, so tests use a fake. Entries are `{ payload, attempts }`. `flush` sends in order, removes successes, increments `attempts` on failures and stops at the first failure to keep order. `needsBanner` is true when any entry has 3 or more attempts. If the storage throws, entries live in a module-level array.

**2. Rollover rule for "due".** A `review` card is due when `due < nextDayStart(now)`; `learning` and `relearning` cards when `due <= now`. ts-fsrs due times carry the time of day of the review, so `due <= now` would hide cards a daily user expects until later in the day. Consequence: "next due" shown to the user is the start of the due card's day (04:00), not its clock time. SPEC §4's key query says `due <= now()` and needs the amendment listed in the proposal.

**3. New cards.** Only `de_en` introductions count against the daily limit. A new `en_de` card is eligible when `due < nextDayStart`, its `de_en` card is no longer `new`, and that card's `last_review < dayStart`. This approximates "first reviewed on an earlier day" without needing the first-review time: it can only err by delaying an `en_de` card when the `de_en` card was reviewed again today (for example after Again), and the card appears on the next day. New `en_de` cards sort after due cards and before new `de_en` cards.

**4. FSRS learning steps need a column.** ts-fsrs 5.x tracks the position in the learning steps on the card. `cards.learning_steps int not null default 0 check (>= 0)` is added in a new migration, so default parameters can be kept. SPEC §4 needs the same column.

**5. One database function records a review.** Migration `..._review_recording.sql` also adds `unique (card_id, reviewed_at)` on `review_logs` and `record_review(p jsonb)`, `security invoker`, `language plpgsql`:
- insert into `review_logs` with `user_id = auth.uid()`, values from `p`, `on conflict (card_id, reviewed_at) do nothing`;
- if a row was inserted (`found`), update `cards` set the next-state fields from `p` where `id` matches and (`last_review is null or last_review < reviewed_at`).
The caller's RLS applies: the log insert policy already requires an owned card, so another user's card raises and nothing is written. The conflict clause makes a retry a no-op; the `last_review` guard keeps late arrivals from overwriting newer state while still logging them. Execute is revoked from `public` and `anon`, granted to `authenticated`. `jsonb` keeps the client call to one argument; casts fail loudly on bad data and the existing table checks (rating 1 to 4, grader result) still apply. Alternative: two client writes, rejected because a retry could double-log or leave the log and the card out of step.

**6. Data layer.** `db.js` gains `listQueueCards(pairId)` (cards with the word embedded, `words!inner`, active words only, the pair filter, no due filter, because the queue needs both siblings' state), `listLogsSince(dayStart)` (`card_id`, `reviewed_at`, `state_before`, `cards(direction)`), and `recordReview(payload)` calling the function. The log query embeds the direction so words deleted today still count toward today's introductions. Ceiling: all cards for the pair are fetched on each Home and Review load, fine for a few thousand words (`ponytail:` comment).

**7. Review page.** One page with four views (prompt, feedback, summary, nothing due), switched by `hidden`, built from `<template>`s. The page owns the in-memory queue array and the session answers list. A `keydown` handler on `document` acts only in the feedback view (keys 1 to 4 and Enter, ignoring modifier keys); the prompt view relies on the form's Enter. On submit the page records `reviewedAt = new Date()` and `performance.now()` to derive `duration_ms`, and calls `grade`. On confirm: `next = schedule(card, rating, reviewedAt)`, payload built with `state_before` equal to the card's FSRS fields, the card object in the queue replaced by `next` merged over the card (so an Again requeue starts from the new state), `recordReview` fired without awaiting; failure goes to the pending list.

**8. Pending list.** Stored under `pendingReviews:<userId>` in `localStorage` so accounts on a shared browser never mix. `flush` runs: right after a failed record, after each confirmed answer, in a 15 second interval on Review, and once at the start of Home and Review. Home and Review show the banner from `needsBanner`. The queue builder receives the pending entries so it skips their cards and counts their introductions.

**9. Home.** `index.js` loads cards, today's logs, the profile and the word count, flushes pending first, then renders from `homeStatus`. "Today" for logs is `dayStart(new Date(), profile.timezone)`.

**10. Tests.**
- Unit: `time` (Europe/Berlin around 2026-03-29 and 2026-10-25, 03:59 and 04:00 boundaries, America/New_York); `grader` (table-driven from every rule in SPEC §3 and the grading spec); `queue` (ordering, limit and introductions including pending, `en_de` eligibility, one per word, deleted and pending exclusion, rollover rule, `nextAvailable`); `scheduler` (interval ordering by rating, lapses, determinism, input not mutated, state mapping round trip, `learning_steps` carried); `pending` (fake storage and send: order, attempts, banner threshold, storage failure fallback).
- Integration: `record_review` (own card, other user's card, repeat, late arrival, forced owner, unique key, `learning_steps` default and check).
- Existing e2e: `words.spec.js` (Home shows "1 word" as the secondary line) and `signin.spec.js` (Review keeps its "Review" heading) are expected to keep passing; the tasks include checking them. The full review flow e2e stays in M4.

**11. Dependency.** `ts-fsrs` `^5.4.0`. Maks runs `npm install`.

## Risks / Trade-offs

- [ts-fsrs 5.x field names differ from my assumptions] → First task maps and tests against the installed typings before anything else uses the scheduler.
- [The rollover rule departs from SPEC §4] → Listed as a SPEC amendment; behavior is covered by queue tests.
- [`en_de` eligibility is an approximation] → Errs toward delaying a card by a day, never toward showing it early.
- [Client clock is the source of `now`] → Acceptable for one user; skew of seconds does not matter, and the `reviewed_at` key is stable across retries.
- [Fetching all cards per load] → Documented ceiling.
- [A stuck permanent failure retries forever] → The banner makes it visible; the answer stays in the list and in the browser until saved.
- [Pending list in `localStorage` is per browser] → Another device does not see it; the banner warns on the device that has it.

## Migration Plan

1. Maks runs `npm install` (adds `ts-fsrs`), then `supabase db reset`.
2. `npm test`.
3. Manual: add words, review a session with typos, an article error, an override and an Again; reload mid-session; stop Supabase to see the pending banner; restart it and see the banner clear.

Forward-only migrations; fixes ship as new files.

## Open Questions

- None that change the specs or tasks.
