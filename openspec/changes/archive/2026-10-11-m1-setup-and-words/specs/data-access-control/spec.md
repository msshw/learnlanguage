## ADDED Requirements

### Requirement: Cards are created with the word
Inserting a word SHALL, in the same transaction, create exactly two cards owned by the word's user: `de_en` with state `new` and `due` equal to the insert time, and `en_de` with state `new` and `due` one day after the insert time. The client SHALL NOT need to insert cards itself.

#### Scenario: Cards appear on insert
- **WHEN** alice inserts a word
- **THEN** alice can select one `de_en` card due at the word's creation time and one `en_de` card due 24 hours later

#### Scenario: Other users do not see them
- **WHEN** bob selects cards for alice's word
- **THEN** no rows are returned

#### Scenario: Rejected word creates no cards
- **WHEN** a word insert is rejected by a check or by RLS
- **THEN** no card is created

### Requirement: updated_at is maintained by the database
Every update of a word SHALL set `updated_at` to the time of the update, regardless of any value the client sends.

#### Scenario: Update bumps the timestamp
- **WHEN** alice updates a word's notes
- **THEN** `updated_at` is later than before

#### Scenario: Client value ignored
- **WHEN** alice updates a word and sends an old `updated_at`
- **THEN** the stored `updated_at` is the time of the update
