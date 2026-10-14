# ai-suggestion-cache Specification

## Purpose
Shares confirmed AI suggestions between users, so a word that someone already added from an unchanged suggestion is answered from storage instead of a new model call, without letting any client write suggestion content.

## Requirements

### Requirement: Suggestion store
The system SHALL keep AI suggestions in one shared store. Each record SHALL hold the language pair, the lookup key of the entered term, the lookup key of the corrected term (the first sense's `term`), the full validated list of 1 to 3 senses, the model ID, and its creation time. Each sense in the list SHALL carry a state of `candidate`, `confirmed` or `rejected` and a `judged` flag that is true only when an admin has approved or edited it (a rejected sense counts as judged by its state); the flag is set only by admin moderation, never by a user's confirm, and is absent or false on new senses. A record SHALL be called confirmed when at least one of its senses is confirmed; that fact and the time of the latest confirmation SHALL be kept on the record for lookup. A record SHALL NOT belong to any user and SHALL NOT name the user who caused it. A lookup key SHALL be the term trimmed, with inner runs of spaces collapsed to one, and lowercased. Only `ok` results SHALL be stored, with every sense a candidate; `not_a_word` and failures SHALL NOT be stored. Sense content SHALL NOT change after storing, except by an admin edit.

#### Scenario: Keys from a misspelling
- **WHEN** a lookup for `  madchen ` returns senses with term `Mädchen` and is stored
- **THEN** the record's keys are `madchen` and `mädchen`

#### Scenario: New record senses
- **WHEN** a lookup is stored
- **THEN** every sense of the record is a candidate

#### Scenario: Not a word is not stored
- **WHEN** the model returns `not_a_word` for `table`
- **THEN** no record is stored

#### Scenario: No owner recorded
- **WHEN** alice's lookup creates a record
- **THEN** the record holds no reference to alice

### Requirement: Lookup uses confirmed records only
A suggestion request SHALL be answered from a record of the same language pair whose entered-term key or corrected-term key equals the request's lookup key and which has at least one confirmed sense. When several match, the one most recently confirmed SHALL be used. The answer SHALL contain all senses that are not rejected, in stored order, each with its state and its position in the stored list; unverified (candidate) senses of such a record are included so that users see every meaning. A record with no confirmed sense SHALL never be returned. A record whose senses are all rejected is a miss.

#### Scenario: Hit on the entered term
- **WHEN** a record for `bank` with one confirmed and one candidate sense exists and bob requests `Bank`
- **THEN** bob gets both senses, with their states, and no model call is made

#### Scenario: Hit on the corrected term
- **WHEN** a record has entered key `madchen` and corrected key `mädchen` with a confirmed sense, and bob requests `Mädchen`
- **THEN** bob gets that record's senses

#### Scenario: Case and spaces ignored
- **WHEN** a record for `guten morgen` with a confirmed sense exists and bob requests `Guten   Morgen `
- **THEN** bob gets that record's senses

#### Scenario: Rejected sense left out
- **WHEN** a matching record has senses confirmed, rejected and candidate
- **THEN** bob gets the confirmed and the candidate sense, with their stored positions 0 and 2

#### Scenario: Candidate not served
- **WHEN** only a record with candidate senses exists for `bank` and bob requests `Bank`
- **THEN** the model is called

#### Scenario: All rejected
- **WHEN** every sense of the matching record is rejected
- **THEN** the lookup is a miss and the model is called

### Requirement: Miss creates a candidate
When no record matches and the model returns a valid `ok` result, the system SHALL drop senses that match a rejected sense (see "Rejected senses are never suggested again"), store the remaining senses as a new record with every sense a candidate, and return its id with the senses. If storing fails, the senses SHALL still be returned, without an id.

#### Scenario: Miss
- **WHEN** no record for `Schloss` exists and alice requests it
- **THEN** the model is called, a record with candidate senses is stored, and alice gets the senses with the record's id

#### Scenario: Store fails
- **WHEN** storing the record fails
- **THEN** alice gets the senses without an id and can save as usual

#### Scenario: Miss after a removal
- **WHEN** all senses of the `Bank` record were rejected and bob requests `Bank`
- **THEN** the model is called with the rejected senses listed and the filtered result becomes a new record

### Requirement: Confirmation by an unchanged save
After a word is saved, the client SHALL send a confirm request with only the suggestion id and the stored position of the picked sense, and only when all of these hold: the picked sense is a candidate (not confirmed), a sense was picked, and the saved term, part of speech, translations, hint, forms and examples equal that sense's values after the form's normal cleanup. Notes and tags SHALL NOT count as changes. The client SHALL NOT send any suggestion content with a confirm. A confirm SHALL change only the picked sense from candidate to confirmed and SHALL NOT set its judged flag; other senses keep their state. Saving the word SHALL NOT depend on the confirm: a failed confirm SHALL be ignored by the page. A save with edited values SHALL change only the user's own word.

#### Scenario: Unchanged pick confirms
- **WHEN** alice picks sense 2 of a record with two candidate senses and saves without changes
- **THEN** a confirm with the record id and position 1 is sent, sense 2 becomes confirmed and sense 1 stays a candidate

#### Scenario: Unverified sense from a served record
- **WHEN** bob picks a candidate sense from a record that has another confirmed sense and saves unchanged
- **THEN** a confirm is sent for that sense

#### Scenario: Senses from a confirmed record
- **WHEN** bob saves an unchanged sense that is already confirmed
- **THEN** no confirm is sent

#### Scenario: Edited pick does not confirm
- **WHEN** alice picks a sense, changes its translation and saves
- **THEN** no confirm is sent and the sense stays a candidate

#### Scenario: Notes do not count as edits
- **WHEN** alice picks a sense, adds a note and a tag, and saves
- **THEN** a confirm is sent

#### Scenario: Manual save
- **WHEN** alice skips suggestions or saves after a fallback
- **THEN** no confirm is sent

#### Scenario: Confirm fails
- **WHEN** the confirm request fails
- **THEN** the word is still saved, "Word saved" is shown, and no error is shown

### Requirement: Reused senses are the user's own data
Saving a word from cached senses SHALL create an ordinary word in the user's data, exactly as saving from fresh senses does. Later changes to or removal of the shared record SHALL NOT change any saved word.

#### Scenario: Record removed after save
- **WHEN** bob saved `Bank` from a confirmed record and that record is later removed
- **THEN** bob's word is unchanged

### Requirement: Rejected senses are never suggested again
The system SHALL keep a store of rejected senses, per language pair and lookup key, each with a fingerprint. The fingerprint SHALL be the part of speech followed by the translations, each trimmed and lowercased, sorted and joined. Rejecting a sense SHALL store its fingerprint under both the suggestion's entered-term key and its corrected-term key. On every cache miss, before the model call, the system SHALL look up the rejected senses for the request's key and: (a) list them in the prompt as senses not to suggest (only when there are any), and (b) after validation, drop every model sense whose fingerprint equals a rejected one. If dropping leaves at least one sense, those senses SHALL be stored as a new candidate record and returned. If it leaves none, the function SHALL retry once with the rejected senses stressed in the prompt (see ai-autofill); if the retry also leaves none, nothing SHALL be stored and the request SHALL end as an unavailable suggestion. Matching is exact on the fingerprint; the model may rephrase a rejected sense, and the admin can reject the new one.

#### Scenario: Rejected sense dropped
- **WHEN** the sense `noun: bank, financial institution` is rejected for `bank` and the model again returns it with another valid sense
- **THEN** only the other sense is stored and returned

#### Scenario: Order and case ignored
- **WHEN** a rejected sense has translations `Bench, Seat` and the model returns `seat, bench` for the same part of speech
- **THEN** it is dropped

#### Scenario: Prompt lists rejections
- **WHEN** a term has two rejected senses and the model is called
- **THEN** the prompt names both as not to be suggested

#### Scenario: No rejections, no extra prompt text
- **WHEN** a term has no rejected senses
- **THEN** the prompt has no "do not suggest" part

#### Scenario: Everything filtered once
- **WHEN** every sense of the first attempt matches a rejected one and the retry returns a different valid sense
- **THEN** the retry's senses are stored as a candidate record

#### Scenario: Everything filtered twice
- **WHEN** every sense of both attempts matches a rejected one
- **THEN** no record is stored and the response is the same as for an unavailable suggestion

#### Scenario: Rephrased sense passes
- **WHEN** the model returns a rejected meaning with different translations
- **THEN** it is stored as a candidate

### Requirement: A rejected sense can be allowed again
The system SHALL support taking a sense out of the rejected store (see suggestion-moderation). Allowing a sense again SHALL, in one step, delete its rows from the store (every lookup key stored for that rejection) and set every rejected sense with the same fingerprint in the suggestions of that language pair and those keys back to `candidate`, not judged, and recompute each such suggestion's status and keep `confirmed_at`. After that the sense SHALL no longer be listed in the prompt as not to be suggested nor dropped from model output, and a model sense matching it SHALL be stored as an ordinary candidate. A suggestion marked deleted by the first version keeps its mark.

#### Scenario: Prompt no longer lists it
- **WHEN** the only rejected sense of a term is allowed again and the model is called for the term
- **THEN** the prompt has no "do not suggest" part

#### Scenario: Matching sense kept
- **WHEN** the model returns the sense that was allowed again
- **THEN** it is not dropped and is stored as a candidate

#### Scenario: Restore is all or nothing
- **WHEN** the step fails part way
- **THEN** the store rows and the suggestions are unchanged

### Requirement: First-version removals carry over
Senses of records the first version of moderation removed (`deleted_at` set) SHALL be copied into the rejected-sense store, each under both the record's entered-term key and corrected-term key, with the fingerprint computed by exactly the same rule and code as for a new rejection (the `fingerprint.ts` function). Those records SHALL end with every sense rejected. The copy SHALL be repeatable without creating duplicates.

#### Scenario: Removed record carried over
- **WHEN** a record with senses `noun: bank, financial institution` and `noun: bench, seat` was removed by the first version and the backfill runs
- **THEN** two fingerprints are stored under each of its two keys, equal to what a new rejection of those senses would store

#### Scenario: Backfill run twice
- **WHEN** the backfill runs a second time
- **THEN** no row is added

#### Scenario: Removed meaning not suggested
- **WHEN** a removed `Bank` sense is returned by the model after the backfill
- **THEN** it is dropped like any rejected sense
