# word-list Specification

## Purpose
Shows the user's vocabulary in one searchable table and lets them correct or remove words. Removal is a soft delete, so review history stays intact.

## Requirements

### Requirement: Words table
The Words page SHALL list the active words of the active pair, newest first, with columns for word, translations and next due date. For nouns the word column SHALL show the article before the term. Translations SHALL be shown joined with commas. The next due date SHALL be the earlier due date of the word's two cards. The word in each row SHALL be a link to that word's page (`/word.html?id=<id>`), and clicking anywhere in the row outside its buttons SHALL open the same page. The row's buttons SHALL keep their own actions.

#### Scenario: Row content
- **WHEN** a noun `Haus` with article `das` and translations `house, home` exists
- **THEN** its row shows `das Haus`, `house, home` and a due date

#### Scenario: Order
- **WHEN** two words exist
- **THEN** the one created last is first

#### Scenario: Open by clicking the row
- **WHEN** the user clicks the translations cell of the `Haus` row
- **THEN** the word page for `Haus` opens

#### Scenario: Open from the keyboard
- **WHEN** the user tabs to the `Haus` link and presses Enter
- **THEN** the word page for `Haus` opens

#### Scenario: Edit stays in the list
- **WHEN** the user presses "Edit" in a row
- **THEN** the edit dialog opens and the word page does not

### Requirement: Empty and no-result states
With no words the page SHALL show "No words yet" and an "Add word" link. With words but no search match it SHALL show "No results".

#### Scenario: No words
- **WHEN** the user has no active words
- **THEN** "No words yet" and an "Add word" link are shown and no table

#### Scenario: No match
- **WHEN** the search matches nothing
- **THEN** "No results" is shown

### Requirement: Search
A search field SHALL filter the table as the user types. A word matches when the query, ignoring case, is a substring of its term or of any of its translations. An empty query SHALL show all words.

#### Scenario: Search by term
- **WHEN** the user types `hau`
- **THEN** `Haus` is listed

#### Scenario: Search by translation
- **WHEN** the user types `hous`
- **THEN** `Haus` (translation `house`) is listed

#### Scenario: Clearing the search
- **WHEN** the user clears the field
- **THEN** all words are listed again

### Requirement: Editing a word
Each row SHALL offer "Edit", which opens a dialog with the same fields and validation as the Add word form, filled with the word's values. Saving SHALL update the word and close the dialog. Cards SHALL be unchanged. Cancel and Escape SHALL close the dialog without saving. A `?edit=<id>` parameter SHALL open the dialog for that active word on load; an unknown or deleted id SHALL be ignored.

#### Scenario: Edit translation
- **WHEN** the user edits the translation of a word and saves
- **THEN** the table shows the new translation

#### Scenario: Change part of speech
- **WHEN** the user changes a noun to an adjective and saves
- **THEN** the saved forms are empty

#### Scenario: Validation in edit
- **WHEN** the user clears the article of a noun and saves
- **THEN** an inline error is shown in the dialog and nothing is saved

#### Scenario: Escape
- **WHEN** the user presses Escape in the dialog
- **THEN** the dialog closes and the word is unchanged

#### Scenario: Open from duplicate warning
- **WHEN** the user opens `/words.html?edit=<id>` for an active word
- **THEN** the edit dialog for that word is open

#### Scenario: Unknown id
- **WHEN** the id does not match an active word
- **THEN** no dialog opens and the table renders normally

### Requirement: Soft delete with confirmation
Each row SHALL offer "Delete", which opens a confirmation dialog with "Delete word" and "Cancel". Confirming SHALL set `deleted_at` on the word and remove its row. Cancel and Escape SHALL change nothing. Cards and review logs SHALL be kept.

#### Scenario: Confirm
- **WHEN** the user presses Delete, then "Delete word"
- **THEN** the row disappears and the word has `deleted_at` set

#### Scenario: Cancel
- **WHEN** the user presses Delete, then "Cancel"
- **THEN** the row stays

### Requirement: Deleted words are excluded everywhere
Every query on words made by the app SHALL exclude rows with `deleted_at` set, including the Words table, search, the duplicate check, edit-by-id, the word page and the Home count.

#### Scenario: Home count
- **WHEN** a word is deleted
- **THEN** the Home word count drops by one

#### Scenario: Search
- **WHEN** a deleted word's term is searched
- **THEN** it is not listed

#### Scenario: Word page
- **WHEN** a deleted word's page is opened
- **THEN** its data is not shown

### Requirement: Load failure
If the words fail to load, the page SHALL show an inline message and a "Retry" button that loads them again.

#### Scenario: Retry
- **WHEN** loading fails and the user presses "Retry"
- **THEN** the load is attempted again and the table renders on success
