## MODIFIED Requirements

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
