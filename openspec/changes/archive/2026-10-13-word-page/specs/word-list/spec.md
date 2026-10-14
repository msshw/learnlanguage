## MODIFIED Requirements

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
