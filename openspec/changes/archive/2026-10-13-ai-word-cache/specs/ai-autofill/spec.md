## MODIFIED Requirements

### Requirement: Autofill endpoint
The `autofill` function SHALL accept a POST with the caller's session token and a JSON body `{term, target_lang, native_lang}` and respond with `{status, senses, suggestion_id, confirmed}`. `status` SHALL be one of `ok`, `not_a_word`, `over_cap` or `error`. `senses` SHALL hold 1 to 3 items when `status` is `ok` and be empty otherwise. When `status` is `ok`, `suggestion_id` SHALL be the id of the stored suggestion the senses came from or were stored as (null if storing failed), and `confirmed` SHALL be true when the senses came from a confirmed suggestion and false otherwise. For other statuses `suggestion_id` SHALL be null and `confirmed` false. A request without a valid session SHALL be rejected and SHALL NOT call the model. A body that is not valid JSON, has a `term` that is empty after trimming, longer than 80 characters or containing control characters, or has languages other than `de` and `en` SHALL be rejected with a client error and SHALL NOT call the model or write to `ai_calls`.

#### Scenario: Valid request
- **WHEN** a signed-in user posts `{term: "Bank", target_lang: "de", native_lang: "en"}`
- **THEN** the response has status `ok`, one to three senses and a `suggestion_id`

#### Scenario: Fresh senses
- **WHEN** no confirmed suggestion matches and the model answers
- **THEN** `confirmed` is false and `suggestion_id` names the new candidate

#### Scenario: Cached senses
- **WHEN** a confirmed suggestion matches
- **THEN** `confirmed` is true and `suggestion_id` names that suggestion

#### Scenario: No session
- **WHEN** a request arrives without a valid session token
- **THEN** it is rejected and the model is not called

#### Scenario: Bad input
- **WHEN** the term is empty, longer than 80 characters or contains a control character
- **THEN** a client error is returned and the model is not called

## ADDED Requirements

### Requirement: Cache hits skip the model and the cap
After the input and session checks and before the spending cap check, the function SHALL look for a confirmed suggestion as described in ai-suggestion-cache. On a hit it SHALL return the stored senses with status `ok` without calling the model and without writing an `ai_calls` row, also when the user is at or over the monthly cap. If the lookup itself fails, the function SHALL continue as on a miss.

#### Scenario: Hit writes no row
- **WHEN** a request is answered from a confirmed suggestion
- **THEN** no `ai_calls` row is written and the month's cost is unchanged

#### Scenario: Hit while over the cap
- **WHEN** the user's month cost is $2.00 and a confirmed suggestion matches
- **THEN** status is `ok` with the stored senses

#### Scenario: Miss while over the cap
- **WHEN** the user's month cost is $2.00 and no confirmed suggestion matches
- **THEN** status is `over_cap` and the model is not called

#### Scenario: Lookup fails
- **WHEN** reading the store fails
- **THEN** the cap is checked and the model is called as on a miss

### Requirement: Confirm request
The `autofill` function SHALL answer a POST with a valid session and the body `{action: "confirm", suggestion_id, sense_index}` by changing that suggestion from candidate to confirmed, and SHALL respond `{status: "ok"}`. `sense_index` SHALL be a whole number naming one of the suggestion's senses. Any other field in the body SHALL be ignored, and the stored senses SHALL NOT change. Confirming an already confirmed suggestion SHALL succeed and change nothing. An unknown id, a malformed id or an out-of-range index SHALL be answered `{status: "error"}` and change nothing. The request SHALL NOT call the model, SHALL NOT write an `ai_calls` row and SHALL NOT apply the term checks. Without a valid session it SHALL be rejected.

#### Scenario: Confirm a candidate
- **WHEN** alice sends a confirm for a candidate with `sense_index` 0
- **THEN** the suggestion is confirmed and the response is `{status: "ok"}`

#### Scenario: Content in the body is ignored
- **WHEN** a confirm body also carries a `senses` field with other text
- **THEN** the stored senses are unchanged

#### Scenario: Out of range
- **WHEN** a confirm names `sense_index` 3 for a suggestion with two senses
- **THEN** the response is `{status: "error"}` and the suggestion stays a candidate

#### Scenario: No session
- **WHEN** a confirm has no valid session
- **THEN** it is rejected and nothing changes
