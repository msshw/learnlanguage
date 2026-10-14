## MODIFIED Requirements

### Requirement: Row-level security on every table
RLS SHALL be enabled on every table. Every table except `ai_suggestions` SHALL have a `user_id` (or `id` for profiles), and a signed-in user SHALL be able to read only rows whose `user_id` (or `id` for profiles) equals their own id. `ai_suggestions` is the one documented exception to "every table has `user_id`": it holds shared data, has no `user_id`, and has RLS enabled with no policies, so no client session can read or write it.

#### Scenario: Cross-user read
- **WHEN** bob selects from any table where alice has rows
- **THEN** none of alice's rows are returned

#### Scenario: Anonymous read
- **WHEN** a request without a session selects from any table
- **THEN** no rows are returned

#### Scenario: Shared table closed to users
- **WHEN** alice selects from `ai_suggestions`
- **THEN** no rows are returned

## ADDED Requirements

### Requirement: Shared suggestion table is service-only
The database SHALL contain an `ai_suggestions` table with no `user_id`, readable and writable only with the service role. Signed-in and anonymous clients SHALL NOT be able to select, insert, update or delete its rows.

#### Scenario: Client insert
- **WHEN** alice inserts a row into `ai_suggestions`
- **THEN** the insert is rejected

#### Scenario: Client update
- **WHEN** alice updates a row of `ai_suggestions` to confirmed
- **THEN** no rows are changed

#### Scenario: Client delete
- **WHEN** alice deletes from `ai_suggestions`
- **THEN** no rows are deleted

#### Scenario: Service role
- **WHEN** the edge function inserts a candidate with the service role
- **THEN** the insert succeeds
