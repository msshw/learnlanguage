## Purpose

Defines the Review screen: one card at a time, typed answers, feedback with an adjustable rating, and a summary. The whole flow works from the keyboard.

## ADDED Requirements

### Requirement: Session start
The Review page SHALL build the session queue once, after trying to save any pending answers. It SHALL show the first card, or the nothing-due state when the queue is empty.

#### Scenario: Cards due
- **WHEN** a user with due cards opens Review
- **THEN** the first card prompt is shown with the answer field focused

#### Scenario: Nothing due
- **WHEN** the queue is empty
- **THEN** a "Nothing due" message is shown with the next due time when there is one, and a link to Home

#### Scenario: Load failure
- **WHEN** the cards fail to load
- **THEN** an inline message and a "Retry" button are shown

### Requirement: Card prompts
For a `de_en` card the prompt SHALL show the German term, with its article for nouns. For an `en_de` card it SHALL show the English translations joined with commas, the hint when the word has one, and the part of speech. The page SHALL show the position in the session ("3 of 12"); requeued cards extend the total.

#### Scenario: de_en prompt
- **WHEN** a `de_en` card for the noun `das Haus` is shown
- **THEN** the prompt shows `das Haus`

#### Scenario: en_de prompt
- **WHEN** an `en_de` card for `Bank` with translation `bank` and hint `bank (money)` is shown
- **THEN** the prompt shows `bank`, `bank (money)` and `noun`

### Requirement: Submitting an answer
Pressing Enter in the answer field SHALL grade the answer and show the feedback. An empty answer SHALL be accepted and graded as wrong.

#### Scenario: Enter submits
- **WHEN** the user types an answer and presses Enter
- **THEN** the feedback view is shown

### Requirement: Feedback
The feedback view SHALL show the result (correct, typo with the correct spelling, article wrong, or wrong with the expected answer), the accepted answers, and the extra word information the word has: plural, verb forms, example sentence with its translation. It SHALL show four ratings, Again, Hard, Good and Easy, with the grader's default selected. Keys 1 to 4 SHALL select Again, Hard, Good and Easy. The typed answer field SHALL not accept input in this view.

#### Scenario: Default rating
- **WHEN** an answer is graded as article wrong
- **THEN** Hard is selected

#### Scenario: Change the rating
- **WHEN** the user presses 4 in the feedback view
- **THEN** Easy is selected

#### Scenario: Digits do not type
- **WHEN** the user presses 2 in the feedback view
- **THEN** no character is added to the answer field

### Requirement: Continuing
Pressing Enter in the feedback view SHALL confirm the selected rating, record the answer, and show the next card at once, without waiting for the save to finish. An answer is recorded only when confirmed.

#### Scenario: Next card
- **WHEN** the user presses Enter in the feedback view and more cards remain
- **THEN** the next card prompt is shown with the answer field focused

#### Scenario: Leaving before confirming
- **WHEN** the user leaves the page after submitting but before confirming
- **THEN** that answer is not recorded and earlier confirmed answers stay recorded

### Requirement: Again cards return
A confirmed answer with final rating Again SHALL put the card at the end of the same session. When it comes up again it SHALL be graded and recorded as a new answer, starting from the state the previous answer produced. Other ratings SHALL remove the card from the session.

#### Scenario: Requeued
- **WHEN** the user confirms Again on a card with two other cards left
- **THEN** the card appears again after those two cards

#### Scenario: Second answer starts from the new state
- **WHEN** a requeued card is answered again
- **THEN** the recorded state before that answer is the state produced by its first answer

### Requirement: Summary
When the queue is empty the page SHALL show a summary: the number of answers, how many passed (final rating 2 to 4) and failed (rating 1), the words to watch, and the next due time. Words to watch SHALL be the distinct words with at least one answer rated Again or Hard in the session, each shown with its article for nouns. The summary SHALL include a link to Home.

#### Scenario: Counts
- **WHEN** a session had 5 answers with final ratings 3, 3, 1, 3, 2
- **THEN** the summary shows 5 answers, 4 passed and 1 failed

#### Scenario: Words to watch
- **WHEN** the word `Haus` was rated Again once and later Good
- **THEN** `Haus` is listed under words to watch

#### Scenario: Link home
- **WHEN** the summary is shown
- **THEN** a "Go to Home" link is present

### Requirement: Keyboard only
Every Review action SHALL be possible without a mouse: typing and submitting, choosing a rating, continuing, and leaving the summary.

#### Scenario: Full session by keyboard
- **WHEN** the user answers every card using only the keyboard
- **THEN** the summary is reached

### Requirement: Page text safety
All word data and typed answers shown on the Review page SHALL be inserted as text.

#### Scenario: Markup in an answer
- **WHEN** the user types `<b>x</b>`
- **THEN** the feedback shows the literal characters
