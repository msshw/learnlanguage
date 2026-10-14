## MODIFIED Requirements

### Requirement: Profile created on account creation
Creating an `auth.users` row SHALL create a matching `profiles` row with default values, `id` equal to the user id, and no active pair.

#### Scenario: New user gets a profile
- **WHEN** a user is created
- **THEN** a profile with timezone `Europe/Berlin` and null `active_pair_id` exists, and it has no `new_words_per_day` column

#### Scenario: Client cannot insert profiles
- **WHEN** a signed-in client inserts into `profiles`
- **THEN** the insert is rejected

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

## ADDED Requirements

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
