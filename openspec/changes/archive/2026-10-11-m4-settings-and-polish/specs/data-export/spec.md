## ADDED Requirements

### Requirement: Export file
Pressing "Export my data" on Settings SHALL download one JSON file named `vocab-export-YYYY-MM-DD.json` (the date in the profile timezone). The file SHALL be an object with `version` (the number 1), `exported_at` (ISO timestamp), `words`, `cards` and `review_logs`. `words` SHALL include every word of the user, deleted ones too, with their `deleted_at`. `cards` and `review_logs` SHALL hold every card and log of the user. Rows SHALL carry all stored columns. The file SHALL hold no other user's data and no `ai_calls`.

#### Scenario: File content
- **WHEN** a user with 2 words (one deleted), 4 cards and 3 review logs presses "Export my data"
- **THEN** the downloaded JSON has `version` 1, 2 words (one with `deleted_at` set), 4 cards and 3 review logs

#### Scenario: More than a thousand rows
- **WHEN** the user has 1,500 review logs
- **THEN** all 1,500 are in the file

#### Scenario: Empty account
- **WHEN** the user has no words
- **THEN** the file has three empty arrays

#### Scenario: Only own data
- **WHEN** another user has words
- **THEN** none of them appear in the file

### Requirement: Export failure
If any part of the data cannot be read, the page SHALL show an inline error, SHALL NOT download a partial file, and SHALL re-enable the button. The button SHALL be disabled while the export runs.

#### Scenario: Read fails
- **WHEN** reading review logs fails halfway
- **THEN** an inline error is shown and no file is downloaded
