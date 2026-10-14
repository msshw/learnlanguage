## ADDED Requirements

### Requirement: Autofill endpoint
The `autofill` function SHALL accept a POST with the caller's session token and a JSON body `{term, target_lang, native_lang}` and respond with `{status, senses}`. `status` SHALL be one of `ok`, `not_a_word`, `over_cap` or `error`. `senses` SHALL hold 1 to 3 items when `status` is `ok` and be empty otherwise. A request without a valid session SHALL be rejected and SHALL NOT call the model. A body that is not valid JSON, has a `term` that is empty after trimming, longer than 80 characters or containing control characters, or has languages other than `de` and `en` SHALL be rejected with a client error and SHALL NOT call the model or write to `ai_calls`.

#### Scenario: Valid request
- **WHEN** a signed-in user posts `{term: "Bank", target_lang: "de", native_lang: "en"}`
- **THEN** the response has status `ok` and one to three senses

#### Scenario: No session
- **WHEN** a request arrives without a valid session token
- **THEN** it is rejected and the model is not called

#### Scenario: Bad input
- **WHEN** the term is empty, longer than 80 characters or contains a control character
- **THEN** a client error is returned and the model is not called

### Requirement: Sense content
Each sense SHALL have `term` (in corrected spelling and capitalization, without article), `part_of_speech` (noun, verb, adjective, adverb, phrase or other), 1 to 3 short English `translations`, `hint_en` of at most 4 words that tells this sense apart from other German words with the same translation, `forms`, `example_de` of at most 12 words and `example_en`. Senses SHALL be the most common first and limited to common meanings. For a noun `forms` SHALL hold only `article` (der, die or das) and `plural`. For a verb it SHALL hold only `praeteritum` (third person singular), `partizip2`, `auxiliary` (haben or sein) and `separable_prefix`. For other parts of speech `forms` SHALL be empty.

#### Scenario: Ambiguous noun
- **WHEN** the term is `Bank`
- **THEN** the senses include a money sense and a seat sense, each with article `die` and its own plural, translation, hint and example

#### Scenario: Corrected spelling
- **WHEN** the term is `madchen`
- **THEN** the sense term is `Mädchen`

#### Scenario: Separable verb
- **WHEN** the term is `anrufen`
- **THEN** the sense has part of speech `verb`, separable prefix `an`, auxiliary `haben`

### Requirement: Output validation
The function SHALL validate every model result in code before returning it: required fields present, part of speech from the allowed list, `forms` keys matching the part of speech, noun article from der, die or das, auxiliary from haben or sein, string lengths within limits, translations and hint within the counts above. An invalid result, a result cut off by the token cap, or a refusal SHALL be retried once. If the retry also fails, the function SHALL return status `error`.

#### Scenario: Invalid then valid
- **WHEN** the first model result has a noun without an article and the second is valid
- **THEN** status is `ok` and two `ai_calls` rows exist

#### Scenario: Invalid twice
- **WHEN** both model results are invalid
- **THEN** status is `error`, no senses are returned, and both calls are logged

#### Scenario: Cut-off result
- **WHEN** the model stops at the token cap
- **THEN** the result counts as invalid

### Requirement: Not a word
When the model decides that the input is not a German word or phrase, the function SHALL return status `not_a_word` with no senses.

#### Scenario: English word
- **WHEN** the term is `table`
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
Before calling the model the function SHALL compute this calendar month's (UTC) cost from the user's `ai_calls` rows, using per-token prices from one configuration constant. At $2.00 or more it SHALL return status `over_cap` without calling the model. Below $2.00 it SHALL proceed. The cost of failed calls with tokens SHALL count.

#### Scenario: Under the cap
- **WHEN** the month's cost is $1.99
- **THEN** the model is called

#### Scenario: At the cap
- **WHEN** the month's cost is $2.00
- **THEN** status is `over_cap` and the model is not called

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
A script SHALL run a set of about 20 German words and phrases (ambiguous nouns, separable verbs, verbs with sein, irregular plurals, misspellings, non-words and English words) against the locally served function. It SHALL check fields automatically, report each failed check by word, print senses and hints for review by eye, and exit non-zero when an automatic check fails.

#### Scenario: All checks pass
- **WHEN** the script runs and every automatic check passes
- **THEN** it exits with code 0 and prints the senses

#### Scenario: A check fails
- **WHEN** `Haus` comes back with plural `Haus`
- **THEN** the script names the word and the failed check, and exits non-zero
