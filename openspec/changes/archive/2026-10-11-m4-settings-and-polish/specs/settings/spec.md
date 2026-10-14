## ADDED Requirements

### Requirement: Settings page contents
The Settings page SHALL show, in this order: the language pair, the daily new-word limit, AI usage this month, "Export my data" and "Sign out". It SHALL replace the placeholder text.

#### Scenario: Page sections
- **WHEN** a signed-in user opens Settings
- **THEN** all five sections are visible inside the shared layout and no "not built yet" text is shown

### Requirement: Language pair display
Settings SHALL show the active language pair as "German ← English", read-only.

#### Scenario: Pair shown
- **WHEN** the user opens Settings with the German and English pair active
- **THEN** "German ← English" is shown with no control to change it

### Requirement: Daily new-word limit
Settings SHALL show the current daily new-word limit in a number field and a "Save limit" button. A value SHALL be accepted only when it is a whole number from 0 to 100. A valid save SHALL store it on the user's profile and show "Saved". An invalid value SHALL show an inline error and store nothing. A failed save SHALL show an inline error and keep the entered value. The new limit SHALL apply the next time Home or Review loads.

#### Scenario: Current value shown
- **WHEN** the profile limit is 10 and the user opens Settings
- **THEN** the field shows 10

#### Scenario: Valid save
- **WHEN** the user enters 3 and presses "Save limit"
- **THEN** "Saved" is shown and after a reload the field shows 3

#### Scenario: Zero allowed
- **WHEN** the user saves 0
- **THEN** it is stored and no new words are offered in review

#### Scenario: Out of range
- **WHEN** the user enters 101, -1, 2.5 or an empty value
- **THEN** an inline error is shown and the stored limit is unchanged

#### Scenario: Save fails
- **WHEN** the request fails
- **THEN** an inline error is shown and the field keeps the entered value

#### Scenario: Keyboard
- **WHEN** the user presses Enter in the limit field
- **THEN** the limit is saved

### Requirement: AI usage display
Settings SHALL show this month's AI spend and the monthly cap as "$0.50 of $2.00". A spend above zero but under one cent SHALL read "less than $0.01 of $2.00". While loading it SHALL show "Loading". If the usage cannot be read (any failure or timeout of 8 seconds) it SHALL show "Usage unavailable". A usage failure SHALL NOT affect the rest of the page.

#### Scenario: Usage shown
- **WHEN** the function reports $0.50 spent of a $2.00 cap
- **THEN** "$0.50 of $2.00" is shown

#### Scenario: Tiny usage
- **WHEN** the spend is $0.0004
- **THEN** "less than $0.01 of $2.00" is shown

#### Scenario: No usage
- **WHEN** the spend is zero
- **THEN** "$0.00 of $2.00" is shown

#### Scenario: Usage unavailable
- **WHEN** the usage request fails
- **THEN** "Usage unavailable" is shown and the limit field and the buttons still work

### Requirement: Sign out
Settings SHALL offer a "Sign out" button. Pressing it SHALL end the session and open the sign-in page. If sign-out fails, an inline error SHALL be shown and the user stays on Settings.

#### Scenario: Signing out
- **WHEN** the user presses "Sign out"
- **THEN** the sign-in page opens and opening `/words.html` redirects to sign-in

#### Scenario: Sign-out fails
- **WHEN** the sign-out request fails
- **THEN** an inline error is shown and the user stays signed in on Settings
