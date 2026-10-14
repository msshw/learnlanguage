## MODIFIED Requirements

### Requirement: Autofill endpoint
The `autofill` function SHALL accept a POST with the caller's session token and a JSON body `{term, pair_id}` and respond with `{status, senses, suggestion_id, confirmed}`. `pair_id` SHALL name a language pair that belongs to the caller; the function SHALL read the pair's target and native language from the database, SHALL accept them only when the pair is allowed by the supported language list (see language-profiles), and SHALL ignore any language fields in the body. `status` SHALL be one of `ok`, `not_a_word`, `over_cap` or `error`. `senses` SHALL hold 1 to 3 items when `status` is `ok` and be empty otherwise. Each sense SHALL carry, besides its content, `index` (its position in the stored record, counting rejected senses) and `state` (`candidate` or `confirmed`); rejected senses SHALL NOT be returned. When `status` is `ok`, `suggestion_id` SHALL be the id of the stored suggestion the senses came from or were stored as (null if storing failed), and `confirmed` SHALL be true when the answer came from the cache (the record has a confirmed sense) and false otherwise. For senses without a stored record `index` SHALL be their position in the answer and `state` `candidate`. For other statuses `suggestion_id` SHALL be null and `confirmed` false. A request without a valid session SHALL be rejected and SHALL NOT call the model. A body that is not valid JSON, has a `term` that is empty after trimming, longer than 80 characters or containing control characters, has a `pair_id` that is malformed, unknown or another user's, or names a pair whose languages the list does not allow SHALL be rejected with a client error and SHALL NOT call the model or write to `ai_calls`.

#### Scenario: Valid request
- **WHEN** a signed-in user posts `{term: "Bank", pair_id: <their de/en pair>}`
- **THEN** the response has status `ok`, one to three senses and a `suggestion_id`

#### Scenario: Fresh senses
- **WHEN** no matching record has a confirmed sense and the model answers
- **THEN** `confirmed` is false, every sense has state `candidate` and `suggestion_id` names the new record

#### Scenario: Cached senses
- **WHEN** a record with a confirmed sense matches
- **THEN** `confirmed` is true, `suggestion_id` names that record and each sense carries its state and stored index

#### Scenario: Index after a rejection
- **WHEN** the matching record has senses confirmed, rejected, candidate
- **THEN** the response has two senses with indexes 0 and 2

#### Scenario: No session
- **WHEN** a request arrives without a valid session token
- **THEN** it is rejected and the model is not called

#### Scenario: Bad input
- **WHEN** the term is empty, longer than 80 characters or contains a control character
- **THEN** a client error is returned and the model is not called

#### Scenario: Another user's pair
- **WHEN** bob posts a term with alice's `pair_id`
- **THEN** a client error is returned, the model is not called and no `ai_calls` row is written

#### Scenario: Unsupported pair
- **WHEN** the caller's own pair has target `xx` or the same target and native language
- **THEN** a client error is returned and the model is not called

#### Scenario: Language fields ignored
- **WHEN** the body carries `pair_id` of the caller's `de`/`en` pair and also `target_lang: "fr"`
- **THEN** the lookup and the prompt use German and English

### Requirement: Sense content
Each sense SHALL have `term` (in the target language, in corrected spelling and capitalization, without article), `part_of_speech` (noun, verb, adjective, adverb, phrase or other), 1 to 3 short `translations` in the native language, `hint_native` in the native language of at most 4 words that tells this sense apart from other target-language words with the same translation, `forms`, `example_target` (a target-language sentence) of at most 12 words and `example_native` (its translation into the native language). Senses SHALL be the most common first and limited to common meanings. `forms` SHALL follow the profile of the pair's target language: with the German profile, a noun SHALL hold only `article` (der, die or das) and `plural`, a verb only `praeteritum` (third person singular), `partizip2`, `auxiliary` (haben or sein) and `separable_prefix`, and other parts of speech no forms; with the generic profile `forms` SHALL always be empty.

#### Scenario: Ambiguous noun
- **WHEN** the term is `Bank` for a `de`/`en` pair
- **THEN** the senses include a money sense and a seat sense, each with article `die` and its own plural, translation, hint and example

#### Scenario: Corrected spelling
- **WHEN** the term is `madchen` for a `de`/`en` pair
- **THEN** the sense term is `Mädchen`

#### Scenario: Separable verb
- **WHEN** the term is `anrufen` for a `de`/`en` pair
- **THEN** the sense has part of speech `verb`, separable prefix `an`, auxiliary `haben`

#### Scenario: Russian native
- **WHEN** the term is `Bank` for a `de`/`ru` pair
- **THEN** the translations, the hint and `example_native` are in Russian and `example_target` is in German

#### Scenario: Generic target
- **WHEN** the term is `maison` for a `fr`/`en` pair
- **THEN** the sense has `forms` `{}`, English translations and a French `example_target`

### Requirement: Output validation
The function SHALL validate every model result in code before returning it, with the profile of the pair's target language: required fields present, part of speech from the allowed list, `forms` keys matching the part of speech in that profile (none for the generic profile), noun article from the profile's articles, auxiliary from haben or sein for German, string lengths within limits, translations and hint within the counts above. An invalid result, a result cut off by the token cap, or a refusal SHALL be retried once. If the retry also fails, the function SHALL return status `error`.

#### Scenario: Invalid then valid
- **WHEN** the first model result has a German noun without an article and the second is valid
- **THEN** status is `ok` and two `ai_calls` rows exist

#### Scenario: Invalid twice
- **WHEN** both model results are invalid
- **THEN** status is `error`, no senses are returned, and both calls are logged

#### Scenario: Cut-off result
- **WHEN** the model stops at the token cap
- **THEN** the result counts as invalid

#### Scenario: Forms on a generic target
- **WHEN** the model returns an article for a noun of a `fr`/`en` pair
- **THEN** the result is invalid

### Requirement: Not a word
When the model decides that the input is not a word or phrase of the pair's target language, the function SHALL return status `not_a_word` with no senses.

#### Scenario: English word
- **WHEN** the term is `table` for a `de`/`en` pair
- **THEN** status is `not_a_word`

#### Scenario: German word for a French pair
- **WHEN** the term is `Haus` for a `fr`/`en` pair
- **THEN** status is `not_a_word`

### Requirement: Quality test set
A script SHALL run sets of words and phrases against the locally served function, one set per language pair, covering at least `de`→`en`, `de`→`ru`, `en`→`ru`, `fr`→`en` and `ru`→`en`, and at least one set (with English as native language) for every other target language in the supported list. The `de`→`en` set SHALL keep the current cases (ambiguous nouns, separable verbs, verbs with sein, irregular plurals, misspellings, non-words and English words); every other set SHALL hold at least an ambiguous word, a misspelling, a word of another language and a non-word. The script SHALL check fields automatically, including that generic targets return empty forms and that translations are in the native language's script where that differs (Cyrillic for Russian), report each failed check by pair and word, print senses and hints for review by eye, and exit non-zero when an automatic check fails. A target language SHALL be offered in Setup and Settings only after its sets pass; until then it SHALL stay out of the supported list. The script SHALL be run by Maks, not by agents, since it costs money.

#### Scenario: All checks pass
- **WHEN** the script runs and every automatic check passes
- **THEN** it exits with code 0 and prints the senses

#### Scenario: A check fails
- **WHEN** `Haus` comes back with plural `Haus` for `de`→`en`
- **THEN** the script names the pair, the word and the failed check, and exits non-zero

#### Scenario: Wrong translation language
- **WHEN** a `de`→`ru` sense comes back with Latin-script translations
- **THEN** the script reports the failed check and exits non-zero

## ADDED Requirements

### Requirement: Prompts in the pair's languages
The system prompt and the output schema SHALL be built from the pair: both language names from the supported list are inserted into the prompt, the learner is described as a speaker of the native language learning the target language, and translations, hint and example translation are asked for in the native language. Rules that belong to German (articles, plural, verb forms, umlaut correction) SHALL be part of the German profile only and SHALL NOT appear in the prompt for another target. The output schema SHALL carry the forms of the target's profile only. For the `de`/`en` pair the prompt SHALL keep the rules of the current prompt.

#### Scenario: French pair prompt
- **WHEN** the model is called for a `fr`/`ru` pair
- **THEN** the system prompt names French and Russian and contains no rule about der, die or das

#### Scenario: German pair prompt
- **WHEN** the model is called for a `de`/`en` pair
- **THEN** the system prompt asks for article and plural for nouns and Präteritum, Partizip II, auxiliary and separable prefix for verbs
