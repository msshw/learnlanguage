## Context

See proposal.md for why. Decided with Maks in explore mode (not reopened here): separate records per pair, a flexible choice from one language list (natives `en`, `ru`; eleven targets), German keeps a rich profile and every other target uses a generic one, renames in one migration, several pairs per account with one active pair, a per-pair daily limit, an account-wide timezone and $2 cap.

Current state that shapes the approach:

- Schema already supports many pairs: `language_pairs` unique on (user, target, native), `words.pair_id`, `profiles.active_pair_id` with an RLS check that the pair is the caller's. `profiles.new_words_per_day` holds the limit. `language_pairs` has an update policy for the owner on every column.
- `cards.direction` is `de_en` / `en_de` (check constraint from `20261011120000_schema.sql`); the cards are created by `create_cards_for_word()` (last replaced in `20261016100000_sentence_practice.sql`, which also inserts the practice card). `record_review` and `record_sentence` never read the direction; review payloads, pending entries in the browser and `review_logs.state_before` carry no direction either.
- Words have `hint_en`, `example_de`, `example_en`; the same keys live inside every element of `ai_suggestions.senses` (plus `state`, `judged`). `rejected_senses`, `suggestion_reports`, `sentence_logs.issues` and `review_logs.state_before` hold none of them.
- `autofill` checks `body.target_lang/native_lang` against `LANGS = {de, en}` in `_shared/config.ts`; prompt, schema (`is_german_word`, six nullable forms) and `_shared/validate.ts` are German. The admin `edit` path reuses `validate()` with `is_german_word: true`. `check-sentence` reads the word with the service role filtered by `user_id`, and its prompt is German/English.
- Client: `grader.js` folds ä/ö/ü/ß for every string; `word-form.js` hard-codes articles and verb forms; `ai.js` sends `de`/`en`; `setup.js` creates `de`/`en`; `sidebar.js`, Home and Review read `profile.new_words_per_day`; `listLogsSince` and `listPracticeLogsSince` are not scoped to a pair; page copy names German and English in about ten places.

## Goals / Non-Goals

**Goals:**
- The `de`/`en` pair behaves exactly as today after the migration (same words, cards, schedules, grading of German, prompt rules), apart from the renamed names and the NFC step.
- A new pair needs no code: a list entry and its quality set.
- Every pair a function acts on is read from the database and owned by the caller.

**Non-Goals:**
- Translating the interface (it stays English for every native language).
- Rich profiles for French, Spanish and the rest (articles, gender, verb forms); a later change per language.
- Removing a pair, renaming a pair's languages, moving words between pairs.
- Sharing the target-language side of suggestions across native languages (see "Later research").
- A mixed review queue across pairs.

## Decisions

**1. One language module, two copies.** `supabase/functions/_shared/languages.ts` and `src/js/lib/languages.js` export the same data: `LANGUAGES` (code → `{ name, native: bool, target: bool, profile }`) and `PROFILES` (`german`, `generic`, `russian`), plus pure helpers `isAllowedPair(target, native)`, `languageName(code)`, `profileOf(code)`. A unit test imports both and deep-compares the data. A target is only in the list once its quality set has passed (ai-autofill "Quality test set"), so the list itself is the switch for offering a language. Alternative: one JSON file imported by Deno and Vite, no copy; noted, but Maks chose the copy plus test, so it stays.

**2. Language profile = a small config object.**

```js
german:  { articles: ['der','die','das'],
           forms: { noun: ['article','plural'],
                    verb: ['praeteritum','partizip2','auxiliary','separable_prefix'] },
           auxiliaries: ['haben','sein'],
           fold: [['ä','ae'],['ö','oe'],['ü','ue'],['ß','ss']] }
generic: { articles: [], forms: {}, auxiliaries: [], fold: [] }
russian: { articles: [], forms: {}, auxiliaries: [], fold: [['ё','е']] }   // generic plus e/yo
```

German = the current constants (`ARTICLES`, `AUXILIARIES`, `NOUN_FORMS`, `VERB_FORMS`, the grader's replaces) moved into data, so its behaviour is unchanged. `de` → `german`, `ru` → `russian`, every other code → `generic`. A word's profile is its pair's target; typing normalization picks the profile of the language being typed (reverse: target; forward: native). The German prompt rules (articles, plural, verb forms, the "madchen → Mädchen" kind of correction) live in the functions only, keyed by profile id, since the client never builds prompts. Alternative: a class per language; rejected, three data objects are enough.

**3. Grading.** `grade(answer, word, direction, pair)`; `normalize(s, lang)` = NFC, trim, lowercase, collapse spaces, then the profile's `fold`. Typo counting stays "letters before folding". The article branch runs only when the target profile has articles; its regex is built from `profile.articles`. Two deliberate differences from today, both invisible for `de`/`en` in practice: NFC is new (a decomposed ä typed on some keyboards now matches), and English answers no longer get the ä/ae fold (English words do not contain those letters). Other diacritics stay significant, and the edit-distance rule makes a single missing accent a typo (Good), not wrong.

**4. Forms UI.** `initWordForm(form, profile, names)` hides the noun and verb groups when the profile has no forms for that part of speech and fills the labels from the language names; `buildWord(raw, profile)` validates article and auxiliary only from the profile and keeps "Enter the article in its own field" for profiles with articles. `articleBadge(word, profile)` returns null without articles. The admin edit form takes the profile of the suggestion's `target_lang` (already in the admin list rows), not the admin's active pair.

**5. Autofill request names the pair by id.** Body `{term, pair_id}`. The function reads `language_pairs` with the service role filtered by `id` and `user_id = caller`, then `isAllowedPair`; unknown, malformed, foreign or unsupported → 400 before the cache, the cap and the model. Any `target_lang`/`native_lang` in the body is ignored. Alternative: keep `{target_lang, native_lang}` and check the list; rejected because the client could ask for any allowed pair it never created, and the pair row is the thing the user owns. Confirm and usage requests are unchanged (no pair).

**6. Prompt construction.** `systemPrompt(pair)` returns the common rules with the two language names inserted ("You help a <Native> speaker learning <Target> ...; translations, hint_native and example_native in <Native>; set is_target_word to false when the input is not a <Target> word ...") followed by the profile's rule block (German: the current forms rules; generic: "forms is not part of the answer"). `outputSchema(profile)` keeps the six nullable forms for German and drops `forms` for generic; `validate(raw, profile)` returns `forms: {}` for generic and rejects any forms key it gets. Schema field `is_german_word` becomes `is_target_word`; sense keys become `hint_native`, `example_target`, `example_native`. The hint examples ("bank (money)") stay English, introduced as "for example, for English"; the prompt says explicitly which language each field is in. The system prompt differs per pair, so prompt caching works per pair; the user message and avoid block are unchanged. `check-sentence` gets `systemPrompt(pair)` the same way: "a <Target> sentence written by a <Native> speaker", "message: a short <Native> explanation", and the German quote example (`zu die`) only in the German block.

**7. check-sentence reads the pair from the word.** One query: `words` with `language_pairs!inner(target_lang, native_lang)`, filtered by `id`, `user_id = caller`, `deleted_at is null`; then `isAllowedPair`; failure → 400. Nothing about languages comes from the client.

**8. Card directions `forward` / `reverse`.** `forward` = target term shown, native typed (old `de_en`); `reverse` = native shown, target typed (old `en_de`). Code that compares directions goes through the names only (`queue.js`, `practice-queue.js` `deEnState` → `forwardState`, `db.js` `listPracticeCards`, `review.js`, `grader.js`). UI copy never shows the words "forward" or "reverse": the Review direction line shows "<Target> → <Native>" / "<Native> → <Target>", and the form's hint label reads "Hint for <Native> to <Target> prompts (optional)".

**9. Active pair everywhere.** `requireSetup()` returns the profile with its active pair embedded (`language_pairs` row incl. `new_words_per_day`). Pages read languages and the limit from that pair. `listLogsSince(start, pairId)` and `listPracticeLogsSince(start, pairId)` filter through `cards → words.pair_id` (inner join), so introductions and "answers today" count per pair, deleted words included as today. Pending answers need no change: the queue only counts pending entries whose card is in the pair's card set.

**10. Pair switcher.** In `components/sidebar.html` above the links: a button (target name, "from <Native>", collapsed: the code) and a menu. `sidebar.js` loads `listPairs()` with the profile; on first open it computes each other pair's `homeStatus().dueCount` from `listQueueCards(pairId)`, `listLogsSince(start, pairId)` and the pair's limit (`Promise.allSettled`, a failed count is left out). Choosing calls `setActivePair(id)` (profile update, RLS checks ownership) then `location.reload()`. ponytail: counts load all cards of every other pair on menu open; fine for a few pairs, a per-pair count RPC if it gets slow.

**11. Setup and "Add language" share one call.** `createPair(target, native)` inserts with `on conflict do nothing` (`ignoreDuplicates`), selects the pair by its languages, then sets it active. Upsert with update is no longer possible because pair languages lose their update grant (Decision 13). Setup asks native first; both pages filter targets with `isAllowedPair`.

**12. Per-pair limit.** Column on `language_pairs`, settings save writes the active pair (`updatePairLimit(pairId, n)`). `profiles.new_words_per_day` is dropped in the same migration: after this change nothing reads it (`admin_users`, `handle_new_user` and the export do not), and keeping a dead column invites using it. The practice new-card limit (5) becomes per pair as well, because practice logs are now pair-scoped like review logs (agent's call; Maks to confirm).

**13. Database hardening for pairs.** `check (target_lang <> native_lang)`; `revoke update on language_pairs from authenticated; grant update (new_words_per_day) on language_pairs to authenticated`, so a pair's languages cannot change under its words. Codes are not checked in SQL: that would be a third copy of the list; the functions refuse unsupported pairs, and a pair with a bad code only affects its owner.

**14. Export version 2.** Adds `language_pairs`; rows carry the new column names and directions. Without the pairs, a two-pair export cannot tell which words are which language (agent's call; Maks to confirm).

**15. Admin.** Reports, Rejected and Suggestions already show "<target> to <native>". The `edit` action reads the suggestion's `target_lang, native_lang` first and validates with that profile; the stored sense uses the new keys. AI calls and Users pages are unchanged.

## Security review points (reviewed by Opus/Maks)

- **Pair ownership in every function.** `autofill`: pair read with `.eq('user_id', user.id)` before anything else; `check-sentence`: pair comes only from the caller's own active word; `admin` edit: pair comes from the suggestion row. No function trusts a language code from the body.
- **List validation server-side.** `isAllowedPair` runs in the function on the stored codes; the client list only shapes the UI. Curl checks: foreign `pair_id` 400, malformed id 400, own pair `xx`/`en` 400, own pair `en`/`en` impossible (check constraint), foreign `word_id` 400, cap still enforced per account across pairs.
- **RLS unchanged in shape.** `words_insert_own` already requires an own `pair_id`; `profiles_update_own` already requires an own `active_pair_id`. New: column grant on `language_pairs`, check constraint. No new client DELETE; `review_logs`/`sentence_logs` stay append-only.
- **Shared stores.** `ai_suggestions` and `rejected_senses` stay closed to clients; every read and write keeps filtering by `target_lang` and `native_lang` taken from the pair row.
- **Prompt injection.** Language names come from the list, never from user text; the term and sentence stay inside their tags.

## Risks / Trade-offs

- [JSON rewrite of `ai_suggestions.senses` loses or reorders data] → a pure SQL function `rename_sense_keys(jsonb)` that renames only present keys (`hint_en` → `hint_native` etc.), keeps every other key (`state`, `judged`, `forms`) and the order (`with ordinality`); integration test on seeded legacy rows (confirmed+judged, rejected, candidate, missing optional key); a count check in the migration that no element still has an old key.
- [Model quality differs per language; small model may answer in English for Russian natives or mix scripts] → per-pair quality sets with a script check, a language enters the list only after its set passes, Maks runs them.
- [Russian script and the typing check] → `toLowerCase` handles Cyrillic; е/ё fold; NFC; unit tests with Cyrillic and Ukrainian (і, ї, є stay significant). Keyboard layout switching is the user's matter.
- [Generic targets have no articles, so a French learner typing "la maison" for `maison` is graded wrong] → accepted for now; a French profile is a later change. The hint and example still teach the article.
- [Existing tests use `de_en`, `en_de`, `hint_en`, `example_*`] → about 25 test files (unit, integration, e2e, helpers) are updated in the same task group as the code they cover; a grep for the old names over `src`, `supabase`, `tests` and `scripts` must come back empty.
- [The old client breaks between migration and site deploy (columns renamed)] → local-only for now; when cloud deploy resumes, apply migration, functions and site in one sitting.
- [Prompt text changes for `de`/`en` because field names change] → Maks reruns the `de`→`en` set before merging.
- [Switcher counts cost one card load per other pair] → loaded only on menu open; see Decision 10.

## Migration Plan

One new file `supabase/migrations/20261018100000_language_pairs.sql`, one transaction, in this order:

1. `language_pairs`: add `new_words_per_day int not null default 10 check (>= 0)`; copy each user's `profiles.new_words_per_day` into all their pairs; drop `profiles.new_words_per_day`; add `check (target_lang <> native_lang)`; replace the update grant with `grant update (new_words_per_day)`.
2. `words`: rename `hint_en` → `hint_native`, `example_de` → `example_target`, `example_en` → `example_native`.
3. `cards`: drop the direction check; `update cards set direction = case direction when 'de_en' then 'forward' when 'en_de' then 'reverse' end`; add `check (direction in ('forward','reverse'))`. The unique (word_id, direction) cannot collide: the mapping is one to one.
4. `create or replace function create_cards_for_word()` with `forward`/`reverse` and the practice card insert kept; re-revoke execute.
5. `create function rename_sense_keys(jsonb) returns jsonb` (immutable, service role only); `update ai_suggestions set senses = rename_sense_keys(senses)`; assert no element keeps `hint_en`, `example_de` or `example_en`.

Then: functions (`autofill`, `check-sentence`, `admin`) and site in the same sitting. Before running against any real data: take "Export my data" and a `pg_dump` of `ai_suggestions`.

Rollback (forward-only, so a new migration if ever needed), reverse order: 5 rename keys back with an inverse function; 4 restore the trigger with `de_en`/`en_de`; 3 swap the check and values back; 2 rename the columns back; 1 re-add `profiles.new_words_per_day` from each user's active pair (default 10), restore the full update grant on `language_pairs`, drop the check and the pair column. Then redeploy the previous functions and site. Pairs other than `de`/`en` and their words would have to be soft-deleted first, since the old code knows only one pair. Locally, rollback is checking out the previous commit and `supabase db reset`.

## Open Questions

Resolved by the decisions with Maks: the target list (eleven, gated by quality sets), generic normalization (NFC, lowercase, trim, collapse, no accent folding, Russian е/ё), no gender or article field in the generic profile, several pairs per account with a switcher, per-pair limit, no pair removal.

Still open, deferrable without changing specs or tasks:

- When to give French, Spanish or Italian a rich profile (articles, gender), and whether article-wrong grading should apply to them then.
- Whether the per-pair system prompt reaches the model's minimum cacheable length; measure cache-read tokens in `ai_calls` after launch.
- Ukrainian and Russian share Cyrillic; whether `not_a_word` separates them reliably is for the quality sets to show.

## Later research (do not forget): cost of repeating the target side

A French user asking for "Arbeit" triggers a fresh model call even though the target-language side (part of speech, forms, target-language example) is identical to an English user's suggestion. Idea: split a suggestion into a shared target part and a per-native translation part, so a new native language only needs a translation call (or a cheaper one). Needs research: how much of the call cost is the target side, whether translation-only calls are really cheaper and good enough, and how this fits the per-sense moderation (judged and rejected states are per sense and per pair today). Not part of this change: this change keeps one record per pair and no cross-pair sharing. Add to SPEC.md "After the MVP" once Maks approves.

## Proposed doc updates

For Maks to approve; not applied by agents.

**SPEC.md §1 Scope & principles**
- Intro: "The MVP is a desk-first web app for learning a language from your own: add words with AI-suggested details, then review them on a deterministic FSRS schedule. German from English came first; any pair from the supported list works."
- Table row "Language pairs": "Native English or Russian; targets from one list (German, French, Spanish, Italian, Portuguese, Dutch, Polish, Czech, Ukrainian, Russian, English), each offered once its AI quality set passes. Several pairs per account, one active at a time."

**SPEC.md §2 User flows & screens**
- Setup row: "First launch: pick native language (English, Russian), then a target language from the list | Shown once; more languages via Settings".
- Add word row and flow step 1: "Type a word or phrase in the target language".
- Practice row: "Write a sentence in the target language ...".
- Settings row: "Language pair and Add language, the active pair's daily new-word limit, AI usage this month, export my data, sign out".
- New paragraph "Language pairs": "A pair switcher at the top of the sidebar shows the active pair (target name, 'from <native>'; collapsed: the code) and lists the other pairs with their due counts. Choosing one makes it active on every device and reloads the page. Every screen shows the active pair only; there is no mixed queue. Pairs cannot be removed."

**SPEC.md §3 Learning model**
- "Each word produces two cards, forward (target shown, native typed) and reverse (native shown, target typed), with separate FSRS schedules."
- Word card fields: "Word or phrase in the target language", "Translation(s) in the native language", "Article and other forms: per language profile (German: article, plural, Präteritum, Partizip II, auxiliary, separable prefix; other languages: none)", "Example sentence + translation (`example_target`, `example_native`)", "Reverse hint (`hint_native`)".
- Grading: "Answers are normalized: Unicode NFC, trimmed, case-insensitive, spaces collapsed, then the typing equivalences of the language typed (German: ae/oe/ue/ss = ä/ö/ü/ß; Russian: е = ё). Other diacritics count." Article wrong applies to languages whose profile has articles (German).
- Scheduling: "new words up to 10 per day per language pair (changeable in Settings)"; sibling rule with forward/reverse. Practice: "once its forward card is in review state; up to 5 new practice words per day per pair".

**SPEC.md §4 Data model**
- profiles: remove `new_words_per_day`.
- language_pairs: add `new_words_per_day int, default 10`; notes "target_lang ≠ native_lang; languages fixed after creation (clients may update only the limit); codes checked by the edge functions against the supported list".
- words: `term` "Word or phrase in the target language, without article"; `hint_native` "Short hint shown on reverse prompts"; `forms` "Per the target's language profile: German noun {article, plural}, verb {praeteritum, partizip2, auxiliary, separable_prefix}; other languages {}"; `example_target, example_native`.
- cards: `direction` "forward or reverse"; due note "reverse starts one day after forward".
- ai_suggestions senses: keys `hint_native`, `example_target`, `example_native`.
- Key queries: "Due queue and new cards: cards of the active pair's active words; words introduced today counted per pair."

**SPEC.md §5 AI contracts**
- Auto-fill step 1: "`POST /functions/v1/autofill` with the JWT and `{ "term": "Bank", "pair_id": "..." }`. The function reads the pair's languages from the database, accepts only the caller's own pair and only pairs in the supported list."
- Response example: `hint_native`, `example_target`, `example_native`.
- Prompt rules: "The prompt names both languages. Translations, hint and example translation are in the native language. Forms follow the target's profile (German: nouns article and plural; verbs Präteritum, Partizip II, auxiliary, separable prefix); generic targets return no forms. Input that isn't a word of the target language returns `not_a_word`."
- Validation: "forms keys match the part of speech in the target's profile; German article der/die/das".
- Fallbacks: "Not recognized as <target language>".
- Quality test set: "One set per pair: at least de→en (the current ~20 words), de→ru, en→ru, fr→en, ru→en, and one set per other target. A target is offered only after its set passes. Maks runs it."
- Sentence check: "The function takes the languages from the word's pair; issue messages are in the native language."

**SPEC.md §6 Architecture**
- Repo layout `lib/`: add `languages.js` (supported languages and language profiles; copy of `_shared/languages.ts`, kept equal by a unit test); `grader.js` "normalize + grade(answer, word, direction, pair)"; `functions/_shared/` add "languages".
- Code rules: add `languages` to the pure modules.

**SPEC.md §7 Quality & operations**
- Data safety: "one JSON file (version 2) with all language pairs, all words (including deleted), cards and review logs".
- Testing row Unit: "Grader: normalization per language (ä/ae, е/ё, NFC), ...".

**SPEC.md §8**: acceptance lines of finished milestones keep `de_en`/`en_de` as history; "After the MVP": add the split-suggestion research item above.

**CLAUDE.md**
- First line: "Personal vocabulary trainer for a language you learn from your own (German ← English first): typed reviews on an FSRS schedule, with AI auto-fill when adding words."
- Architecture rules: add `languages.js` to the list of pure modules, and the line "`src/js/lib/languages.js` is a copy of `supabase/functions/_shared/languages.ts`; change both, a unit test keeps them equal."
- Data rules: add "A language pair's languages never change after creation; functions take a pair only from the database and accept only pairs in the supported list."
