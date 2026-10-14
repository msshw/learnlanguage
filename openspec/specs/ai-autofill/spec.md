# ai-autofill Specification

## Purpose
Suggests the details of a word in the pair's target language from the term alone, with translations in the native language: an edge function calls the model with a structured schema, validates the result in code, logs every call, and stops at a monthly spending cap. Every failure falls back to manual entry on the client.

## Requirements

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

### Requirement: Call logging
Every model call SHALL write one `ai_calls` row with the user, kind `autofill`, model ID, input tokens, output tokens, latency in milliseconds and whether it produced usable output, plus error text when it did not. Input tokens SHALL include cache-read and cache-write input tokens. A provider failure SHALL be logged with zero tokens. Calls that do not reach the model (rejected requests, `over_cap`) SHALL NOT write a row.

#### Scenario: Successful call
- **WHEN** a call succeeds
- **THEN** one row exists with `ok` true and non-zero token counts

#### Scenario: Provider failure
- **WHEN** the provider returns an error
- **THEN** one row exists with `ok` false, an error text, and status `error` is returned

#### Scenario: Over the cap
- **WHEN** the cap is reached
- **THEN** no row is written

### Requirement: Monthly spending cap
Before calling the model the function SHALL compute this calendar month's (UTC) cost from all of the user's `ai_calls` rows, of every kind (`autofill` and `sentence_check`), using per-token prices from one configuration constant shared by all AI edge functions. At $2.00 or more it SHALL return status `over_cap` without calling the model. Below $2.00 it SHALL proceed. The cost of failed calls with tokens SHALL count. The usage request SHALL report the same total.

#### Scenario: Under the cap
- **WHEN** the month's cost is $1.99
- **THEN** the model is called

#### Scenario: At the cap
- **WHEN** the month's cost is $2.00
- **THEN** status is `over_cap` and the model is not called

#### Scenario: Sentence checks count
- **WHEN** the month's autofill calls cost $1.50 and sentence checks cost $0.50
- **THEN** an autofill request returns `over_cap` and the usage request reports $2.00

#### Scenario: New month
- **WHEN** the month changes
- **THEN** earlier months' calls no longer count

#### Scenario: Other users do not count
- **WHEN** another user has spent $2.00 this month
- **THEN** the current user is not capped

### Requirement: Client fallbacks
The client SHALL send the request with a timeout of 8 seconds. Timeout, network failure, any HTTP failure, status `error`, status `over_cap` and an unreadable response SHALL each end in the manual form with the message "Suggestions unavailable". The client SHALL NOT retry. Status `not_a_word` SHALL be shown as described in word-entry.

#### Scenario: Function stopped
- **WHEN** the function is not running
- **THEN** within 8 seconds the empty manual form is shown with "Suggestions unavailable"

#### Scenario: Over cap
- **WHEN** status is `over_cap`
- **THEN** the empty manual form is shown with "Suggestions unavailable"

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

### Requirement: Usage request
The `autofill` function SHALL answer a POST with a valid session and the body `{action: "usage"}` with `{status: "ok", spent_usd, cap_usd}`, where `spent_usd` is the caller's cost this calendar month (UTC), computed exactly as for the spending cap, and `cap_usd` is the monthly cap. It SHALL NOT call the model and SHALL NOT write an `ai_calls` row. It SHALL NOT apply the term and language checks of suggestion requests. Without a valid session it SHALL be rejected. If the spend cannot be read it SHALL answer `{status: "error"}`.

#### Scenario: Usage returned
- **WHEN** the user's calls this month cost $0.50
- **THEN** the response is `{status: "ok", spent_usd: 0.5, cap_usd: 2}`

#### Scenario: No model call
- **WHEN** a usage request is made
- **THEN** no model call happens and `ai_calls` has no new row

#### Scenario: Other users do not count
- **WHEN** another user has spent $1.00 this month
- **THEN** the caller's `spent_usd` does not include it

#### Scenario: No session
- **WHEN** a usage request has no valid session
- **THEN** it is rejected

#### Scenario: Spend unreadable
- **WHEN** reading the month's usage fails
- **THEN** the response is `{status: "error"}`

### Requirement: Cache hits skip the model and the cap
After the input and session checks and before the spending cap check, the function SHALL look for a record with at least one confirmed sense as described in ai-suggestion-cache. On a hit it SHALL return the record's senses that are not rejected (confirmed and candidate) with status `ok` without calling the model and without writing an `ai_calls` row, also when the user is at or over the monthly cap. If the lookup itself fails, the function SHALL continue as on a miss.

#### Scenario: Hit writes no row
- **WHEN** a request is answered from a record with a confirmed sense
- **THEN** no `ai_calls` row is written and the month's cost is unchanged

#### Scenario: Hit while over the cap
- **WHEN** the user's month cost is $2.00 and a record with a confirmed sense matches
- **THEN** status is `ok` with the stored senses that are not rejected

#### Scenario: Miss while over the cap
- **WHEN** the user's month cost is $2.00 and no record with a confirmed sense matches
- **THEN** status is `over_cap` and the model is not called

#### Scenario: Lookup fails
- **WHEN** reading the store fails
- **THEN** the cap is checked and the model is called as on a miss

### Requirement: Confirm request
The `autofill` function SHALL answer a POST with a valid session and the body `{action: "confirm", suggestion_id, sense_index}` by changing that one sense of that suggestion from candidate to confirmed, and SHALL respond `{status: "ok"}`. `sense_index` SHALL be a whole number naming one of the suggestion's stored senses. Other senses SHALL keep their state. Any other field in the body SHALL be ignored, and the stored sense content SHALL NOT change. Confirming an already confirmed sense SHALL succeed and change nothing. A rejected sense SHALL NOT be confirmable: the response SHALL be `{status: "error"}` and nothing changes. An unknown id, a malformed id or an out-of-range index SHALL be answered `{status: "error"}` and change nothing. The request SHALL NOT call the model, SHALL NOT write an `ai_calls` row and SHALL NOT apply the term checks. Without a valid session it SHALL be rejected.

#### Scenario: Confirm a candidate
- **WHEN** alice sends a confirm for a record with two candidate senses with `sense_index` 1
- **THEN** sense 1 is confirmed, sense 0 is still a candidate, and the response is `{status: "ok"}`

#### Scenario: Content in the body is ignored
- **WHEN** a confirm body also carries a `senses` field with other text
- **THEN** the stored senses are unchanged

#### Scenario: Out of range
- **WHEN** a confirm names `sense_index` 3 for a suggestion with two senses
- **THEN** the response is `{status: "error"}` and nothing changes

#### Scenario: Rejected sense
- **WHEN** a confirm names a rejected sense
- **THEN** the response is `{status: "error"}` and the sense stays rejected

#### Scenario: No session
- **WHEN** a confirm has no valid session
- **THEN** it is rejected and nothing changes

### Requirement: Rejected senses in the prompt and the result
On a cache miss the function SHALL read the rejected senses stored for the request's lookup key. When there are any, it SHALL add them to the user message as senses not to suggest (part of speech and translations, one line each, at most 10). After validation it SHALL drop every sense whose fingerprint matches a rejected one, as described in ai-suggestion-cache. If the first attempt leaves no sense because all were dropped, the function SHALL retry once, as for a validation failure, with the rejected senses repeated more strongly in the user message (an explicit instruction that these exact meanings must not appear, placed before and after the request). This is the same two-attempt loop that already exists: a validation failure and an all-rejected result share the two attempts, never more than two model calls per request. If the second attempt also leaves no sense, the function SHALL respond with status `error` and no senses, the same response as when the model is unavailable, which the client shows as the manual form with "Suggestions unavailable"; no new status or message is added. Nothing is stored in that case. Each attempt whose senses were all dropped SHALL be logged in `ai_calls` with `ok` false, its real tokens and the error text "all senses rejected", and SHALL count toward the monthly cap like any other call. If the rejected senses cannot be read, the function SHALL continue without them and skip the filter.

#### Scenario: Avoid list sent
- **WHEN** `Bank` has one rejected sense and the model is called
- **THEN** the user message lists that sense as not to be suggested

#### Scenario: Retry after all rejected
- **WHEN** the first attempt returns only a rejected sense and the second returns another valid sense
- **THEN** the second attempt's user message repeats the rejected senses more strongly, the other sense is stored and returned, and two `ai_calls` rows exist, the first with `ok` false and error "all senses rejected"

#### Scenario: Still nothing left
- **WHEN** both attempts return only rejected senses
- **THEN** status is `error` with no senses, no record is stored, and two `ai_calls` rows exist, both `ok` false with error "all senses rejected"

#### Scenario: Both attempts count toward the cap
- **WHEN** both attempts were all rejected and used 1000 tokens each
- **THEN** the month's cost includes both calls

#### Scenario: Client fallback
- **WHEN** the response is status `error` after two all-rejected attempts
- **THEN** the empty manual form is shown with "Suggestions unavailable"

#### Scenario: Rejected list unreadable
- **WHEN** reading the rejected senses fails
- **THEN** the model is called without an avoid list and the filter is skipped

### Requirement: Prompts in the pair's languages
The system prompt and the output schema SHALL be built from the pair: both language names from the supported list are inserted into the prompt, the learner is described as a speaker of the native language learning the target language, and translations, hint and example translation are asked for in the native language. Rules that belong to German (articles, plural, verb forms, umlaut correction) SHALL be part of the German profile only and SHALL NOT appear in the prompt for another target. The output schema SHALL carry the forms of the target's profile only. For the `de`/`en` pair the prompt SHALL keep the rules of the current prompt.

#### Scenario: French pair prompt
- **WHEN** the model is called for a `fr`/`ru` pair
- **THEN** the system prompt names French and Russian and contains no rule about der, die or das

#### Scenario: German pair prompt
- **WHEN** the model is called for a `de`/`en` pair
- **THEN** the system prompt asks for article and plural for nouns and Präteritum, Partizip II, auxiliary and separable prefix for verbs
