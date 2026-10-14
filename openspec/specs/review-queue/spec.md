# review-queue Specification

## Purpose
Defines which cards make up a review session and what counts as "today". The rules keep daily use predictable: due cards first, a capped number of new words, and never both cards of one word at once.

## Requirements

### Requirement: The logical day
A day SHALL start at 04:00 in the profile's timezone and end at the next 04:00. Local times before 04:00 belong to the previous day. The day that contains a daylight-saving change SHALL still run from 04:00 to 04:00 local time, so it may last 23 or 25 hours.

#### Scenario: Just before rollover
- **WHEN** the local time in Europe/Berlin is 03:59 on 12 October
- **THEN** the current day started at 04:00 on 11 October

#### Scenario: At rollover
- **WHEN** the local time is 04:00 on 12 October
- **THEN** the current day started at 04:00 on 12 October

#### Scenario: Spring forward
- **WHEN** it is 00:00 UTC on 29 March 2026 (01:00 in Europe/Berlin, before the clocks jump)
- **THEN** the current day started at 04:00 local time on 28 March and the next day starts at 04:00 local time on 29 March, 23 hours later

#### Scenario: Fall back
- **WHEN** it is 22:30 UTC on 24 October 2026 (00:30 on 25 October in Europe/Berlin, before the clocks go back)
- **THEN** the current day started at 04:00 local time on 24 October and the next day starts at 04:00 local time on 25 October, 25 hours later

#### Scenario: Another timezone
- **WHEN** the profile timezone is America/New_York
- **THEN** the day boundaries are computed at 04:00 New York time

### Requirement: Due cards
A card SHALL be due when its state is `review` and its due time is before the start of the next day, or when its state is `learning` or `relearning` and its due time is not after now. Due cards SHALL be ordered most overdue first (earliest due time first).

#### Scenario: Review card due later today
- **WHEN** it is 09:00 and a `review` card is due at 14:00 the same day
- **THEN** the card is in the queue

#### Scenario: Review card due after rollover
- **WHEN** a `review` card is due after the start of the next day
- **THEN** the card is not in the queue

#### Scenario: Learning card not ready
- **WHEN** a `learning` card is due in ten minutes
- **THEN** the card is not in the queue

#### Scenario: Ordering
- **WHEN** two due cards are due yesterday and two days ago
- **THEN** the card due two days ago comes first

### Requirement: New cards and the daily limit
After the due cards, the queue SHALL contain `de_en` cards in state `new`, oldest due time first, up to the profile's new words per day minus the words introduced today. A word is introduced today when its `de_en` card had its first review on the current logical day, counting answers still waiting to be saved. The remaining allowance SHALL never be negative.

#### Scenario: Limit applies
- **WHEN** the limit is 10, 3 words were introduced today and 20 new `de_en` cards exist
- **THEN** 7 new cards are in the queue, the oldest first

#### Scenario: Limit reached
- **WHEN** the limit is 10 and 10 words were introduced today
- **THEN** no new cards are in the queue

#### Scenario: Limit zero
- **WHEN** the limit is 0
- **THEN** no new cards are in the queue

#### Scenario: Unsaved introductions count
- **WHEN** a new card was answered but its save is still pending
- **THEN** that word counts as introduced today

### Requirement: New en_de cards
A `new` `en_de` card SHALL join the queue only when its due time is before the start of the next day, its `de_en` card is no longer `new`, and the `de_en` card was last reviewed before the current day started. New `en_de` cards SHALL not count against, and SHALL not be limited by, the daily limit. They SHALL be placed after the due cards and before the new `de_en` cards, ordered by due time.

#### Scenario: Day after introduction
- **WHEN** a word's `de_en` card was first reviewed yesterday and its `en_de` card is due today
- **THEN** the `en_de` card is in the queue

#### Scenario: Same day as introduction
- **WHEN** a word's `de_en` card was reviewed earlier today
- **THEN** its new `en_de` card is not in the queue

#### Scenario: Sibling not introduced
- **WHEN** a word's `de_en` card is still `new`
- **THEN** its new `en_de` card is not in the queue

### Requirement: One card per word
A queue SHALL contain at most one card per word. When both cards of a word qualify, the one earlier in queue order SHALL be kept and the other SHALL wait for a later session.

#### Scenario: Both due
- **WHEN** both cards of a word are due
- **THEN** only the more overdue card is in the queue

### Requirement: Excluded cards
Cards of deleted words SHALL never be in the queue. Cards with an answer waiting to be saved SHALL not be in the queue.

#### Scenario: Deleted word
- **WHEN** a word is deleted
- **THEN** its due cards are not in the queue

#### Scenario: Pending answer
- **WHEN** a card has an unsaved answer
- **THEN** the card is not in the queue

### Requirement: Review status for Home
The system SHALL derive from the same inputs: the number of cards in the queue, whether any answer was given on the current logical day, and the next time a currently unavailable card will join the queue. That time SHALL be the earliest of: the due time of a `learning` or `relearning` card not yet due, the start of the day containing the due time of a `review` card not yet in the queue, and the start of the next day when a new card is waiting beyond the limit or the sibling rule.

#### Scenario: Next review card tomorrow afternoon
- **WHEN** the only unavailable card is a `review` card due tomorrow at 14:00
- **THEN** the next due time is 04:00 tomorrow

#### Scenario: Waiting new cards
- **WHEN** the daily limit is reached and new cards remain
- **THEN** the next due time is the start of the next day

#### Scenario: No other cards
- **WHEN** every card is already in the queue or none exists
- **THEN** there is no next due time
