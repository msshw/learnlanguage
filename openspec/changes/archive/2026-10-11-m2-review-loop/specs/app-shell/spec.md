## MODIFIED Requirements

### Requirement: Home empty state
The Home page SHALL show one of four states, always with an "Add word" link and, when the user has words, the word count ("1 word", "N words") as a secondary line. With no active words it SHALL show "No words yet" and no "Start review" button. With cards in the review queue it SHALL show the number of cards due ("1 card due", "N cards due") and a "Start review" button that opens Review. With words but an empty queue and no answers given on the current logical day it SHALL show "Nothing due" and the next due time when there is one. With an empty queue after answers were given on the current logical day it SHALL show "All done for today" and the next due time when there is one. If the data fails to load it SHALL show an inline message and a "Retry" button. When answers are waiting to be saved with 3 or more failed attempts, it SHALL show the unsaved banner.

#### Scenario: Empty state shown
- **WHEN** a signed-in user with no active words opens Home
- **THEN** the text "No words yet" and an "Add word" link are visible and "Start review" is not

#### Scenario: Cards due
- **WHEN** a user has 12 cards in the review queue
- **THEN** "12 cards due" and a "Start review" button are visible

#### Scenario: Singular
- **WHEN** one card is in the queue
- **THEN** "1 card due" is shown

#### Scenario: Start review
- **WHEN** the user presses "Start review"
- **THEN** the Review page opens

#### Scenario: Nothing due
- **WHEN** a user with words has an empty queue and gave no answers today
- **THEN** "Nothing due" and the next due time are shown

#### Scenario: All done today
- **WHEN** a user finishes their queue and returns to Home on the same logical day
- **THEN** "All done for today" is shown

#### Scenario: Count shown
- **WHEN** a signed-in user with three active words opens Home
- **THEN** "3 words" and an "Add word" link are visible and "No words yet" is not

#### Scenario: Add word link works
- **WHEN** the user follows the "Add word" link
- **THEN** the Add word page opens

#### Scenario: Load failure
- **WHEN** Home data fails to load and the user presses "Retry"
- **THEN** the load is attempted again

### Requirement: Placeholder pages
The Settings page SHALL show a heading and one line stating the page is not built yet, and SHALL contain no feature behavior.

#### Scenario: Placeholder content
- **WHEN** a signed-in user opens the Settings page
- **THEN** a heading and a single placeholder line are shown inside the layout
