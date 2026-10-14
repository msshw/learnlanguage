# language-setup Specification

## Purpose
Makes sure every signed-in user has an active language pair before using the app, and lets them create it once. A user can have several pairs, one active at a time, chosen from a supported list; the first pair is created in setup and more are added in Settings.

## Requirements

### Requirement: Setup required before app pages
Home, Review, Add word, Words and Settings SHALL redirect a signed-in user whose profile has no active language pair to the Setup page, after the session check. Their content SHALL stay hidden until both checks pass.

#### Scenario: No active pair
- **WHEN** a signed-in user without an active pair opens `/words.html`
- **THEN** the browser is redirected to `/setup.html`

#### Scenario: Active pair present
- **WHEN** a signed-in user with an active pair opens `/words.html`
- **THEN** the page renders with no redirect

#### Scenario: Signed out goes to sign-in first
- **WHEN** a signed-out user opens `/words.html`
- **THEN** the browser is redirected to sign-in, not to Setup

### Requirement: Setup page content
The Setup page SHALL first ask for the native language ("I speak") from the native languages of the supported list (English, Russian), then for the target language ("I'm learning") from the target languages of the list, leaving out the chosen native language. Changing the native language SHALL refresh the target choices and clear a target that is no longer allowed. Each language SHALL be shown by its English name. It SHALL show a "Start learning" button that is disabled until both are chosen, and SHALL show no sidebar. Every control SHALL work from the keyboard.

#### Scenario: Fixed choices
- **WHEN** a user without a pair opens Setup
- **THEN** English and Russian are offered as native languages, the target languages of the list are offered as targets, and no sidebar is visible

#### Scenario: Native language left out of the targets
- **WHEN** the user chooses Russian as native language
- **THEN** Russian is not offered as a target language and English is

#### Scenario: Changing the native language
- **WHEN** the user chose native English and target Russian, then changes the native language to Russian
- **THEN** the target choice is cleared and "Start learning" is disabled

### Requirement: Creating the language pair
Pressing "Start learning" SHALL create the pair with the chosen target and native language for the user if it does not exist, set it as the profile's active pair, and send the user to Home. Repeating the action SHALL NOT create a second pair. A pair not allowed by the supported list SHALL NOT be created.

#### Scenario: First submit
- **WHEN** a user without a pair chooses native English, target German and presses "Start learning"
- **THEN** one `de`/`en` pair exists for the user, the profile's active pair is that pair, and the user lands on Home

#### Scenario: Russian native
- **WHEN** a user without a pair chooses native Russian, target French and presses "Start learning"
- **THEN** one `fr`/`ru` pair exists, it is active, and the user lands on Home

#### Scenario: Pair exists but is not active
- **WHEN** the user's `de`/`en` pair exists and the profile has no active pair, and the user chooses the same languages and presses "Start learning"
- **THEN** no second pair is created and the existing pair becomes active

#### Scenario: Button disabled while pending
- **WHEN** the request is in flight
- **THEN** the button is disabled

#### Scenario: Failure
- **WHEN** creating the pair or setting it active fails
- **THEN** an inline error is shown, the user stays on Setup, and the button is enabled again

### Requirement: Setup never shows again
A user with an active pair who opens the Setup page SHALL be redirected to Home.

#### Scenario: Return visit
- **WHEN** a user with an active pair opens `/setup.html`
- **THEN** the browser is redirected to Home
