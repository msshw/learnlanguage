## Purpose

Defines the `check-sentence` edge function: it checks a German sentence the user wrote with one of their words and returns a corrected sentence and located issues, with the same logging, spending cap and fallbacks as autofill.

## ADDED Requirements

### Requirement: Check endpoint
The `check-sentence` function SHALL accept a POST with the caller's session token and a JSON body `{word_id, sentence}` and respond with `{status, corrected, uses_word, issues}`. `status` SHALL be one of `ok`, `over_cap` or `error`. `word_id` SHALL name an active word of the caller; the function SHALL read the word's term, part of speech, translations and hint itself and SHALL NOT accept word content from the request. `sentence` SHALL be at most 300 characters after trimming, not empty, and without control characters. A request without a valid session SHALL be rejected. A body that is not valid JSON, a bad sentence, or a `word_id` that is malformed, unknown, deleted or another user's SHALL be rejected with a client error. Rejected requests SHALL NOT call the model or write to `ai_calls`. When `status` is not `ok`, `corrected` SHALL be null, `uses_word` false and `issues` empty.

#### Scenario: Valid request
- **WHEN** alice posts her word id for `Bank` and `Ich gehe zu die Bank.`
- **THEN** the response has status `ok`, a corrected sentence, `uses_word` and a list of issues

#### Scenario: Another user's word
- **WHEN** bob posts alice's word id
- **THEN** a client error is returned and the model is not called

#### Scenario: Too long
- **WHEN** the sentence has 301 characters after trimming
- **THEN** a client error is returned and the model is not called

#### Scenario: No session
- **WHEN** a request arrives without a valid session token
- **THEN** it is rejected and the model is not called

### Requirement: Check content
With status `ok`: `corrected` SHALL be the full sentence with grammar, spelling and word-choice errors fixed, equal to the input when there are none. `uses_word` SHALL be true when the sentence uses the word, in any inflected form, in the sense given by its translations. `issues` SHALL hold 0 to 5 items ordered by position, each `{start, end, message}`: `start` and `end` are character offsets into the submitted sentence (as trimmed), counted in UTF-16 code units with `end` exclusive, `start < end`, and no two issues overlap. `message` SHALL be a short English explanation of at most 25 words.

#### Scenario: Wrong case after preposition
- **WHEN** the sentence is `Ich gehe zu die Bank.`
- **THEN** `corrected` is `Ich gehe zur Bank.` and one issue covers `zu die`

#### Scenario: Correct sentence
- **WHEN** the sentence is `Ich sitze auf der Bank.` for the word `Bank` (bench)
- **THEN** `corrected` equals the sentence, `uses_word` is true and `issues` is empty

#### Scenario: Word missing
- **WHEN** the sentence for `Bank` is `Ich gehe nach Hause.`
- **THEN** `uses_word` is false

### Requirement: Check output validation
The function SHALL validate every model result in code before returning it: required fields present, `corrected` a non-empty string of at most 400 characters, at most 5 issues, messages within the limit, and every issue located in the submitted sentence. The model SHALL point to each issue by quoting the exact text it covers; the function SHALL compute `start` and `end` from that text, taking the first occurrence that does not overlap an issue already placed. A quote that cannot be placed, a result cut off by the token cap, or a refusal SHALL count as invalid and be retried once. If the retry also fails, the function SHALL return status `error`.

#### Scenario: Quote not in the sentence
- **WHEN** the model quotes `zu der` but the sentence contains `zu die`
- **THEN** the result is invalid and the model is called once more

#### Scenario: Same text twice
- **WHEN** the sentence contains `die` twice and the model reports two issues quoting `die`
- **THEN** the two issues cover the first and the second `die`

#### Scenario: Invalid twice
- **WHEN** both model results are invalid
- **THEN** status is `error` and both calls are logged

### Requirement: Check logging and cap
Every model call SHALL write one `ai_calls` row as autofill calls do, with kind `sentence_check`. Before calling the model the function SHALL apply the same monthly spending cap as autofill, over the user's calls of every kind, and return `over_cap` without calling the model at $2.00 or more. Model ID and prices SHALL come from the same configuration as autofill.

#### Scenario: Logged with its kind
- **WHEN** a sentence check succeeds
- **THEN** one `ai_calls` row with kind `sentence_check` and `ok` true exists

#### Scenario: Shared cap
- **WHEN** the user's autofill calls this month cost $2.00
- **THEN** a sentence check returns `over_cap` and the model is not called

### Requirement: Check client fallbacks
The client SHALL send the check with a timeout of 10 seconds and SHALL NOT retry. Timeout, network failure, any HTTP failure, status `error`, status `over_cap` and an unreadable or out-of-range response (offsets outside the sentence, overlapping issues) SHALL each be treated as "Check unavailable" as described in sentence-practice.

#### Scenario: Function stopped
- **WHEN** the function is not running
- **THEN** within 10 seconds the feedback step shows "Check unavailable"

#### Scenario: Bad offsets
- **WHEN** a response has an issue ending after the end of the sentence
- **THEN** the feedback step shows "Check unavailable"
