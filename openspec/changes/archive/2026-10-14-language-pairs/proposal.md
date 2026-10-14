## Why

The app is fixed to German learned from English: the pair is hard-coded in the AI functions, the setup page, the schema (`de_en`, `hint_en`, `example_en`) and the grader. Other users should be able to pick their own native language and any supported language to learn, and one user should be able to learn more than one language.

## What Changes

- A config list of supported languages with their English names: native languages English (`en`) and Russian (`ru`); targets German, French, Spanish, Italian, Portuguese, Dutch, Polish, Czech, Ukrainian, Russian and English. Any target pairs with any native language except itself. The functions accept only pairs allowed by the list.
- Setup asks for the native language, then the target language. Settings gets "Add language", which creates another pair. A pair switcher at the top of the sidebar changes the active pair; every screen shows the active pair only.
- The daily new-word limit moves from the profile to each language pair. Timezone and the $2 monthly AI cap stay per account.
- AI calls (autofill, check-sentence) take the pair from the caller's own language pair, never from free text. Prompts receive both language names; translations, hints, example translations and check-sentence issue messages come back in the native language.
- Language profiles: German keeps its structured forms (article, plural, verb forms), article badges and ae/oe/ue/ss typing equivalences. Every other target uses a generic profile (no forms, generic typing normalization, Russian e/yo treated as equal), so any pair works from day one.
- **BREAKING** Renames: `hint_en` to `hint_native`, `example_de` to `example_target`, `example_en` to `example_native` (words and stored suggestion senses), card directions `de_en` / `en_de` to `forward` / `reverse`, the autofill request body to `{term, pair_id}`. One migration moves existing rows; the existing de/en pair keeps all its words and cards.
- The shared AI cache and rejected senses stay keyed per pair; records of different pairs never mix.
- The AI quality test set gets cases per pair.

## Capabilities

### New Capabilities

- `language-profiles`: the supported language list, what a language profile holds (forms, articles, typing equivalences), and language names in page copy.

### Modified Capabilities

- `language-setup`: native then target choice from the list; the first pair is created and made active.
- `settings`: pair display, "Add language", the daily limit stored per pair.
- `app-shell`: the pair switcher in the sidebar.
- `word-entry`: form fields and validation by profile, native and target names in copy, `forward` / `reverse` cards.
- `word-detail`: renamed fields and language names.
- `ai-autofill`: request names the caller's pair, prompts in the pair's languages, renamed sense fields, per-profile forms and validation, per-pair quality cases.
- `ai-suggestion-cache`: renamed keys in stored senses, records never cross pairs.
- `suggestion-moderation`: edit and approve validates with the suggestion's own profile.
- `sentence-check`: the pair comes from the word's pair in the database; messages in the native language.
- `sentence-practice`: eligibility on the `forward` card, daily new practice limit per pair.
- `answer-grading`: normalization by the language of the typed string, article check from the profile, `forward` / `reverse`.
- `review-queue`: `forward` / `reverse`, daily limit and introductions counted per pair.
- `review-session`: prompts per direction in the pair's languages.
- `data-access-control`: renamed columns and directions, per-pair limit, immutable pair languages, card trigger.
- `data-export`: language pairs in the export, format version 2.

## Impact

Large: one migration (renames, JSON rewrite of `ai_suggestions.senses`, direction values and constraint, card trigger, per-pair limit, pair column grants), both AI edge functions and the admin edit path, prompts and schemas, validators, grader, forms UI, setup, sidebar, settings, export, every test that uses the old names, the AI quality script per pair, and SPEC.md §1, §2, §3, §4, §5, §6 (proposed in design.md, applied by Maks).
