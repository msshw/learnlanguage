## Purpose

Lets a user add a German word by hand: type the term, get warned about duplicates, fill in details that fit the part of speech, and save. Saving puts the word on the review schedule through its two cards.

## ADDED Requirements

### Requirement: Term step
The Add word page SHALL start with a term field focused on load and a "Check word" button. Pressing Enter in the field or the button SHALL continue to the form. An empty term (after trimming) SHALL show an inline error and not continue.

#### Scenario: Enter continues
- **WHEN** the user types `Haus` and presses Enter
- **THEN** the details form is shown with the term filled in

#### Scenario: Empty term
- **WHEN** the user presses Enter with an empty or whitespace-only term
- **THEN** an inline error is shown and the form stays hidden

### Requirement: Duplicate warning
Before showing the form, the page SHALL look for active words in the active pair whose term equals the entered term, ignoring case, leading and trailing spaces and repeated inner spaces. If any match, it SHALL say the word already exists and offer "Open word" and "Add anyway". Duplicates SHALL NOT be blocked.

#### Scenario: Match found
- **WHEN** an active word `Bank` exists and the user enters `  bank `
- **THEN** a warning is shown with an "Open word" link to `/words.html?edit=<id>` and an "Add anyway" button

#### Scenario: Add anyway
- **WHEN** the user presses "Add anyway"
- **THEN** the details form is shown

#### Scenario: Deleted words do not count
- **WHEN** the only matching word is soft deleted
- **THEN** no warning is shown

#### Scenario: Case with umlauts
- **WHEN** an active word `Äpfel` exists and the user enters `äpfel`
- **THEN** the warning is shown

#### Scenario: Wildcard characters are literal
- **WHEN** the user enters `a_c` and an active word `abc` exists
- **THEN** no warning is shown

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
A valid save SHALL create one word in the user's active pair with the trimmed term, translations split on commas with empty entries removed, tags likewise, `forms` containing only the keys that apply to the part of speech, and `source` equal to `manual`. After saving, the page SHALL confirm with "Word saved" and return to an empty term step with the term field focused.

#### Scenario: Successful save
- **WHEN** the user saves a valid noun `Haus`, article `das`, translation `house, home`
- **THEN** a word exists with translations `["house","home"]` and forms `{article:"das"}`, "Word saved" is shown, and the term field is empty and focused

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
