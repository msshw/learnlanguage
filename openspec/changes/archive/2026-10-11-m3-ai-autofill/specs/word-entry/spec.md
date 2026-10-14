## MODIFIED Requirements

### Requirement: Term step
The Add word page SHALL start with a term field focused on load and a "Check word" button. Pressing Enter in the field or the button SHALL continue to the duplicate check, then to suggestions. An empty term (after trimming) SHALL show an inline error and not continue.

#### Scenario: Enter continues
- **WHEN** the user types `Haus` and presses Enter
- **THEN** suggestions are requested for `Haus`

#### Scenario: Empty term
- **WHEN** the user presses Enter with an empty or whitespace-only term
- **THEN** an inline error is shown, the form stays hidden and no suggestions are requested

### Requirement: Duplicate warning
After the term step, the page SHALL look for active words in the active pair whose term equals the entered term, ignoring case, leading and trailing spaces and repeated inner spaces. If any match, it SHALL say the word already exists and offer "Open word" and "Add anyway". Duplicates SHALL NOT be blocked. Suggestions SHALL be requested only after no match is found or after "Add anyway". If suggestions return a term whose spelling differs from the entered term other than by case, the check SHALL run again on the returned term and show the warning if it matches.

#### Scenario: Match found
- **WHEN** an active word `Bank` exists and the user enters `  bank `
- **THEN** a warning is shown with an "Open word" link to `/words.html?edit=<id>` and an "Add anyway" button, and no suggestions are requested yet

#### Scenario: Add anyway
- **WHEN** the user presses "Add anyway"
- **THEN** suggestions are requested for the entered term

#### Scenario: Deleted words do not count
- **WHEN** the only matching word is soft deleted
- **THEN** no warning is shown

#### Scenario: Case with umlauts
- **WHEN** an active word `Äpfel` exists and the user enters `äpfel`
- **THEN** the warning is shown

#### Scenario: Wildcard characters are literal
- **WHEN** the user enters `a_c` and an active word `abc` exists
- **THEN** no warning is shown

#### Scenario: Corrected spelling matches an existing word
- **WHEN** the user enters `madchen`, suggestions return `Mädchen` and an active word `Mädchen` exists
- **THEN** the duplicate warning is shown for `Mädchen`

### Requirement: Suggestions
After the duplicate check, the page SHALL request suggestions for the term and show a waiting state with a "Skip suggestions" button. Pressing "Skip suggestions" SHALL show the empty manual form with the entered term, and a response arriving later SHALL be ignored. On status `ok` the page SHALL list the senses in order, each showing term, part of speech, translations, hint and example. Keys 1 to 3 SHALL pick the sense with that number and Enter SHALL pick the first. Picking a sense SHALL fill every field of the editable form from that sense, using the returned term. Nothing SHALL be saved until the user presses "Save word".

#### Scenario: Two senses
- **WHEN** suggestions for `Bank` return a money sense and a seat sense and the user presses 2
- **THEN** the form is filled with the seat sense, its article and plural included

#### Scenario: Enter picks the first
- **WHEN** the senses are shown and the user presses Enter
- **THEN** the form is filled with the first sense

#### Scenario: Skip while waiting
- **WHEN** the user presses "Skip suggestions" while the request is pending
- **THEN** the empty manual form with the entered term is shown, and the late response changes nothing

#### Scenario: Nothing saved on pick
- **WHEN** a sense is picked
- **THEN** no word exists until Save word is pressed

### Requirement: Suggestion fallbacks
When suggestions are unavailable (timeout, provider error, invalid output, over the monthly cap) the page SHALL show the empty manual form with the entered term and the message "Suggestions unavailable". When the status is `not_a_word` the page SHALL show "Not recognized as German" with a "Save manually anyway" button that shows the empty manual form with the entered term, and a way to go back to the term step. Saving manually SHALL remain possible in every case.

#### Scenario: Function down
- **WHEN** the request fails or takes longer than 8 seconds
- **THEN** the manual form is shown with "Suggestions unavailable"

#### Scenario: Not a word
- **WHEN** the status is `not_a_word`
- **THEN** "Not recognized as German" and "Save manually anyway" are shown, and no form fields are filled

#### Scenario: Save anyway
- **WHEN** the user presses "Save manually anyway"
- **THEN** the empty manual form with the entered term is shown

### Requirement: Saving a word
A valid save SHALL create one word in the user's active pair with the trimmed term, translations split on commas with empty entries removed, tags likewise, and `forms` containing only the keys that apply to the part of speech. `source` SHALL be `ai_confirmed` when the form was filled by picking a suggested sense and `manual` otherwise (manual entry, skipped suggestions, any fallback). Editing the filled values before saving SHALL NOT change `source`. After saving, the page SHALL confirm with "Word saved" and return to an empty term step with the term field focused.

#### Scenario: Successful save
- **WHEN** the user saves a valid noun `Haus`, article `das`, translation `house, home` without picking a sense
- **THEN** a word exists with translations `["house","home"]`, forms `{article:"das"}` and source `manual`, "Word saved" is shown, and the term field is empty and focused

#### Scenario: Save after picking a sense
- **WHEN** the user picks a suggested sense and saves
- **THEN** the word's source is `ai_confirmed`

#### Scenario: Picked sense then edited
- **WHEN** the user picks a sense, changes the translation and saves
- **THEN** the word's source is `ai_confirmed` with the edited translation

#### Scenario: Pick, cancel, manual add
- **WHEN** the user picks a sense, cancels, and adds another word by hand
- **THEN** the second word's source is `manual`

#### Scenario: Save failure
- **WHEN** the request fails
- **THEN** an inline error is shown and the entered values are kept

#### Scenario: Keyboard save
- **WHEN** the user presses Enter in a single-line field of the form
- **THEN** the form is submitted
