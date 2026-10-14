# word-entry Specification

## Purpose
Lets a user add a German word: type the term, get warned about duplicates, pick an AI-suggested meaning or fill in the details by hand, and save. Saving puts the word on the review schedule through its two cards.

## Requirements

### Requirement: Term step
The Add word page SHALL start with a term field focused on load and a "Check word" button. The field SHALL have focus once the page is shown, without a click, also when the page was opened by a shortcut. Pressing Enter in the field or the button SHALL continue to the duplicate check, then to suggestions. An empty term (after trimming) SHALL show an inline error and not continue.

#### Scenario: Focused on load
- **WHEN** the Add word page finishes loading
- **THEN** the term field has focus and typed characters go into it

#### Scenario: Focused after a shortcut
- **WHEN** the user opens Add word with Alt+A from Home and starts typing
- **THEN** the characters go into the term field

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

### Requirement: Fields by part of speech
The form SHALL always offer term, part of speech (noun, verb, adjective, adverb, phrase, other), translations (comma-separated), hint, example sentence in German, example sentence in English, notes and tags (comma-separated). Nouns SHALL additionally offer article (der, die, das) and plural. Verbs SHALL additionally offer Präteritum, Partizip II, auxiliary (haben, sein) and separable prefix. Other parts of speech SHALL offer no extra fields.

#### Scenario: Noun fields
- **WHEN** the user selects noun
- **THEN** article and plural are shown and verb fields are hidden

#### Scenario: Verb fields
- **WHEN** the user selects verb
- **THEN** the four verb fields are shown and noun fields are hidden

#### Scenario: Switching drops hidden values
- **WHEN** the user fills the article, switches to adjective and saves
- **THEN** the saved word's forms are empty

### Requirement: Validation
Saving SHALL require a non-empty term, a part of speech, and at least one non-empty translation. Nouns SHALL require an article from der, die or das. A given auxiliary SHALL be haben or sein. A noun term that starts with der, die or das followed by a space SHALL be rejected with the message "Enter the article in its own field". Errors SHALL be shown inline next to the form and nothing SHALL be saved.

#### Scenario: Noun without article
- **WHEN** the user saves a noun with no article
- **THEN** an inline error asks for an article and no word is created

#### Scenario: Article typed in the term
- **WHEN** the user saves a noun with term `die Bank`
- **THEN** the message "Enter the article in its own field" is shown and no word is created

#### Scenario: Verb without optional forms
- **WHEN** the user saves a verb with only term and translation
- **THEN** the word is saved

#### Scenario: No translation
- **WHEN** the translations field is empty or only commas
- **THEN** an inline error asks for at least one translation

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

### Requirement: Two cards per saved word
Every saved word SHALL have exactly two cards: `de_en` with state `new` due at the time of saving, and `en_de` with state `new` due one day after that.

#### Scenario: Cards after save
- **WHEN** a word is saved
- **THEN** it has one `de_en` card due now and one `en_de` card due about 24 hours later, both in state `new`

### Requirement: Report a suggestion
When the sense list shows senses that come with a suggestion id, the page SHALL show a "Report suggestion" button below the senses, also after a sense is picked. Pressing it SHALL show a reason field (plain text, with a character count) and a "Send report" button; "Send report" SHALL stay disabled until the reason has at least 50 characters after trimming, and the field SHALL accept at most 2000. The user SHALL NOT be asked which sense is wrong. Sending SHALL report that suggestion with the reason and, on success, replace the report controls with the text "Suggestion reported". On failure it SHALL show "Could not report the suggestion" inline and keep the reason and the controls. Reporting SHALL NOT change the form, the picked sense or the saved word. Without a suggestion id the button SHALL NOT be shown. The controls SHALL be reachable with Tab, and typing in the reason field SHALL NOT trigger the keys 1 to 3 or Enter of the sense list.

#### Scenario: Report from the sense list
- **WHEN** suggestions for `Bank` are shown, the user presses "Report suggestion", types a 60-character reason and presses "Send report"
- **THEN** a report with that reason is sent for that suggestion and "Suggestion reported" is shown

#### Scenario: Reason too short
- **WHEN** the reason has 49 characters
- **THEN** "Send report" is disabled and nothing is sent

#### Scenario: Typing digits
- **WHEN** the user types `1` in the reason field
- **THEN** no sense is picked

#### Scenario: Report after picking
- **WHEN** the user picks a sense and then reports with a valid reason
- **THEN** the report is sent and the filled form is unchanged

#### Scenario: Report fails
- **WHEN** the report request fails
- **THEN** "Could not report the suggestion" is shown, the reason stays and the controls stay

#### Scenario: No id
- **WHEN** the senses came without a suggestion id
- **THEN** no "Report suggestion" button is shown

#### Scenario: New lookup
- **WHEN** the user reports, then saves and looks up another word
- **THEN** the button is shown again for the new suggestions, with an empty reason
