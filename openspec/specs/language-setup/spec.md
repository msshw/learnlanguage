# language-setup Specification

## Purpose
Makes sure every signed-in user has an active language pair before using the app, and lets them create it once. The data model supports many pairs; the UI offers only German with English.

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
The Setup page SHALL show the learning language as German and the native language as English, as fixed single-option choices, and a "Start learning" button. It SHALL show no sidebar.

#### Scenario: Fixed choices
- **WHEN** a user without a pair opens Setup
- **THEN** German and English are shown as the only options, and no sidebar is visible

### Requirement: Creating the language pair
Pressing "Start learning" SHALL create the pair (target `de`, native `en`) for the user if it does not exist, set it as the profile's active pair, and send the user to Home. Repeating the action SHALL NOT create a second pair.

#### Scenario: First submit
- **WHEN** a user without a pair presses "Start learning"
- **THEN** one `de`/`en` pair exists for the user, the profile's active pair is that pair, and the user lands on Home

#### Scenario: Pair exists but is not active
- **WHEN** the user's `de`/`en` pair exists and the profile has no active pair, and the user presses "Start learning"
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
