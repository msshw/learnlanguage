# data-access-control Specification

## Purpose
Defines the database tables for the vocabulary app and the access rules that keep each user's rows private. Isolation holds even when a client sends crafted requests, including ones that point at another user's parent rows.

## Requirements

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
- **THEN** a profile with timezone `Europe/Berlin` and null `active_pair_id` exists, and it has no `new_words_per_day` column

#### Scenario: Client cannot insert profiles
- **WHEN** a signed-in client inserts into `profiles`
- **THEN** the insert is rejected

### Requirement: Seed data
Resetting the local database SHALL create two users, `alice@test.local` and `bob@test.local`, both with password `password123` and able to sign in, and SHALL create no other data except their profiles.

#### Scenario: Seeded sign-in
- **WHEN** the database is reset and alice signs in with `password123`
- **THEN** sign-in succeeds and alice has a profile and no words

### Requirement: Cards are created with the word
Inserting a word SHALL, in the same transaction, create exactly two cards owned by the word's user: `forward` with state `new` and `due` equal to the insert time, and `reverse` with state `new` and `due` one day after the insert time. The client SHALL NOT need to insert cards itself.

#### Scenario: Cards appear on insert
- **WHEN** alice inserts a word
- **THEN** alice can select one `forward` card due at the word's creation time and one `reverse` card due 24 hours later

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

### Requirement: Cards store the learning step
Each card SHALL have a non-negative whole number `learning_steps`, default 0, holding its position within the FSRS learning steps.

#### Scenario: Default
- **WHEN** a card is created by saving a word
- **THEN** its `learning_steps` is 0

#### Scenario: Negative rejected
- **WHEN** a card is updated with a negative `learning_steps`
- **THEN** the update is rejected

### Requirement: One log row per card and answer time
`review_logs` SHALL reject a second row with the same `card_id` and `reviewed_at`.

#### Scenario: Duplicate row
- **WHEN** a second log row with the same card and answer time is inserted
- **THEN** the insert is rejected

### Requirement: Recording a review
A signed-in user SHALL be able to record a review for one of their own cards through a single database call that appends the log row and updates the card to its next state in one transaction. The log row's owner SHALL be the caller, whatever the call contains. The call SHALL not be available to anonymous users.

#### Scenario: Own card
- **WHEN** alice records a review for her card
- **THEN** one log row owned by alice exists and the card holds the new state

#### Scenario: Another user's card
- **WHEN** bob records a review for alice's card
- **THEN** the call fails and alice's card and logs are unchanged

#### Scenario: Repeated call
- **WHEN** the same call is made twice
- **THEN** one log row exists and the card state is that of the call

#### Scenario: Older answer
- **WHEN** a call carries an answer time earlier than the card's last review
- **THEN** a log row is added and the card is unchanged

#### Scenario: Anonymous
- **WHEN** a request without a session makes the call
- **THEN** it is rejected

#### Scenario: Owner forced
- **WHEN** a call names another user as the log owner
- **THEN** the log row is owned by the caller

### Requirement: AI usage summation is service-only
The database SHALL provide a function that returns the summed input tokens and output tokens of a given user's `ai_calls` rows created at or after a given time. It SHALL be executable by the service role only; signed-in and anonymous users SHALL NOT be able to call it. `ai_calls` rows SHALL stay readable by their owner and writable only by the service role.

#### Scenario: Sum for a user
- **WHEN** alice has `ai_calls` rows before and after the start time
- **THEN** the function returns the sums of the rows at or after the start time and none of bob's

#### Scenario: No rows
- **WHEN** the user has no matching rows
- **THEN** the sums are zero

#### Scenario: Called by a user
- **WHEN** a signed-in user or an anonymous client calls the function
- **THEN** the call is rejected

#### Scenario: User writes to ai_calls
- **WHEN** a signed-in user inserts into `ai_calls`
- **THEN** the insert is rejected

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

### Requirement: Admin flag is set by hand only
`profiles` SHALL have an `is_admin` flag, false by default. A user SHALL be able to read their own flag. No client session SHALL be able to change it, for their own profile or any other; it SHALL be changed only with database owner rights or the service role.

#### Scenario: Default
- **WHEN** a user is created
- **THEN** their profile has `is_admin` false

#### Scenario: Self-promotion rejected
- **WHEN** bob updates his own profile setting `is_admin` to true
- **THEN** the update is rejected and the flag stays false

#### Scenario: Other profile fields still editable
- **WHEN** bob updates his own `timezone` or sets `active_pair_id` to one of his own pairs
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

### Requirement: Daily limit per language pair
`language_pairs` SHALL have `new_words_per_day`, a whole number of at least 0, default 10. `profiles` SHALL no longer have `new_words_per_day`. The migration that moves it SHALL copy each user's profile value into every pair of that user before removing the profile column. The owner SHALL be able to update their own pair's limit; nobody else SHALL.

#### Scenario: Value carried over
- **WHEN** alice's profile limit was 7 with one `de`/`en` pair and the migration runs
- **THEN** her `de`/`en` pair has `new_words_per_day` 7

#### Scenario: New pair default
- **WHEN** a pair is created without a limit
- **THEN** its `new_words_per_day` is 10

#### Scenario: Negative rejected
- **WHEN** alice sets her pair's limit to -1
- **THEN** the update is rejected

#### Scenario: Another user's pair
- **WHEN** bob updates the limit of alice's pair
- **THEN** no rows are changed

### Requirement: Pair languages are fixed
A language pair's `target_lang` and `native_lang` SHALL differ and SHALL NOT change after the pair is created. A client SHALL be able to insert its own pairs and update only their `new_words_per_day`. Which codes are allowed SHALL be checked by the edge functions against the supported language list, not by the database.

#### Scenario: Same language rejected
- **WHEN** alice inserts a pair with target `en` and native `en`
- **THEN** the insert is rejected

#### Scenario: Language change rejected
- **WHEN** alice updates her `de`/`en` pair's `target_lang` to `fr`
- **THEN** the update is rejected and the pair is unchanged

#### Scenario: Repeated insert
- **WHEN** alice inserts a `fr`/`en` pair she already has, with the duplicate ignored
- **THEN** one `fr`/`en` pair exists

### Requirement: Language-neutral word fields and card directions
`words` SHALL have `hint_native`, `example_target` and `example_native` in place of `hint_en`, `example_de` and `example_en`. `cards.direction` SHALL be `forward` or `reverse` only. The migration that introduces them SHALL keep every existing value: each word keeps its hint and examples under the new names, each `de_en` card becomes `forward` and each `en_de` card `reverse` with its FSRS state, due time and review logs unchanged, and the existing `de`/`en` pairs keep all their words and cards.

#### Scenario: Word fields carried over
- **WHEN** alice's word had `hint_en` `bank (money)` and the migration runs
- **THEN** the word has `hint_native` `bank (money)` and no `hint_en` column exists

#### Scenario: Directions carried over
- **WHEN** alice had a `de_en` card in state `review` due tomorrow with 3 review logs
- **THEN** after the migration it is a `forward` card in state `review`, due tomorrow, with the same 3 review logs

#### Scenario: Old direction rejected
- **WHEN** a card with direction `de_en` is inserted after the migration
- **THEN** the insert is rejected
