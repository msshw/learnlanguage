## Purpose

Lets the user practise using learned words by writing a German sentence with each, getting AI feedback, and rating the attempt, on a schedule of its own that does not touch word reviews.

## ADDED Requirements

### Requirement: One practice card per word
Every word SHALL have exactly one practice card with its own FSRS state, separate from the word's two review cards. Saving a word SHALL create its practice card in state `new`. Words that exist when the feature is introduced SHALL get one too. Practice SHALL never change the word's review cards or `review_logs`, and reviews SHALL never change practice cards.

#### Scenario: Card on save
- **WHEN** a word is saved
- **THEN** it has one practice card in state `new` and its two review cards as before

#### Scenario: Existing words
- **WHEN** the feature's migration runs for a user with 40 words
- **THEN** each of the 40 words has one practice card

#### Scenario: Independent schedules
- **WHEN** a practice attempt is rated Again
- **THEN** the word's review cards and review logs are unchanged

### Requirement: Practice queue
The practice queue SHALL contain, for active words of the active pair only: first the practice cards that are not new and are due, most overdue first; then new practice cards, oldest word first, up to 5 new practice cards introduced per logical day (04:00 rollover in the profile timezone). A new practice card SHALL be eligible only when the word's `de_en` review card is in state `review`. Practice cards of soft-deleted words SHALL be excluded. The queue SHALL be built once when the session starts and each card SHALL appear once per session.

#### Scenario: Due first
- **WHEN** two practice cards are due, one overdue by 3 days and one by 1 day, and new cards are eligible
- **THEN** the 3-day card comes first, then the 1-day card, then the new cards

#### Scenario: Daily new limit
- **WHEN** 5 new practice cards were already practised today and more are eligible
- **THEN** no new practice card is in the queue

#### Scenario: Not learned yet
- **WHEN** a word's `de_en` review card is in state `new` or `learning`
- **THEN** its new practice card is not in the queue

#### Scenario: Deleted word
- **WHEN** a word with a due practice card is soft deleted
- **THEN** its practice card is not in the queue

### Requirement: Practice page
The site SHALL serve a Practice page at `/practice.html` in the focus layout without the sidebar, like Review, with an "End session" button and Escape returning to Home. With an empty queue it SHALL show "Nothing due for practice", the next practice due time when there is one, and a link to Home. If the data fails to load it SHALL show an inline message and a "Retry" button. It SHALL show the position in the session ("3 of 8").

#### Scenario: Empty queue
- **WHEN** the user opens Practice with nothing due and no eligible new card
- **THEN** "Nothing due for practice" and a link to Home are shown

#### Scenario: End session
- **WHEN** the user presses Escape during a session
- **THEN** Home opens and every attempt already rated stays saved

### Requirement: Writing step
For each card the page SHALL show the word (with its article for nouns), its translations joined with commas, its hint when present and its part of speech, and a focused sentence field. Enter SHALL submit the sentence for checking. A sentence that is empty after trimming SHALL show an inline error and not be submitted. A sentence longer than 300 characters SHALL show an inline error and not be submitted. While the check runs the page SHALL show "Checking sentence" and a "Skip check" button that goes to the feedback step without a check, ignoring a later response.

#### Scenario: Prompt
- **WHEN** the practice card for `die Bank` (translation `bank`, hint `bank (money)`) is shown
- **THEN** `die Bank`, `bank`, `bank (money)` and `noun` are shown and the sentence field has focus

#### Scenario: Empty sentence
- **WHEN** the user presses Enter with an empty field
- **THEN** an inline error is shown and no check is requested

#### Scenario: Skip check
- **WHEN** the user presses "Skip check" while the check is pending
- **THEN** the feedback step without a check is shown and the late response changes nothing

### Requirement: Feedback step
When the check succeeds, the page SHALL show the user's sentence with each reported issue span highlighted, each issue's explanation, and the corrected sentence when it differs from the user's sentence. When the check reports that the word is not used, it SHALL say "This sentence does not use the word". When the check is unavailable (timeout, network or HTTP failure, status `error`, `over_cap`, unreadable response) or was skipped, it SHALL show the user's sentence without highlights, the message "Check unavailable", and the word's example sentence when it has one. All sentence text, corrections and explanations SHALL be inserted as text; highlights SHALL be created as elements around text, never from markup.

#### Scenario: Issues highlighted
- **WHEN** the user writes `Ich gehe zu die Bank.` and the check reports an issue on `zu die`
- **THEN** `zu die` is highlighted, its explanation is shown, and the corrected sentence `Ich gehe zur Bank.` is shown

#### Scenario: No issues
- **WHEN** the check reports no issues and the word is used
- **THEN** the sentence is shown without highlights and no corrected sentence is shown

#### Scenario: Markup in the sentence
- **WHEN** the user writes `<b>Bank</b>` and the check returns
- **THEN** the literal characters are shown and no `b` element is created

#### Scenario: Check unavailable
- **WHEN** the check times out
- **THEN** the sentence, "Check unavailable" and the word's example sentence are shown

### Requirement: Rating an attempt
The feedback step SHALL show four ratings, Again, Hard, Good and Easy, selectable with keys 1 to 4. After a successful check the default SHALL be Again when the word is not used, Hard when there is at least one issue, and Good otherwise. When the check was unavailable or skipped, no rating SHALL be preselected and Enter SHALL do nothing until one is selected. Enter SHALL confirm the selected rating, record the attempt and show the next card or the summary. While the attempt is being saved the page SHALL wait; if saving fails it SHALL show "Could not save this attempt" with a "Retry" button and keep the attempt.

#### Scenario: Default with issues
- **WHEN** the check reports one issue and the word is used
- **THEN** Hard is selected

#### Scenario: Rating required without a check
- **WHEN** the check was unavailable and the user presses Enter
- **THEN** nothing happens until the user presses 1 to 4

#### Scenario: Save fails
- **WHEN** recording the attempt fails
- **THEN** "Could not save this attempt" and "Retry" are shown, and "Retry" records the same attempt

### Requirement: Practice log
Recording an attempt SHALL append one practice log row and move the practice card to its next FSRS state in one transaction. The row SHALL hold the card, the time, the sentence as typed, the corrected sentence and issues when a check succeeded, whether the check was `ok` or `unavailable`, the final rating, the FSRS state before, and the time taken. Practice logs SHALL be append-only. Recording the same attempt twice SHALL leave one row and the card in the state of that attempt.

#### Scenario: One row per attempt
- **WHEN** an attempt is rated Good
- **THEN** one practice log row exists with the sentence, rating 3 and the state before, and the card is moved

#### Scenario: Repeated save
- **WHEN** the same attempt is recorded twice
- **THEN** one log row exists

#### Scenario: Log update rejected
- **WHEN** alice updates her own practice log row
- **THEN** no rows are changed

### Requirement: Practice data is private
Practice cards and practice logs SHALL have `user_id` and RLS: a user SHALL read and write only their own rows, SHALL NOT delete any row, and SHALL attach a practice card only to their own word and a practice log only to their own practice card.

#### Scenario: Cross-user read
- **WHEN** bob selects practice cards and logs
- **THEN** none of alice's rows are returned

#### Scenario: Log on another user's card
- **WHEN** bob records an attempt for alice's practice card
- **THEN** the call fails and alice's card and logs are unchanged

### Requirement: Practice summary
After the last card the page SHALL show the number of attempts rated, how many were rated Again or Hard, the next practice due time when there is one, and a link to Home.

#### Scenario: Summary
- **WHEN** the user rates 4 attempts, one of them Again
- **THEN** the summary shows 4 attempts and 1 rated Again or Hard

### Requirement: Practice keyboard use
Every action on the Practice page SHALL work from the keyboard: Enter to submit and to continue, 1 to 4 to rate, Escape to end the session. Digit keys in the feedback step SHALL NOT type into the sentence field.

#### Scenario: Keyboard session
- **WHEN** the user practises one card using only the keyboard
- **THEN** the attempt is recorded and the summary is shown
