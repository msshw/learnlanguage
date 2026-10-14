## MODIFIED Requirements

### Requirement: Practice queue
The practice queue SHALL contain, for active words of the active pair only: first the practice cards that are not new and are due, most overdue first; then new practice cards, oldest word first, up to 5 new practice cards introduced per logical day in the active pair (04:00 rollover in the profile timezone). Practice in another pair SHALL NOT count toward this limit. A new practice card SHALL be eligible only when the word's `forward` review card is in state `review`. Practice cards of soft-deleted words SHALL be excluded. The queue SHALL be built once when the session starts and each card SHALL appear once per session.

#### Scenario: Due first
- **WHEN** two practice cards are due, one overdue by 3 days and one by 1 day, and new cards are eligible
- **THEN** the 3-day card comes first, then the 1-day card, then the new cards

#### Scenario: Daily new limit
- **WHEN** 5 new practice cards were already practised today and more are eligible
- **THEN** no new practice card is in the queue

#### Scenario: Not learned yet
- **WHEN** a word's `forward` review card is in state `new` or `learning`
- **THEN** its new practice card is not in the queue

#### Scenario: Deleted word
- **WHEN** a word with a due practice card is soft deleted
- **THEN** its practice card is not in the queue

#### Scenario: Limit per pair
- **WHEN** 5 new practice cards of the `de`/`en` pair were practised today and the user switches to `fr`/`en` with eligible new cards
- **THEN** up to 5 new `fr`/`en` practice cards are in the queue
