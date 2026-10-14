Who runs checks: per CLAUDE.md, agents run every unit, integration, e2e, build and curl check named below themselves (haiku subagents); Maks reviews in the browser. The AI quality run (7.3) is always Maks's: it costs money.

## 1. Languages and profiles (pure)

- [x] 1.1 Add `supabase/functions/_shared/languages.ts` with `LANGUAGES` (eleven targets, natives `en`, `ru`, English names), `PROFILES` (`german`, `generic`, `russian` as in design Decision 2), `isAllowedPair`, `languageName`, `profileOf`; verify a Vitest unit test covers allowed pair `fr`/`ru`, same language, native `fr`, unknown `xx`, and `de` → german, `ru` → russian, `fr` → generic
- [x] 1.2 Add the client copy `src/js/lib/languages.js` and `tests/unit/languages.test.js` that deep-compares both copies; verify the test fails when one entry is removed from one copy and passes when equal
- [x] 1.3 Rewrite `grader.js` to `grade(answer, word, direction, pair)` with `normalize(s, lang)` (NFC, trim, lowercase, collapse, profile fold) and `forward`/`reverse`; update `tests/unit/grader.test.js` to the new names and add cases: Russian е/ё, Cyrillic case, Cyrillic typo, French accent wrong vs typo, NFC composed/decomposed, generic "la maison" wrong not article wrong, every existing German case unchanged; verify the unit tests pass
- [x] 1.4 Make `word-form.js` profile-driven (`buildWord(raw, profile)`, `senseToFormValues`, `matchesSense` with `hint_native`, `example_target`, `example_native`) and `word-form-view.js` (`initWordForm(form, profile, names)`, `articleBadge(word, profile)`, labels from names); update `tests/unit/word-form.test.js` with German cases unchanged plus a generic noun saving with `forms {}` and no article error; verify the unit tests pass

## 2. Migration (reviewed by Opus/Maks)

- [ ] 2.1 Add `supabase/migrations/20261018100000_language_pairs.sql` in the order of design "Migration Plan" steps 1 to 5 (per-pair limit with copy and profile column drop, pair check and column grant, word column renames, direction values and check, `create_cards_for_word` replacement, `rename_sense_keys` and the senses rewrite with a no-old-key assertion); verify `supabase db reset` applies all migrations and the seed without error
- [ ] 2.2 Add `tests/integration/language-pairs.test.js`: renamed word columns exist and old ones do not; a new word gets `forward` due now and `reverse` due +24 h plus its practice card; inserting `de_en` is rejected; `rename_sense_keys` on seeded legacy senses (confirmed+judged, rejected, candidate, one without `example_en`) keeps values, order, `state`, `judged`; `new_words_per_day` default 10, `-1` rejected, bob cannot update alice's pair; `target_lang` update rejected, `en`/`en` insert rejected, duplicate insert with ignore leaves one pair; verify the integration tests pass
- [ ] 2.3 Carry-over check on old-shaped data: `supabase db reset --version 20261017100000`, load a fixture SQL (alice with a `de`/`en` pair, profile limit 7, words with `hint_en` and examples, a `de_en` card in state `review` with 3 review logs, `ai_suggestions` with legacy sense keys), then `supabase migration up`; verify with SQL assertions that the pair limit is 7, the hint and examples sit under the new names, the card is `forward` in `review` with the same due time and 3 logs, and no sense keeps an old key
- [ ] 2.4 Update existing integration tests (`rls.test.js`, `words.test.js`, `review.test.js`, `suggestion-senses.test.js`, `allow-sense-again.test.js`, `sentence-practice.test.js`) to the new column names, directions and the profile/pair limit move, including "other profile fields still editable" now using `timezone`; verify all integration tests pass

## 3. Edge functions (security parts reviewed by Opus/Maks)

- [ ] 3.1 `_shared/validate.ts`: `validate(raw, profile)` with `is_target_word`, the renamed keys, forms and articles from the profile, generic forms `{}` and any forms key rejected; remove `LANGS`, `ARTICLES`, `AUXILIARIES`, `NOUN_FORMS`, `VERB_FORMS` from `config.ts` (they move to the profile); update `tests/unit/autofill-validate.test.js`; verify German cases unchanged and generic cases pass
- [ ] 3.2 `autofill/prompt.ts` and `schema.ts`: `systemPrompt(pair)` and `outputSchema(profile)` per design Decision 6; verify unit tests: the `de`/`en` prompt contains every current rule with renamed fields, the `fr`/`ru` prompt names French and Russian and contains no der/die/das or verb-form rule, the generic schema has no `forms`
- [ ] 3.3 `autofill/index.ts`: read `{term, pair_id}`, load the pair filtered by caller, `isAllowedPair`, then cache lookup, rejected senses and insert with the pair's codes; verify by curl as alice: own `de`/`en` pair ok; bob's `pair_id` 400; malformed id 400; alice's own `xx`/`en` pair (inserted via the client) 400; no `ai_calls` row for any 400; over the cap still `over_cap`; a `de`/`ru` request does not hit a `de`/`en` confirmed record
- [ ] 3.4 `check-sentence`: read the word with `language_pairs!inner(target_lang, native_lang)`, `isAllowedPair`, `systemPrompt(pair)` with messages in the native language and the German example only for German; verify by curl: own word ok, bob using alice's word id 400, a word of an `xx` pair 400, a body `target_lang` ignored, over the cap `over_cap`; update `tests/unit/sentence-validate.test.js` if prompts are covered there
- [ ] 3.5 `admin/index.ts` edit: read the suggestion's `target_lang`, `native_lang`, validate with that profile, store renamed keys; verify unit or curl: editing a `fr`/`en` sense with an article returns `invalid` and changes nothing, a valid `de`/`en` edit stores `hint_native`
- [ ] 3.6 Grep `supabase/functions` and `scripts` for `hint_en`, `example_de`, `example_en`, `is_german_word`, `LANGS`, `de_en`, `en_de`; verify no match remains (comments included)

## 4. Client lib

- [ ] 4.1 `db.js`: `getProfile` embeds the active pair; `listPairs`, `createPair(target, native)` (insert ignore duplicates, select, set active), `setActivePair(id)`, `updatePairLimit(pairId, n)`; `listLogsSince(start, pairId)` and `listPracticeLogsSince(start, pairId)` scoped through `cards → words.pair_id`; `listPracticeCards` returns `forwardState`; `exportRows` adds `language_pairs`; remove `updateProfileLimit` and `createActivePair`; verify by the e2e in group 6
- [ ] 4.2 `queue.js` and `practice-queue.js` to `forward`/`reverse` and `forwardState`; update `tests/unit/queue.test.js` and `practice-queue.test.js`; verify they pass, including "other pair's introductions do not count" given pair-scoped logs
- [ ] 4.3 `ai.js`: `suggest(term, pairId)` sends `{term, pair_id}`; update `tests/unit/ai.test.js`; verify it passes
- [ ] 4.4 `export.js`: version 2 with `language_pairs`; update `tests/unit/export.test.js`; verify it passes
- [ ] 4.5 `auth.js` `requireSetup()` returns the profile with its active pair; every page module reads limit, languages and profile from it; verify `npm run build` succeeds and no page reads `profile.new_words_per_day` (grep)

## 5. Pages: setup, switcher, settings, copy

- [ ] 5.1 Setup page: native select (English, Russian) first, then target choices filtered by `isAllowedPair`, "Start learning" disabled until both chosen, keyboard reachable; verify by e2e 6.2
- [ ] 5.2 Pair switcher in `components/sidebar.html` and `sidebar.js` per design Decision 10 (button, menu with other pairs and lazy due counts, "No other languages" with a link to Settings, arrow keys, Enter, Escape, inline error on failure, collapsed shows the code with the full accessible name); verify by e2e 6.3 and Maks in the browser, collapsed and expanded
- [ ] 5.3 Settings: "German ← English" from names, "Add language" (target, native defaulting to the active pair's), per-pair limit save; verify by e2e 6.4
- [ ] 5.4 Page copy from language names: Add word label and "Not recognized as <Target>", Home and Words empty states, form labels, Review direction line, word page labels; article badges only with the German profile on Add word, Words, word page, Review, Practice and Admin; verify a grep of `src` for "German" and "English" finds only `languages.js`, and e2e 6.5
- [ ] 5.5 Admin page edit form uses the suggestion's profile and names; sense rows show `example_target`; verify by the updated `tests/e2e/admin.spec.js`

## 6. End-to-end tests (autofill and check-sentence stubbed)

- [ ] 6.1 Update every e2e spec and `tests/helpers` to `hint_native`, `example_target`, `example_native`, `forward`/`reverse`, the pair limit and the new autofill body; verify all existing e2e tests pass
- [ ] 6.2 Setup flow: native Russian hides Russian from targets, changing native clears the target, creating `fr`/`ru` lands on Home with French copy; verify the test passes
- [ ] 6.3 Second pair isolation: alice with `de`/`en` words adds `fr`/`en`, sees "No words yet", adds a French noun (no article field, no badge), reviews it; switches back via the sidebar and sees only German words, German due count and the French due count in the menu; the German word page id opened while French is active shows "Word not found"; verify the test passes
- [ ] 6.4 Settings: limit saved on the active pair only (the other pair's limit unchanged), "Add language" for an existing pair makes it active without a second pair; verify the test passes
- [ ] 6.5 Russian native flow with stubbed AI: `de`/`ru` pair, stubbed senses in Russian fill the form, save, review a forward card typing the Russian translation with ё typed as е (correct), practice shows a stubbed Russian issue message; verify the test passes
- [ ] 6.6 Run the full suite: `npm test`, integration tests and `npm run build`; verify all green and a grep over `src`, `supabase`, `tests`, `scripts` for `hint_en|example_de|example_en|de_en|en_de|is_german_word` is empty

## 7. AI quality cases

- [ ] 7.1 Restructure `scripts/autofill-quality.mjs` into sets per pair: the current `de`→`en` cases unchanged, plus `de`→`ru`, `en`→`ru`, `fr`→`en`, `ru`→`en` and one `→en` set per other target (ambiguous word, misspelling, word of another language, non-word); the script upserts alice's pairs it needs and sends `pair_id`; checks empty forms for generic targets and Cyrillic translations for Russian natives; verify `node --check` passes and a dry listing of cases prints every set (no model calls)
- [ ] 7.2 Remove from the supported list any target whose set is not ready, so only targets with sets are offered; verify the languages unit test and the list agree
- [ ] 7.3 (Maks) Run `npm run test:ai` against the locally served function; keep a target in the list only if its set passes; report failures for prompt tuning

## 8. Docs

- [x] 8.1 Hand Maks the "Proposed doc updates" from design.md (SPEC.md §1 to §8, CLAUDE.md lines); apply them only after his approval; verify Maks has approved before any edit to SPEC.md or CLAUDE.md
- [ ] 8.2 At archive, update the Purpose lines that still say German in `openspec/specs/` (language-setup, word-entry, ai-autofill, sentence-check, sentence-practice, word-detail) and note that the `review-queue` requirement header "New en_de cards" keeps its old name; verify `openspec validate --strict` passes after archive
