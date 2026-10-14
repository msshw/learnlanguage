# Vocab App — Spec

Source of truth: the "Vocab App — Spec" doc (exported 2026-10-11). Change the doc first, then re-export this file.

## 1. Scope & principles

The MVP is a desk-first web app for learning a language from your own: add words with AI-suggested details, then review them on a deterministic FSRS schedule. German from English came first; any pair from the supported list works.

| Decision | Choice |
| --- | --- |
| Language pairs | Native English or Russian; targets from one list (German, French, Spanish, Italian, Portuguese, Dutch, Polish, Czech, Ukrainian, Russian, English), each offered once its AI quality set passes. Several pairs per account, one active at a time |
| MVP features | Add words + review loop; AI auto-fill when adding a word |
| Next milestone | None specced; candidates are listed under "After the MVP" (§8) |
| Out of MVP | Audio/pronunciation, import (Anki, CSV), gamification, stats dashboard, AI-generated example sentences |
| Primary usage | Desktop-first: desk sessions on a laptop, typing-heavy; mobile browser only needs to be usable, not optimized |
| Done when | Used daily for 2 weeks without blocking friction or bugs |

Core principles:

- **Deterministic by default.** Scheduling, review selection, grading and stats are plain code with unit tests.
- **AI only at defined touchpoints.** Each has a JSON contract and a fallback; the review loop works with AI down.
- **AI output is stored, not regenerated.** Auto-filled details are confirmed by the user and saved as word data.
- **Built to share later.** Supabase auth + Postgres, `user_id` on every row (except the shared `ai_suggestions` and `rejected_senses` tables; `profiles` is keyed by `id`), RLS from day one, AI key server-side in an edge function.
- **Cheap by design.** Small model (Claude Haiku 5.5) at low effort, cached system prompt, provider swappable behind the edge function.
- **Simple stack.** Output is vanilla JS + HTML + CSS, no framework. A light build step compiles Tailwind CSS and assembles pages from layouts and components; installable as a PWA.

## 2. User flows & screens

The app has six screens behind a left sidebar (Home, Review, Practice, Add word, Words, Settings), plus an Admin screen shown only to admins, with sign-in and a one-time language setup before them.

| Screen | Purpose | States to design |
| --- | --- | --- |
| Sign in | Supabase auth; only one account until sign-ups open | Signed out, error |
| Setup | First launch: pick native language (English, Russian), then a target language from the list | Shown once; more languages via Settings |
| Home | Due-today count, Start review button, quick Add word | No words yet, nothing due (shows next due time), all done today |
| Add word | Type a word or phrase in the target language, AI suggests details, user confirms and saves | Empty, AI loading, suggestion ready, AI unavailable (manual fields), duplicate found |
| Review | All due words one card at a time, then a summary | Card prompt, answer feedback, summary, nothing due |
| Practice | Write a sentence in the target language with a learned word, get AI feedback, rate it. Focus layout, no sidebar | Sentence prompt, checking, feedback (with and without AI), summary, nothing due |
| Words | Searchable table: word, translation, next due date; edit and delete | Empty, no results, editing, delete confirm |
| Word | One word's full details, reached from Words; an unknown or deleted word shows a not-found state with a link back to Words | Loaded, not found, load failed |
| Settings | Language pair and Add language, the active pair's daily new-word limit, AI usage this month, export my data, sign out | — |
| Admin | Admins only, a second sidebar with one page per item: Reports (with an open-reports count; the reporter's reason, per sense approve, edit and approve, or reject, remove a whole suggestion), Rejected (senses never suggested again, with Allow again), and read-only Suggestions, AI calls and Users pages (accounts and counts only, no user content; 50 rows per page) | Empty, report list, editing a sense, rejected list, tables |

**Language pairs**

A pair switcher at the top of the sidebar shows the active pair (target name, 'from <native>'; collapsed: the code) and lists the other pairs with their due counts. Choosing one makes it active on every device and reloads the page. Every screen shows the active pair only; there is no mixed queue. Pairs cannot be removed.

**Add word flow**

1. Type a word or phrase in the target language and press Enter.
2. If it's already in the vocabulary, the app says so and offers to open it.
3. AI suggests the details (see §3 fields and §5 contract).
4. The user edits any field and saves; the word enters the schedule as new.
5. If AI fails or times out, empty fields appear for manual entry.

**Review flow**

1. Start from Home or the sidebar.
2. The queue is all due cards plus new words up to the daily limit (rules in §3).
3. Each card: prompt, typed answer, feedback, next due date set.
4. Summary: cards reviewed, correct vs. failed, words to watch, next due time.
5. Leaving mid-session keeps every answer given so far.

**Desktop conventions**

- Keyboard-first: Enter submits, number keys pick ratings, Alt+H, R, P, A, W and S open the sidebar pages (Alt+M for admins); N opens Add word when not typing; Esc leaves a Review or Practice session.
- On wide screens the sidebar can collapse to icons (remembered per device); on narrow screens it keeps a narrow layout with every link reachable. Usable, not optimized.

## 3. Learning model

Each word produces two cards, forward (target shown, native typed) and reverse (native shown, target typed), with separate FSRS schedules. The user types answers, code grades them, and the user can override the grade.

**Word card fields**

| Field | Applies to | Required | Tested |
| --- | --- | --- | --- |
| Word or phrase in the target language | All | Yes | Yes |
| Translation(s) in the native language | All | At least one | Yes |
| Part of speech | All | Yes (AI suggests) | No; decides which fields apply |
| Article (der/die/das) | Nouns | Yes | Yes, in EN→DE |
| Plural | Nouns | No | Shown with answer |
| Präteritum, Partizip II, auxiliary (haben/sein), separable prefix | Verbs | No | Shown with answer |
| Example sentence + translation (`example_target`, `example_native`) | All | No | Shown with answer |
| Reverse hint (`hint_native`) | All | No (AI suggests) | Shown on reverse prompt |
| Notes, tags | All | No | No |

**Grading (deterministic)**

Before comparing, answers are normalized: Unicode NFC, trimmed, case-insensitive, spaces collapsed, then the typing equivalences of the language typed (German: ae/oe/ue/ss = ä/ö/ü/ß; Russian: е = ё). Other diacritics count. Article wrong applies to languages whose profile has articles (German).

| Result | Rule | Default rating |
| --- | --- | --- |
| Correct | Matches after normalization; in DE→EN, any listed translation counts | Good |
| Typo | One letter off (edit distance 1), words of 4+ letters only; typo is shown | Good |
| Article wrong | Noun correct, article wrong or missing | Hard |
| Wrong | Anything else | Again |

- The grader pre-selects a rating; keys 1–4 (Again/Hard/Good/Easy) change it before moving on. Easy is only reachable this way.
- Typo tolerance does not apply to words under 4 letters, so "Uhr" vs "Ohr" is wrong.

**Scheduling**

- FSRS via the ts-fsrs library with default parameters; tuning on personal history comes later.
- The scheduler sits behind one interface: `schedule(cardState, rating, now) → nextState`.
- Every review is appended to a log: card, typed answer, grader result, final rating, override flag, FSRS state before, timestamp.
- Daily queue: due cards first (most overdue first), then new words up to 10 per day per language pair (changeable in Settings).
- Cards rated Again come back later in the same session.
- Both cards of one word never appear in the same session; a new word's reverse card starts the day after its forward card.

**Sentence practice**

- One practice card per word with its own FSRS schedule, independent of the two review cards.
- A word joins practice once its forward card is in review state; up to 5 new practice words per day per pair; due practice cards come first, most overdue first.
- The user writes one sentence; AI marks issues and gives a corrected sentence; the user rates 1–4 with a suggested default (word unused → Again, any issue → Hard, otherwise Good). Without AI the user rates alone.
- Every attempt is appended to a practice log.

## 4. Data model

Eleven Postgres tables in Supabase. Nine are per user with row-level security (`profiles` is keyed by `id`; `suggestion_reports` is insert-only for clients; `sentence_cards` and `sentence_logs` are per user); `ai_suggestions` and `rejected_senses` are shared and closed to clients. Chain: profile → language pairs → words → two cards per word → append-only review log; AI calls are logged separately.

**profiles** (one row per user)

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | = auth.users.id |
| active_pair_id | uuid FK | Current language pair |
| timezone | text | Default Europe/Berlin; defines "today" |
| is_admin | bool | Default false; set by hand, never by a client (a trigger blocks it) |
| created_at | timestamptz | |

**language_pairs**

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| user_id | uuid FK | |
| target_lang | text | ISO code, e.g. de |
| native_lang | text | ISO code, e.g. en |
| new_words_per_day | int | Default 10 |
| created_at | timestamptz | Unique on (user_id, target_lang, native_lang) |

Notes: target_lang ≠ native_lang; languages fixed after creation (clients may update only the limit); codes checked by the edge functions against the supported list.

**words**

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| user_id, pair_id | uuid FK | |
| term | text | Word or phrase in the target language, without article |
| part_of_speech | text | Check: noun, verb, adjective, adverb, phrase, other |
| translations | text[] | At least one |
| hint_native | text | Short hint shown on reverse prompts, e.g. "bank (money)"; AI-suggested, editable |
| forms | jsonb | Per the target's language profile: German noun {article, plural}, verb {praeteritum, partizip2, auxiliary, separable_prefix}; other languages {}. Validated in code per part of speech |
| example_target, example_native | text | Optional |
| notes | text | Optional |
| tags | text[] | GIN index |
| source | text | manual or ai_confirmed |
| created_at, updated_at | timestamptz | |
| deleted_at | timestamptz | Soft delete; null = active |

Duplicates are not blocked by a constraint ("die Bank" has two meanings); the Add word screen only warns.

**cards** (two per word)

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| user_id, word_id | uuid FK | Unique on (word_id, direction) |
| direction | text | forward or reverse |
| state | text | new, learning, review, relearning (FSRS) |
| due | timestamptz | Indexed with user_id; reverse starts one day after forward |
| stability, difficulty | float | FSRS memory state |
| elapsed_days, scheduled_days, reps, lapses | int | FSRS counters |
| last_review | timestamptz | |

**review_logs** (append-only, never updated or deleted)

| Column | Type | Notes |
| --- | --- | --- |
| id | bigint identity PK | |
| user_id, card_id | FK | |
| reviewed_at | timestamptz | |
| typed_answer | text | Exactly as typed |
| grader_result | text | correct, typo, article_wrong, wrong |
| rating | smallint | 1–4 (Again/Hard/Good/Easy), final value |
| overridden | bool | User changed the grader's rating |
| state_before | jsonb | FSRS state before this review, for later tuning |
| duration_ms | int | Time to answer |

**ai_calls** (cost tracking and debugging)

| Column | Type | Notes |
| --- | --- | --- |
| id | bigint identity PK | |
| user_id | uuid FK | |
| kind | text | autofill or sentence_check |
| model | text | e.g. claude-haiku-5-5 |
| input_tokens, output_tokens, latency_ms | int | |
| ok | bool | Plus error text when false |
| created_at | timestamptz | Feeds the spending cap; cost = tokens × price constants |

**ai_suggestions** (shared cache of confirmed AI results; no `user_id`)

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| target_lang, native_lang | text | Language pair |
| term_key, corrected_key | text | Normalized input and model-corrected term |
| senses | jsonb | The validated model response (1–3 senses); each has `state` (candidate, confirmed or rejected) and, once an admin has acted, `judged: true` |
| model | text | |
| status | text | Summary of the senses: confirmed when any sense is confirmed, else candidate |
| deleted_at | timestamptz | Set by the admin "remove" action; removed suggestions are kept but never served or confirmed |
| created_at, confirmed_at | timestamptz | |

**suggestion_reports** (a user's complaint about a suggestion)

| Column | Type | Notes |
| --- | --- | --- |
| id | bigint identity PK | |
| user_id | uuid FK | Unique on (user_id, suggestion_id) |
| suggestion_id | uuid FK | |
| reason | text | What is wrong, 50–2000 characters |
| created_at, closed_at | timestamptz | Closed when no non-rejected sense is unjudged, or on remove |
| resolution | text | removed, kept (first version), approved, edited or rejected |

**rejected_senses** (shared; no `user_id`)

| Column | Type | Notes |
| --- | --- | --- |
| target_lang, native_lang, term_key | text | Pair and normalized term |
| fingerprint | text | Part of speech plus sorted lowercased translations |
| part_of_speech, translations | text, text[] | For the "do not suggest" prompt block |

Rejected senses are removed from every model result on the server and listed in the prompt as senses not to suggest.

**sentence_cards** (one per word; practice schedule)

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| user_id, word_id | uuid FK | Unique on word_id |
| state, due, stability, difficulty, elapsed_days, scheduled_days, learning_steps, reps, lapses, last_review | | Same FSRS columns as `cards` |

**sentence_logs** (append-only)

| Column | Type | Notes |
| --- | --- | --- |
| id | bigint identity PK | |
| user_id, sentence_card_id | FK | |
| practiced_at | timestamptz | Unique with sentence_card_id |
| sentence, corrected | text | What the user wrote; the AI correction |
| issues | jsonb | Offsets and messages |
| check_status | text | ok or unavailable |
| rating | smallint | 1–4 |
| state_before | jsonb | FSRS state before |
| duration_ms | int | |

**Access rules (RLS)**

- Per-user tables (not `ai_suggestions`, `rejected_senses`, `suggestion_reports`): rows visible and writable only where `user_id = auth.uid()` (`profiles`: `id = auth.uid()`).
- ai_suggestions and rejected_senses: no client access; read and written only by the autofill and admin functions.
- suggestion_reports: insert only for the signed-in user (with a reason); read and closed only by the admin function.
- The SQL functions `admin_users` and `admin_ai_calls` (account and call lists for the admin function) are executable by the service role only.
- No DELETE from the client on any table; words use soft delete.
- review_logs and sentence_logs: insert and select only. ai_calls: written only by the edge function, readable by the user.

**Key queries**

- Due queue: cards of the active pair's active words with `due <= now()`, most overdue first.
- New cards: `state = 'new'`, oldest first, up to the daily limit minus words introduced today, counted per pair.
- Duplicate check: active words where `lower(term)` matches.
- Word search: `ilike` on term and translations; add a trigram index only if it gets slow.

**Conventions**

- All timestamps stored in UTC; "today" is computed in the profile's timezone.
- The day rolls over at 04:00 local time, so late-night sessions count toward the same day.
- Schema changes are SQL migration files in the repo, applied with the Supabase CLI.

## 5. AI contracts

The MVP has two AI touchpoints, word auto-fill and the sentence check. A Supabase edge function holds the API key, enforces a $2 monthly cap, and every failure falls back to manual entry.

**Auto-fill endpoint**

1. Client sends `POST /functions/v1/autofill` with the user's Supabase JWT and `{ "term": "Bank", "pair_id": "..." }`. The function reads the pair's languages from the database, accepts only the caller's own pair and only pairs in the supported list.
2. The function verifies the user, then looks the term up in the shared `ai_suggestions` store (confirmed records only). A hit returns all stored senses with `confirmed: true`, with no model call, no `ai_calls` row and no cap check.
3. On a miss it sums this month's `ai_calls` cost; at $2 or more it returns `over_cap` without calling the model. Otherwise it calls the model, validates the output, logs the call to `ai_calls`, stores the result as a candidate in `ai_suggestions`, and returns it with its `suggestion_id`.
4. The client shows the senses; picking one fills the editable form. Nothing is saved until the user presses Save.
5. If the saved word still equals the picked sense, the client sends `{ "action": "confirm", "suggestion_id": "...", "sense_index": 0 }` and the function promotes that record to confirmed. The client never sends suggestion content; edited words are saved to the user's data only.

**Response shape**

```json
{
  "status": "ok",
  "senses": [
    {
      "term": "Bank",
      "part_of_speech": "noun",
      "translations": ["bank"],
      "hint_native": "bank (money)",
      "forms": { "article": "die", "plural": "Banken" },
      "example_target": "Ich gehe heute zur Bank.",
      "example_native": "I'm going to the bank today."
    },
    {
      "term": "Bank",
      "part_of_speech": "noun",
      "translations": ["bench"],
      "hint_native": "bench (seat)",
      "forms": { "article": "die", "plural": "Bänke" },
      "example_target": "Wir sitzen auf der Bank im Park.",
      "example_native": "We're sitting on the bench in the park."
    }
  ]
}
```

`status` is one of `ok`, `not_a_word`, `over_cap` or `error`. An `ok` response also carries `suggestion_id` (null if storing failed) and `confirmed` (true for a cache hit). `senses` holds 1–3 items, most common first. `term` comes back in corrected spelling and capitalization ("madchen" → "Mädchen").

**Prompt rules**

- Up to 3 distinct, common senses; no rare or archaic meanings.
- The prompt names both languages. Translations, hint and example translation are in the native language. Forms follow the target's profile (German: nouns article and plural; verbs Präteritum, Partizip II, auxiliary, separable prefix); generic targets return no forms. Input that isn't a word of the target language returns `not_a_word`.
- 1–3 short translations per sense.
- `hint_native`: at most 4 words, telling this sense apart from other target-language words with the same translation.
- Example sentence at A2–B1 level, 12 words or fewer, using the word in this sense.

**Model settings**

- `claude-haiku-5-5`, low effort, output capped at 2000 tokens (thinking tokens count toward the cap).
- Output forced to the JSON schema via structured output.
- System prompt (rules + schema) is prompt-cached; only the term changes per call.
- Model ID and per-token prices live in one config constant, so swapping providers is a one-line change.

**Validation (deterministic, in the edge function)**

- Schema check: required fields present, `part_of_speech` from the allowed list, `forms` keys match the part of speech in the target's profile, German article der/die/das, string length limits.
- Invalid output gets one retry, then `error`.

**Fallbacks**

| Situation | What the user sees |
| --- | --- |
| Timeout (8 s) or provider error | Empty manual fields, "Suggestions unavailable" |
| Over the $2 cap | Empty manual fields; Settings shows this month's usage |
| `not_a_word` | "Not recognized as <target language>", with an option to save manually anyway |
| Invalid output after retry | Empty manual fields |

**Cost estimate**

About 800 input tokens (mostly the cached system prompt) and 300 output tokens per call is roughly $0.0002 at Haiku 5.5 rates, so the $2 cap allows around 8,000 auto-fills a month.

**Quality test set**

One set per pair: at least de→en (the current ~20 words), de→ru, en→ru, fr→en, ru→en, and one set per other target. A target is offered only after its set passes. Maks runs it.

The de→en set is about 20 words with known correct answers, run by a script before any prompt or model change:

- Ambiguous nouns: Bank, Leiter, Schloss
- Separable verbs: anrufen, aufstehen
- Verbs with sein: gehen, fahren
- Irregular plurals: Haus, Mutter
- Misspellings: madchen, strasse
- Non-words and English words

The script checks fields automatically; senses and hints are reviewed by eye.

**Sentence check endpoint**

1. `POST /functions/v1/check-sentence` with the user's JWT and `{ "word_id": "...", "sentence": "Ich gehe zu die Bank." }`. The sentence is up to 300 characters.
2. The function applies the same monthly cap check as autofill, over all `ai_calls` of the month.
3. The model returns the corrected sentence, whether the word is used, and up to 5 issues that quote the faulty text. The function places each quote as offsets in the sentence, validates the output, retries once, and logs the call. The function takes the languages from the word's pair; issue messages are in the native language.
4. Response: `{ "status": "ok", "corrected": "Ich gehe zur Bank.", "uses_word": true, "issues": [ { "start": 9, "end": 15, "message": "zu takes the dative: zu der, contracted to zur." } ] }`. `status` is `ok`, `over_cap` or `error`.
5. Fallback: a timeout (10 s) or any failure shows "Check unavailable", and the user rates alone.

Sentence generation (AI example sentences) belongs to a later milestone and gets its own contract then.

## 6. Architecture

A static multi-page site, built with Vite and hosted on Cloudflare Pages, talks to Supabase directly for data and through edge functions for AI (`autofill`, `check-sentence`) and admin work (`admin`). There is no server of our own.

**How it fits together**

- Browser pages (vanilla JS modules) → Supabase Postgres via `supabase-js`, protected by RLS.
- Browser → edge function `autofill` → Claude API. The API key lives only in the edge function's secrets. A confirm for the picked sense also goes to `autofill`; responses carry each sense's `index` and `state`.
- Browser → edge function `admin` (service role, checks `is_admin` on every request) for the Admin screen. Actions: `list` (open reports), `approve`, `edit`, `reject`, `remove` (moderate a suggestion), `list_rejected` and `allow_again` (restore a rejected sense), the read-only `list_users`, `list_ai_calls` and `list_suggestions` (offset only, 50 rows, `has_more`), and `report_count` (number of suggestions with open reports, for the sidebar count). It never calls the model.
- Cloudflare Pages serves the built files.

**Repo layout**

```
vocab-app/
  src/
    layouts/         base.html (head, sidebar slot), admin-base.html
    components/      sidebar.html, word-form.html, admin-nav.html, admin-table.html
    pages/           index, review, practice, add, words, word, settings, setup,
                     signin, admin, admin-rejected, admin-suggestions,
                     admin-ai-calls, admin-users (.html)
    js/
      pages/         one entry module per page
      lib/
        db.js        all Supabase queries (only file that imports supabase-js)
        auth.js      session, sign-in, sign-out
        scheduler.js schedule(cardState, rating, now) -> nextState (wraps ts-fsrs)
        grader.js    normalize + grade(answer, word, direction, pair)
        languages.js supported languages and language profiles; copy of _shared/languages.ts, kept equal by a unit test
        queue.js     builds today's review queue
        time.js      "today" in the user's timezone, 04:00 rollover
        ai.js        calls the autofill function, maps failures to fallbacks
    styles/main.css  Tailwind entry
  public/            manifest.webmanifest, icons, sw.js
  supabase/
    migrations/      SQL files
    functions/autofill/index.ts, functions/check-sentence/index.ts,
    functions/admin/index.ts, functions/_shared/ (config, cost, model call, cache, fingerprint, validation, languages)
  tests/             unit/, integration/ (local Supabase), e2e/ (Playwright), helpers/
  scripts/           autofill-quality.mjs (AI test set), backfill-rejected-senses.ts
  vite.config.js
  SPEC.md, CLAUDE.md
```

**Code rules**

- `scheduler`, `grader`, `queue`, `practice-queue`, `practice`, `time` and `languages` are pure: no DOM, no network, no `Date.now()` (`now` is passed in), so they are unit-testable in isolation.
- Only `db.js` talks to Supabase; pages never query directly. Only `ai.js` calls the AI functions; the Anthropic API is never called from the client.
- Each page module: check session → load data through `lib` → render with DOM APIs and `<template>` elements. User content is inserted with `textContent`, never `innerHTML`. No framework.
- Vite builds one entry per page; a partials plugin assembles pages from `layouts` and `components`; Tailwind runs as a Vite plugin.
- The edge function is TypeScript on Supabase's Deno runtime; the vanilla JS rule applies to the client only.

**PWA**

- Manifest and icons make the app installable.
- The service worker caches the static shell only. Offline reviews are out of the MVP, so data always needs a connection.

**Environments and config**

| | Local | Production |
| --- | --- | --- |
| Frontend | Vite dev server | Cloudflare Pages (preview URL per branch) |
| Database, auth, functions | Supabase CLI in Docker (`supabase start`) | One Supabase cloud project |
| Deploy | — | Push to main deploys the site; migrations and functions via Supabase CLI |

- Client config comes from Vite env vars: Supabase URL and anon key. Both are public by design; RLS protects the data.
- `ANTHROPIC_API_KEY` exists only in Supabase function secrets: never in the repo or the client bundle.

## 7. Quality & operations

Pure logic is unit-tested, SQL and RLS have integration tests against local Supabase, the main flows (sign-in, words, auto-fill, review, practice, settings, admin) have Playwright tests, and tests run locally before every push. There is no CI in the MVP.

**Testing**

| Layer | Tool | Covers |
| --- | --- | --- |
| Unit | Vitest | Scheduler: ratings move due dates sensibly, sibling rule. Grader: normalization per language (ä/ae, е/ё, NFC), typo rule incl. words under 4 letters, wrong article → Hard, multiple translations. Queue: due ordering, daily new-word limit, deleted words excluded. Time: timezone, 04:00 rollover, daylight-saving days |
| End-to-end | Playwright against local Supabase | Sign in; add a word with auto-fill and with AI unavailable; one full review session through to the summary; practice, settings and admin flows |
| AI quality | Script over ~20 words | Before any prompt or model change (§5) |

- End-to-end tests stub the autofill function, so they are fast, free and repeatable.
- `npm test` runs unit and end-to-end tests; run it before pushing to main.

**Auth**

- Supabase email + password. Sign-ups are disabled in Supabase until the app is shared.
- `supabase-js` keeps the session; any page without a session redirects to sign-in and returns afterwards.
- Password reset uses Supabase's built-in email.

**Error handling**

| Failure | Behavior |
| --- | --- |
| Data fails to load | Inline message with a Retry button |
| A review fails to save | Kept in a local pending list and retried; the session continues. After 3 failed retries, a banner says it isn't saved yet |
| Session expired | Redirect to sign-in, then back to the same page |
| AI unavailable | Manual fields (fallbacks in §5) |
| Unexpected JS error | Global handler shows a small error bar and logs to the console |

**Data safety**

- Settings has "Export my data": one JSON file (version 2) with all language pairs, all words (including deleted), cards and review logs. Practice cards and logs are not in the export.
- Check whether the Supabase plan includes daily backups; if not, the export is the backup.
- Migrations are forward-only and run locally before production.

**Cost and limits**

- AI spend is tracked in `ai_calls` with the $2 monthly cap; Settings shows this month's usage.
- A hard spend limit in the Anthropic console is the second safety net.
- Supabase should stay within the free tier.

**Deploying without CI**

1. Apply migrations with the Supabase CLI.
2. Deploy the edge functions (`autofill`, `check-sentence`, `admin`) with the Supabase CLI.
3. Push to main; Cloudflare Pages builds and deploys the site.

## 8. Build plan & milestones

The MVP is built in six milestones, each usable on its own. Daily use can start after M2, with words entered by hand; AI arrives in M3.

**How each milestone runs**

1. Claude Code reads `SPEC.md` and `CLAUDE.md`, then works on one milestone in its own branch.
2. Pure logic is written test-first; Maks runs `npm test` and it must pass. Claude Code writes tests but doesn't build, run or verify the app.
3. Maks reviews the diff and ticks the acceptance criteria, then merges and deploys.

**M0 — Foundation**

Repo scaffold (Vite multi-page, HTML partials, Tailwind), Vitest and Playwright set up, local Supabase, migrations for the first six tables with RLS (eleven by M5 and the later changes), sign-in and sign-out, base layout with sidebar, first production deploy.

- [ ] `npm run dev` opens the sign-in page; a seeded user lands on an empty Home.
- [ ] A second test user cannot read or write the first user's rows (RLS test).
- [ ] The site runs on Cloudflare Pages against the cloud project, with sign-ups disabled.

**M1 — Setup and words**

Setup screen (language pair), Add word with manual fields, duplicate warning, Words screen with search, edit and soft delete. Saving a word creates its two cards.

- [ ] First sign-in shows Setup; afterwards it never appears again.
- [ ] Saving a noun validates the article; a verb shows verb form fields.
- [ ] Each new word gets a de_en card due now and an en_de card due tomorrow.
- [ ] Search finds words by German term or translation; deleted words disappear everywhere.

**M2 — Review loop**

`time.js`, `queue.js`, `grader.js`, `scheduler.js` with unit tests; Review screen (keyboard-first); summary; review log; pending-save retry; due count on Home.

- [ ] Unit tests cover every grading rule in §3 and the 04:00 rollover.
- [ ] A session shows all due cards plus new ones up to the daily limit, never both cards of one word.
- [ ] Enter submits, keys 1–4 change the rating, Again cards return in the same session.
- [ ] Every answer writes one review_logs row with the FSRS state before it.

**M3 — AI auto-fill**

Edge function with prompt, schema validation, ai_calls logging and the $2 cap; sense picker on Add word; `hint_en` on EN→DE prompts; AI test-set script.

- [ ] "Bank" offers both senses; picking one fills the form.
- [ ] With the function stopped, Add word falls back to manual fields within 8 seconds.
- [ ] Every call writes an ai_calls row; at $2 the function stops calling the model.
- [ ] The test set passes the automatic checks.

**M4 — Settings and polish**

Settings (daily limit, AI usage, export, sign out), PWA manifest and service worker, global error bar, the three end-to-end flows from §7, a check that mobile is usable.

- [ ] Export downloads one JSON file with words, cards and review logs.
- [ ] The app installs as a PWA from Chrome.
- [ ] All end-to-end tests pass locally.

After M4, two weeks of daily use decide whether the MVP is done.

**M5 — Sentence practice**

Practice page with its own queue, `sentence_cards` and `sentence_logs`, the `check-sentence` function with highlighted issues, the Practice link with its due count.

- [ ] Every word has one practice card; reviews and practice never change each other's cards.
- [ ] Practice shows due practice cards, then up to 5 new learned words a day.
- [ ] A checked sentence shows highlighted issues and the corrected sentence; with the function stopped, "Check unavailable" appears within 10 seconds and the attempt can still be rated.
- [ ] Every attempt writes one `sentence_logs` row and every check one `ai_calls` row of kind `sentence_check`; the $2 cap covers both kinds.

**After the MVP (not yet specced)**

Sentence generation, a stats page, and tuning FSRS on personal review history.

Research: the cost of repeating the target side across native languages. A French user asking for "Arbeit" triggers a fresh model call even though the target-language side (part of speech, forms, target-language example) is identical to an English user's suggestion. Idea: split a suggestion into a shared target part and a per-native translation part, so a new native language only needs a translation call (or a cheaper one). To find out: how much of the call cost is the target side, whether translation-only calls are really cheaper and good enough, and how this fits the per-sense moderation (judged and rejected states are per sense and per pair today).
