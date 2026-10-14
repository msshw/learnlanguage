## MODIFIED Requirements

### Requirement: Check endpoint
The `check-sentence` function SHALL accept a POST with the caller's session token and a JSON body `{word_id, sentence}` and respond with `{status, corrected, uses_word, issues}`. `status` SHALL be one of `ok`, `over_cap` or `error`. `word_id` SHALL name an active word of the caller; the function SHALL read the word's term, part of speech, translations and hint, and the target and native language of the word's pair, itself from the database, and SHALL NOT accept word content or languages from the request. The word's pair SHALL be allowed by the supported language list (see language-profiles). `sentence` SHALL be at most 300 characters after trimming, not empty, and without control characters. A request without a valid session SHALL be rejected. A body that is not valid JSON, a bad sentence, a `word_id` that is malformed, unknown, deleted or another user's, or a word whose pair the list does not allow SHALL be rejected with a client error. Rejected requests SHALL NOT call the model or write to `ai_calls`. When `status` is not `ok`, `corrected` SHALL be null, `uses_word` false and `issues` empty.

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

#### Scenario: Languages from the word's pair
- **WHEN** alice posts the id of a word of her `fr`/`ru` pair with a body that also carries `target_lang: "de"`
- **THEN** the sentence is checked as French and the messages are in Russian

#### Scenario: Unsupported pair
- **WHEN** the word belongs to the caller's pair with target `xx`
- **THEN** a client error is returned and the model is not called

### Requirement: Check content
With status `ok`: `corrected` SHALL be the full sentence with grammar, spelling and word-choice errors fixed, equal to the input when there are none. `uses_word` SHALL be true when the sentence uses the word, in any inflected form, in the sense given by its translations. `issues` SHALL hold 0 to 5 items ordered by position, each `{start, end, message}`: `start` and `end` are character offsets into the submitted sentence (as trimmed), counted in UTF-16 code units with `end` exclusive, `start < end`, and no two issues overlap. `message` SHALL be a short explanation of at most 25 words in the native language of the word's pair. The sentence SHALL be checked as a sentence in the pair's target language, and the prompt SHALL name both languages.

#### Scenario: Wrong case after preposition
- **WHEN** the sentence is `Ich gehe zu die Bank.`
- **THEN** `corrected` is `Ich gehe zur Bank.` and one issue covers `zu die`

#### Scenario: Correct sentence
- **WHEN** the sentence is `Ich sitze auf der Bank.` for the word `Bank` (bench)
- **THEN** `corrected` equals the sentence, `uses_word` is true and `issues` is empty

#### Scenario: Word missing
- **WHEN** the sentence for `Bank` is `Ich gehe nach Hause.`
- **THEN** `uses_word` is false

#### Scenario: Russian messages
- **WHEN** the word belongs to a `de`/`ru` pair and the sentence has an error
- **THEN** the issue message is in Russian
