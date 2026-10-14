## Purpose

Shows one of the user's words on its own page, read-only, with its translations and example sentences, reached from the Words list.

## ADDED Requirements

### Requirement: Word page
The site SHALL serve a word page at `/word.html?id=<word id>`, in both the dev server and the production build, inside the shared layout with the sidebar, where the Words link is marked as current. For an active word of the user it SHALL show the term with the article badge for nouns, `hint_en` when present, the part of speech, the translations joined with commas, and the German and English example sentences when present. Missing optional values SHALL be left out without empty labels. The page SHALL offer no way to change the word. All word values SHALL be inserted as text.

#### Scenario: Noun with everything filled
- **WHEN** the user opens the page for `Bank` (article `die`, hint `bank (money)`, noun, translations `bank`, examples present)
- **THEN** the page shows the `die` badge with `Bank`, `bank (money)`, `noun`, `bank`, and both example sentences

#### Scenario: No examples
- **WHEN** the word has no example sentences and no hint
- **THEN** no example or hint section is shown

#### Scenario: Several translations
- **WHEN** the word has translations `house` and `home`
- **THEN** `house, home` is shown

#### Scenario: Markup in a value
- **WHEN** a word's hint or example contains `<b>x</b>`
- **THEN** the literal characters are shown and no element is created

#### Scenario: Words marked current
- **WHEN** the word page is open
- **THEN** the Words link in the sidebar is marked as the current page

### Requirement: Unknown or deleted word
When the `id` is missing, malformed, unknown, belongs to another user or names a soft-deleted word, the word page SHALL show "Word not found" with the Back button and no word data.

#### Scenario: Deleted word
- **WHEN** the user opens the page for a word with `deleted_at` set
- **THEN** "Word not found" is shown

#### Scenario: Another user's word
- **WHEN** bob opens the page with the id of alice's word
- **THEN** "Word not found" is shown and none of alice's data

#### Scenario: Malformed id
- **WHEN** the page is opened with `?id=abc` or without `id`
- **THEN** "Word not found" is shown

### Requirement: Back to the Words list
The word page SHALL have a "Back to words" button that opens the Words list. Pressing Escape on the page SHALL do the same.

#### Scenario: Back button
- **WHEN** the user presses "Back to words"
- **THEN** the Words page opens

#### Scenario: Escape
- **WHEN** the user presses Escape on the word page
- **THEN** the Words page opens

### Requirement: Word page load failure
If the word fails to load for a reason other than not being found, the page SHALL show an inline message and a "Retry" button that loads it again.

#### Scenario: Retry
- **WHEN** loading fails and the user presses "Retry"
- **THEN** the load is attempted again and the word is shown on success
