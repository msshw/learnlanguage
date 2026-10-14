## ADDED Requirements

### Requirement: Admin flag is set by hand only
`profiles` SHALL have an `is_admin` flag, false by default. A user SHALL be able to read their own flag. No client session SHALL be able to change it, for their own profile or any other; it SHALL be changed only with database owner rights or the service role.

#### Scenario: Default
- **WHEN** a user is created
- **THEN** their profile has `is_admin` false

#### Scenario: Self-promotion rejected
- **WHEN** bob updates his own profile setting `is_admin` to true
- **THEN** the update is rejected and the flag stays false

#### Scenario: Other profile fields still editable
- **WHEN** bob updates his own `new_words_per_day`
- **THEN** the update succeeds

#### Scenario: Set by the owner
- **WHEN** the owner sets `is_admin` to true for a profile with SQL
- **THEN** the flag is true

### Requirement: Suggestion reports are insert-only for users
The database SHALL have a `suggestion_reports` table with `user_id`, the reported suggestion, a reason, the creation time, and when and how the report was closed. A signed-in user SHALL be able to insert only reports with their own `user_id` and a reason of at least 50 characters after trimming and at most 2000 characters, and SHALL NOT be able to select, update or delete any report, including their own. A report SHALL reference an existing suggestion; unlike other parent rows, the suggestion is shared and does not belong to the user. One user SHALL NOT have two reports for the same suggestion. Only the service role SHALL read and close reports. A closed report SHALL have one resolution: `approved`, `edited`, `rejected` or `removed` (reports closed by the first version of moderation keep `removed` or `kept`).

#### Scenario: Own report
- **WHEN** alice inserts a report with her own `user_id` and a reason of 60 characters
- **THEN** the insert succeeds

#### Scenario: Reason too short
- **WHEN** alice inserts a report whose reason is 49 characters, or only spaces, or missing
- **THEN** the insert is rejected

#### Scenario: Reason too long
- **WHEN** alice inserts a report whose reason is 2001 characters
- **THEN** the insert is rejected

#### Scenario: Report as another user
- **WHEN** bob inserts a report with alice's `user_id`
- **THEN** the insert is rejected

#### Scenario: Reading reports
- **WHEN** alice selects from `suggestion_reports`
- **THEN** no rows are returned

#### Scenario: Closing a report
- **WHEN** alice updates her report to closed
- **THEN** no rows are changed

#### Scenario: Unknown suggestion
- **WHEN** alice inserts a report for an id that is not a stored suggestion
- **THEN** the insert is rejected

#### Scenario: Duplicate report
- **WHEN** alice inserts a second report for the same suggestion
- **THEN** the insert is rejected

### Requirement: Rejected senses table is service-only
The database SHALL have a `rejected_senses` table holding, per language pair and lookup key, the fingerprint and readable content (part of speech, translations) of each rejected sense, and the creation time. It SHALL have no `user_id` and SHALL NOT name any user. RLS SHALL be enabled with no policies and no grants to client roles, so only the service role can read or write it. One fingerprint SHALL be stored at most once per language pair and key.

#### Scenario: Closed to users
- **WHEN** alice selects from, inserts into, updates or deletes from `rejected_senses`
- **THEN** no rows are returned or changed, or the statement is rejected

#### Scenario: No duplicates
- **WHEN** the service role stores the same fingerprint twice for one pair and key
- **THEN** one row exists

#### Scenario: Moderation function closed to users
- **WHEN** alice calls the moderation function
- **THEN** the call is rejected

#### Scenario: Allow-again function closed to users
- **WHEN** alice or an anonymous caller calls the function that allows a rejected sense again
- **THEN** the call is rejected and the store is unchanged

## MODIFIED Requirements

### Requirement: Row-level security on every table
RLS SHALL be enabled on every table. Every table except `ai_suggestions` and `rejected_senses` SHALL have a `user_id` (or `id` for profiles), and a signed-in user SHALL be able to read only rows whose `user_id` (or `id` for profiles) equals their own id. `ai_suggestions` and `rejected_senses` are the documented exceptions to "every table has `user_id`": they hold shared data, have no `user_id`, and have RLS enabled with no policies, so no client session can read or write them.

#### Scenario: Cross-user read
- **WHEN** bob selects from any table where alice has rows
- **THEN** none of alice's rows are returned

#### Scenario: Anonymous read
- **WHEN** a request without a session selects from any table
- **THEN** no rows are returned

#### Scenario: Shared table closed to users
- **WHEN** alice selects from `ai_suggestions`
- **THEN** no rows are returned
