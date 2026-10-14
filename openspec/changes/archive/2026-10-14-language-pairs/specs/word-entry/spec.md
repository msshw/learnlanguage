## MODIFIED Requirements

### Requirement: Suggestion fallbacks
When suggestions are unavailable (timeout, provider error, invalid output, over the monthly cap) the page SHALL show the empty manual form with the entered term and the message "Suggestions unavailable". When the status is `not_a_word` the page SHALL show "Not recognized as <Target>" (the active pair's target language name) with a "Save manually anyway" button that shows the empty manual form with the entered term, and a way to go back to the term step. Saving manually SHALL remain possible in every case.

#### Scenario: Function down
- **WHEN** the request fails or takes longer than 8 seconds
- **THEN** the manual form is shown with "Suggestions unavailable"

#### Scenario: Not a word
- **WHEN** the status is `not_a_word` and the active pair's target is German
- **THEN** "Not recognized as German" and "Save manually anyway" are shown, and no form fields are filled

#### Scenario: Save anyway
- **WHEN** the user presses "Save manually anyway"
- **THEN** the empty manual form with the entered term is shown

#### Scenario: Other target
- **WHEN** the status is `not_a_word` and the active pair's target is French
- **THEN** "Not recognized as French" is shown

### Requirement: Fields by part of speech
The form SHALL always offer term, part of speech (noun, verb, adjective, adverb, phrase, other), translations (comma-separated), hint, example sentence in the target language, example sentence in the native language, notes and tags (comma-separated), labelled with the active pair's language names. The extra fields SHALL come from the profile of the active pair's target language. With the German profile, nouns SHALL additionally offer article (der, die, das) and plural, verbs SHALL additionally offer Präteritum, Partizip II, auxiliary (haben, sein) and separable prefix, and other parts of speech SHALL offer no extra fields. With the generic profile, no part of speech SHALL offer extra fields.

#### Scenario: Noun fields
- **WHEN** the active pair's target is German and the user selects noun
- **THEN** article and plural are shown and verb fields are hidden

#### Scenario: Verb fields
- **WHEN** the active pair's target is German and the user selects verb
- **THEN** the four verb fields are shown and noun fields are hidden

#### Scenario: Switching drops hidden values
- **WHEN** the user fills the article, switches to adjective and saves
- **THEN** the saved word's forms are empty

#### Scenario: Generic noun
- **WHEN** the active pair's target is French and the user selects noun
- **THEN** no article, plural or verb field is shown, and the saved word's forms are empty

#### Scenario: Labels
- **WHEN** the active pair is `fr`/`ru`
- **THEN** the example fields are labelled "Example sentence in French (optional)" and "Example sentence in Russian (optional)"

### Requirement: Validation
Saving SHALL require a non-empty term, a part of speech, and at least one non-empty translation. With the German profile, nouns SHALL require an article from der, die or das, a given auxiliary SHALL be haben or sein, and a noun term that starts with der, die or das followed by a space SHALL be rejected with the message "Enter the article in its own field". With the generic profile no article or form SHALL be required or checked. Errors SHALL be shown inline next to the form and nothing SHALL be saved.

#### Scenario: Noun without article
- **WHEN** the user saves a German noun with no article
- **THEN** an inline error asks for an article and no word is created

#### Scenario: Article typed in the term
- **WHEN** the user saves a German noun with term `die Bank`
- **THEN** the message "Enter the article in its own field" is shown and no word is created

#### Scenario: Verb without optional forms
- **WHEN** the user saves a verb with only term and translation
- **THEN** the word is saved

#### Scenario: No translation
- **WHEN** the translations field is empty or only commas
- **THEN** an inline error asks for at least one translation

#### Scenario: Generic noun saves without article
- **WHEN** the active pair's target is French and the user saves the noun `maison` with translation `house`
- **THEN** the word is saved with forms `{}`

### Requirement: Two cards per saved word
Every saved word SHALL have exactly two cards: `forward` (the target term is shown, the native translation is typed) with state `new` due at the time of saving, and `reverse` (the native translation is shown, the target term is typed) with state `new` due one day after that.

#### Scenario: Cards after save
- **WHEN** a word is saved
- **THEN** it has one `forward` card due now and one `reverse` card due about 24 hours later, both in state `new`
