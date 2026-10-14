## Purpose

Shares confirmed AI suggestions between users, so a word that someone already added from an unchanged suggestion is answered from storage instead of a new model call, without letting any client write suggestion content.

## ADDED Requirements

### Requirement: Suggestion store
The system SHALL keep AI suggestions in one shared store. Each record SHALL hold the language pair, the lookup key of the entered term, the lookup key of the corrected term (the first sense's `term`), the full validated list of 1 to 3 senses, the model ID, a state of `candidate` or `confirmed`, and its creation and confirmation times. A record SHALL NOT belong to any user and SHALL NOT name the user who caused it. A lookup key SHALL be the term trimmed, with inner runs of spaces collapsed to one, and lowercased. Only `ok` results SHALL be stored; `not_a_word` and failures SHALL NOT be stored.

#### Scenario: Keys from a misspelling
- **WHEN** a lookup for `  madchen ` returns senses with term `Mädchen` and is stored
- **THEN** the record's keys are `madchen` and `mädchen`

#### Scenario: Not a word is not stored
- **WHEN** the model returns `not_a_word` for `table`
- **THEN** no record is stored

#### Scenario: No owner recorded
- **WHEN** alice's lookup creates a record
- **THEN** the record holds no reference to alice

### Requirement: Lookup uses confirmed records only
A suggestion request SHALL be answered from a confirmed record of the same language pair whose entered-term key or corrected-term key equals the request's lookup key. When several match, the most recently confirmed SHALL be used. Candidate records SHALL never be returned to a request. The answer SHALL contain all stored senses in stored order.

#### Scenario: Hit on the entered term
- **WHEN** a confirmed record for `bank` exists and bob requests `Bank`
- **THEN** bob gets all of that record's senses and no model call is made

#### Scenario: Hit on the corrected term
- **WHEN** a confirmed record has entered key `madchen` and corrected key `mädchen`, and bob requests `Mädchen`
- **THEN** bob gets that record's senses

#### Scenario: Case and spaces ignored
- **WHEN** a confirmed record for `guten morgen` exists and bob requests `Guten   Morgen `
- **THEN** bob gets that record's senses

#### Scenario: Candidate not served
- **WHEN** only a candidate record for `bank` exists and bob requests `Bank`
- **THEN** the model is called

### Requirement: Miss creates a candidate
When no confirmed record matches and the model returns a valid `ok` result, the system SHALL store that result as a new candidate record and return its id with the senses. If storing fails, the senses SHALL still be returned, without an id.

#### Scenario: Miss
- **WHEN** no record for `Schloss` exists and alice requests it
- **THEN** the model is called, a candidate record is stored, and alice gets the senses with the candidate's id

#### Scenario: Store fails
- **WHEN** storing the candidate fails
- **THEN** alice gets the senses without an id and can save as usual

### Requirement: Confirmation by an unchanged save
After a word is saved, the client SHALL send a confirm request with only the suggestion id and the index of the picked sense, and only when all of these hold: the senses came from a candidate (not from a confirmed record), a sense was picked, and the saved term, part of speech, translations, hint, forms and examples equal that sense's values after the form's normal cleanup. Notes and tags SHALL NOT count as changes. The client SHALL NOT send any suggestion content with a confirm. A confirm SHALL change the whole record from candidate to confirmed, so all its senses become available to later lookups. Saving the word SHALL NOT depend on the confirm: a failed confirm SHALL be ignored by the page. A save with edited values SHALL change only the user's own word.

#### Scenario: Unchanged pick confirms
- **WHEN** alice picks sense 2 of a candidate for `Bank` and saves without changes
- **THEN** a confirm with the candidate id and index 1 is sent, and the record becomes confirmed with both senses

#### Scenario: Edited pick does not confirm
- **WHEN** alice picks a sense, changes its translation and saves
- **THEN** no confirm is sent and the record stays a candidate

#### Scenario: Notes do not count as edits
- **WHEN** alice picks a sense, adds a note and a tag, and saves
- **THEN** a confirm is sent

#### Scenario: Manual save
- **WHEN** alice skips suggestions or saves after a fallback
- **THEN** no confirm is sent

#### Scenario: Senses from a confirmed record
- **WHEN** bob saves an unchanged sense that came from a confirmed record
- **THEN** no confirm is sent

#### Scenario: Confirm fails
- **WHEN** the confirm request fails
- **THEN** the word is still saved, "Word saved" is shown, and no error is shown

### Requirement: Reused senses are the user's own data
Saving a word from cached senses SHALL create an ordinary word in the user's data, exactly as saving from fresh senses does. Later changes to or removal of the shared record SHALL NOT change any saved word.

#### Scenario: Record removed after save
- **WHEN** bob saved `Bank` from a confirmed record and that record is later removed
- **THEN** bob's word is unchanged

### Requirement: Manual removal
Until a moderation tool exists, a wrong record SHALL be removable by the owner with SQL run with database owner rights. After removal, the next lookup for its keys SHALL be a miss.

#### Scenario: Removed by hand
- **WHEN** the owner deletes the confirmed record for `bank` by SQL and bob requests `Bank`
- **THEN** the model is called and a new candidate is stored
