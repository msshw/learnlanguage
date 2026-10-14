# review-recording Specification

## Purpose
Defines how a confirmed answer changes a card's schedule and how it is written down. Every answer is logged exactly once, the card moves to its next state in the same step, and a failed save is never lost.

## Requirements

### Requirement: Scheduling
Given a card's state, a rating from 1 to 4 and the time of the answer, the scheduler SHALL return the card's next state using FSRS with default parameters and no random fuzz. The same inputs SHALL always give the same output, and the input SHALL not be modified. The next state SHALL set the last review time to the time of the answer and increase the repetition count by one.

#### Scenario: Ratings order the intervals
- **WHEN** the same review-state card is rated Again, Hard, Good and Easy at the same time
- **THEN** the resulting due times are in non-decreasing order from Again to Easy, and Easy is later than Again

#### Scenario: Lapse
- **WHEN** a review-state card is rated Again
- **THEN** its lapse count increases by one

#### Scenario: Deterministic
- **WHEN** the scheduler runs twice with identical inputs
- **THEN** both results are identical

#### Scenario: Learning position kept
- **WHEN** a card is scheduled and the result is scheduled again
- **THEN** the learning step position from the first result is the input of the second

### Requirement: Review log entry
Each confirmed answer SHALL append one review log row with the card, the time of the answer, the answer exactly as typed, the grader result, the final rating, whether the user changed the grader's rating, the card's FSRS state before the answer, and the time taken in milliseconds. Log rows SHALL never be updated or deleted.

#### Scenario: Override flag
- **WHEN** the grader suggested Good and the user confirmed Easy
- **THEN** the log row has rating 4 and overridden true

#### Scenario: State before
- **WHEN** an answer is recorded
- **THEN** the log row holds the card's state, due time, stability, difficulty, counters, learning step and last review as they were before the answer

### Requirement: Log and card change together
Recording an answer SHALL append the log row and update the card to its next state in one step. If either part fails, neither SHALL be saved.

#### Scenario: Both saved
- **WHEN** an answer is recorded successfully
- **THEN** the card holds the next state and one new log row exists

#### Scenario: Neither saved
- **WHEN** recording fails
- **THEN** the card is unchanged and no log row is added

### Requirement: Recording can be repeated safely
Recording the same answer again (same card and answer time) SHALL not add another log row or change the card again. An answer older than the card's last review SHALL still be logged but SHALL not change the card.

#### Scenario: Retried answer
- **WHEN** the same answer is recorded twice
- **THEN** exactly one log row exists for it

#### Scenario: Late arrival
- **WHEN** an older answer is recorded after a newer answer for the same card
- **THEN** both are logged and the card keeps the newer answer's state

### Requirement: Pending list
When recording fails, the answer SHALL be kept in a list stored in the browser and the session SHALL continue. The list SHALL survive a page reload. Pending answers SHALL be retried in the order they were given: right after the failure, after the next confirmed answer, every 15 seconds while the Review page is open, and when Home or Review loads. A successful retry SHALL remove the answer from the list.

#### Scenario: Offline answer
- **WHEN** recording fails because the network is down
- **THEN** the answer is in the pending list and the next card is shown

#### Scenario: Survives reload
- **WHEN** the page is reloaded with pending answers
- **THEN** they are retried when the page loads

#### Scenario: Retry succeeds
- **WHEN** a retry succeeds
- **THEN** the answer leaves the list and its card and log are saved

### Requirement: Unsaved banner
When any pending answer has failed 3 attempts, the Review and Home pages SHALL show a banner saying some answers are not saved yet. The banner SHALL disappear when no pending answer has 3 or more failed attempts.

#### Scenario: Banner after three failures
- **WHEN** a pending answer fails its third attempt
- **THEN** the banner is shown

#### Scenario: Banner clears
- **WHEN** the last failing answer is saved
- **THEN** the banner is hidden

### Requirement: Storage unavailable
If browser storage cannot be used, pending answers SHALL be kept in memory for the life of the page, and the banner rules SHALL still apply.

#### Scenario: Storage blocked
- **WHEN** browser storage throws on read or write
- **THEN** a failed answer is kept in memory and retried
