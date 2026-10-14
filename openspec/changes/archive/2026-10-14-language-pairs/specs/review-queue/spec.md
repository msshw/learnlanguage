## MODIFIED Requirements

### Requirement: New cards and the daily limit
After the due cards, the queue SHALL contain `forward` cards in state `new`, oldest due time first, up to the active pair's new words per day minus the words of the active pair introduced today. A word is introduced today when its `forward` card had its first review on the current logical day, counting answers still waiting to be saved. Words introduced in another pair SHALL NOT count. The remaining allowance SHALL never be negative.

#### Scenario: Limit applies
- **WHEN** the limit is 10, 3 words were introduced today and 20 new `forward` cards exist
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

#### Scenario: Other pair does not count
- **WHEN** the `fr`/`en` pair's limit is 5, 10 words of the `de`/`en` pair were introduced today and no `fr`/`en` word was, and `fr`/`en` is active
- **THEN** 5 new `fr`/`en` cards are in the queue

#### Scenario: Each pair its own limit
- **WHEN** the `de`/`en` limit is 10 and the `fr`/`en` limit is 3, and `fr`/`en` is active with 20 new `forward` cards
- **THEN** 3 new cards are in the queue

### Requirement: New en_de cards
A `new` `reverse` card SHALL join the queue only when its due time is before the start of the next day, its `forward` card is no longer `new`, and the `forward` card was last reviewed before the current day started. New `reverse` cards SHALL not count against, and SHALL not be limited by, the daily limit. They SHALL be placed after the due cards and before the new `forward` cards, ordered by due time.

#### Scenario: Day after introduction
- **WHEN** a word's `forward` card was first reviewed yesterday and its `reverse` card is due today
- **THEN** the `reverse` card is in the queue

#### Scenario: Same day as introduction
- **WHEN** a word's `forward` card was reviewed earlier today
- **THEN** its new `reverse` card is not in the queue

#### Scenario: Sibling not introduced
- **WHEN** a word's `forward` card is still `new`
- **THEN** its new `reverse` card is not in the queue
