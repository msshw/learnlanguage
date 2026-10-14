## MODIFIED Requirements

### Requirement: Export file
Pressing "Export my data" on Settings SHALL download one JSON file named `vocab-export-YYYY-MM-DD.json` (the date in the profile timezone). The file SHALL be an object with `version` (the number 2), `exported_at` (ISO timestamp), `language_pairs`, `words`, `cards` and `review_logs`. `language_pairs` SHALL hold every pair of the user, so each word's `pair_id` can be resolved to its languages. `words` SHALL include every word of the user in every pair, deleted ones too, with their `deleted_at`. `cards` and `review_logs` SHALL hold every card and log of the user. Rows SHALL carry all stored columns, with the field names and direction values of the current schema. The file SHALL hold no other user's data and no `ai_calls`.

#### Scenario: File content
- **WHEN** a user with one pair, 2 words (one deleted), 4 cards and 3 review logs presses "Export my data"
- **THEN** the downloaded JSON has `version` 2, 1 language pair, 2 words (one with `deleted_at` set), 4 cards and 3 review logs

#### Scenario: More than a thousand rows
- **WHEN** the user has 1,500 review logs
- **THEN** all 1,500 are in the file

#### Scenario: Empty account
- **WHEN** the user has no words
- **THEN** the file has empty `words`, `cards` and `review_logs` arrays

#### Scenario: Only own data
- **WHEN** another user has words
- **THEN** none of them appear in the file

#### Scenario: Two pairs
- **WHEN** the user has words in `de`/`en` and `fr`/`en`
- **THEN** both pairs and all words of both are in the file, whichever pair is active
