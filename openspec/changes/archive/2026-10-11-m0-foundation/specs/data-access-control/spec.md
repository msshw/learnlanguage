## Purpose

Defines the database tables for the vocabulary app and the access rules that keep each user's rows private. Isolation holds even when a client sends crafted requests, including ones that point at another user's parent rows.

## ADDED Requirements

### Requirement: Six tables exist with the specified shape
The database SHALL contain `profiles`, `language_pairs`, `words`, `cards`, `review_logs` and `ai_calls` with the columns, types, defaults, checks, unique constraints and indexes given in SPEC §4.

#### Scenario: Tables present after reset
- **WHEN** the local database is reset and migrations are applied
- **THEN** all six tables exist

#### Scenario: Check constraints enforced
- **WHEN** a word is inserted with `part_of_speech` outside the allowed list, or with an empty `translations` array
- **THEN** the insert is rejected

#### Scenario: Card uniqueness
- **WHEN** a second card with the same `word_id` and `direction` is inserted
- **THEN** the insert is rejected

#### Scenario: Language pair uniqueness
- **WHEN** a second language pair with the same `user_id`, `target_lang` and `native_lang` is inserted
- **THEN** the insert is rejected

### Requirement: Row-level security on every table
RLS SHALL be enabled on all six tables. A signed-in user SHALL be able to read only rows whose `user_id` (or `id` for profiles) equals their own id.

#### Scenario: Cross-user read
- **WHEN** bob selects from any table where alice has rows
- **THEN** none of alice's rows are returned

#### Scenario: Anonymous read
- **WHEN** a request without a session selects from any table
- **THEN** no rows are returned

### Requirement: Writes limited to own rows
A signed-in user SHALL be able to insert and update only rows with their own `user_id`, and SHALL NOT be able to change a row's `user_id` to someone else's.

#### Scenario: Insert as another user
- **WHEN** bob inserts a row with alice's `user_id`
- **THEN** the insert is rejected

#### Scenario: Update another user's row
- **WHEN** bob updates a row owned by alice
- **THEN** no rows are changed

#### Scenario: Reassign ownership
- **WHEN** bob updates his own row to set `user_id` to alice's id
- **THEN** the update is rejected

### Requirement: Parent rows must belong to the same user
Rows that reference a parent SHALL be accepted only when the parent belongs to the same user. This covers `words.pair_id`, `cards.word_id`, `review_logs.card_id` and `profiles.active_pair_id`, on both insert and update.

#### Scenario: Word attached to another user's pair
- **WHEN** bob inserts a word with his own `user_id` and alice's `pair_id`
- **THEN** the insert is rejected

#### Scenario: Card attached to another user's word
- **WHEN** bob inserts a card with his own `user_id` and alice's `word_id`
- **THEN** the insert is rejected

#### Scenario: Log attached to another user's card
- **WHEN** bob inserts a review log with his own `user_id` and alice's `card_id`
- **THEN** the insert is rejected

#### Scenario: Active pair set to another user's pair
- **WHEN** bob updates his profile to set `active_pair_id` to alice's pair
- **THEN** the update is rejected

#### Scenario: Own parent accepted
- **WHEN** bob inserts a word referencing his own pair
- **THEN** the insert succeeds

### Requirement: No client deletes
No table SHALL allow DELETE from a client session. Words SHALL be removed by setting `deleted_at`.

#### Scenario: Delete rejected for the owner
- **WHEN** alice deletes her own row in any table
- **THEN** no rows are deleted

#### Scenario: Delete rejected for others
- **WHEN** bob deletes alice's row in any table
- **THEN** no rows are deleted

### Requirement: Review log is append-only
Clients SHALL be able to insert and select `review_logs` rows only. Updates SHALL be rejected.

#### Scenario: Update a log row
- **WHEN** alice updates her own review log row
- **THEN** no rows are changed

### Requirement: AI call log is read-only for users
Clients SHALL be able to select their own `ai_calls` rows and SHALL NOT be able to insert, update or delete them. Writes happen only with the service role.

#### Scenario: Client insert into ai_calls
- **WHEN** alice inserts a row into `ai_calls` with her own `user_id`
- **THEN** the insert is rejected

### Requirement: Profile created on account creation
Creating an `auth.users` row SHALL create a matching `profiles` row with default values, `id` equal to the user id, and no active pair.

#### Scenario: New user gets a profile
- **WHEN** a user is created
- **THEN** a profile with `new_words_per_day` 10, timezone `Europe/Berlin` and null `active_pair_id` exists

#### Scenario: Client cannot insert profiles
- **WHEN** a signed-in client inserts into `profiles`
- **THEN** the insert is rejected

### Requirement: Seed data
Resetting the local database SHALL create two users, `alice@test.local` and `bob@test.local`, both with password `password123` and able to sign in, and SHALL create no other data except their profiles.

#### Scenario: Seeded sign-in
- **WHEN** the database is reset and alice signs in with `password123`
- **THEN** sign-in succeeds and alice has a profile and no words
