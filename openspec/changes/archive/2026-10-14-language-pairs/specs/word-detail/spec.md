## MODIFIED Requirements

### Requirement: Word page
The site SHALL serve a word page at `/word.html?id=<word id>`, in both the dev server and the production build, inside the shared layout with the sidebar, where the Words link is marked as current. For an active word of the user in the active pair it SHALL show the term with the article badge for nouns when the pair's profile has articles, `hint_native` when present, the part of speech, the translations joined with commas, and the target-language and native-language example sentences (`example_target`, `example_native`) when present. Missing optional values SHALL be left out without empty labels. The page SHALL offer no way to change the word. All word values SHALL be inserted as text.

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

#### Scenario: Generic noun
- **WHEN** the user opens the page for the French noun `maison`
- **THEN** no article badge is shown

### Requirement: Unknown or deleted word
When the `id` is missing, malformed, unknown, belongs to another user, belongs to another of the user's pairs than the active one, or names a soft-deleted word, the word page SHALL show "Word not found" with the Back button and no word data.

#### Scenario: Deleted word
- **WHEN** the user opens the page for a word with `deleted_at` set
- **THEN** "Word not found" is shown

#### Scenario: Another user's word
- **WHEN** bob opens the page with the id of alice's word
- **THEN** "Word not found" is shown and none of alice's data

#### Scenario: Malformed id
- **WHEN** the page is opened with `?id=abc` or without `id`
- **THEN** "Word not found" is shown

#### Scenario: Word of another pair
- **WHEN** the active pair is `fr`/`en` and the user opens the page of one of their German words
- **THEN** "Word not found" is shown
