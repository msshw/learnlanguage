## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Autofill endpoint
The `autofill` function SHALL accept a POST with the caller's session token and a JSON body `{term, target_lang, native_lang}` and respond with `{status, senses, suggestion_id, confirmed}`. `status` SHALL be one of `ok`, `not_a_word`, `over_cap` or `error`. `senses` SHALL hold 1 to 3 items when `status` is `ok` and be empty otherwise. Each sense SHALL carry, besides its content, `index` (its position in the stored record, counting rejected senses) and `state` (`candidate` or `confirmed`); rejected senses SHALL NOT be returned. When `status` is `ok`, `suggestion_id` SHALL be the id of the stored suggestion the senses came from or were stored as (null if storing failed), and `confirmed` SHALL be true when the answer came from the cache (the record has a confirmed sense) and false otherwise. For senses without a stored record `index` SHALL be their position in the answer and `state` `candidate`. For other statuses `suggestion_id` SHALL be null and `confirmed` false. A request without a valid session SHALL be rejected and SHALL NOT call the model. A body that is not valid JSON, has a `term` that is empty after trimming, longer than 80 characters or containing control characters, or has languages other than `de` and `en` SHALL be rejected with a client error and SHALL NOT call the model or write to `ai_calls`.

#### Scenario: Valid request
- **WHEN** a signed-in user posts `{term: "Bank", target_lang: "de", native_lang: "en"}`
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
