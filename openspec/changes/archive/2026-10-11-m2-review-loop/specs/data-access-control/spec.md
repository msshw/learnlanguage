## ADDED Requirements

### Requirement: Cards store the learning step
Each card SHALL have a non-negative whole number `learning_steps`, default 0, holding its position within the FSRS learning steps.

#### Scenario: Default
- **WHEN** a card is created by saving a word
- **THEN** its `learning_steps` is 0

#### Scenario: Negative rejected
- **WHEN** a card is updated with a negative `learning_steps`
- **THEN** the update is rejected

### Requirement: One log row per card and answer time
`review_logs` SHALL reject a second row with the same `card_id` and `reviewed_at`.

#### Scenario: Duplicate row
- **WHEN** a second log row with the same card and answer time is inserted
- **THEN** the insert is rejected

### Requirement: Recording a review
A signed-in user SHALL be able to record a review for one of their own cards through a single database call that appends the log row and updates the card to its next state in one transaction. The log row's owner SHALL be the caller, whatever the call contains. The call SHALL not be available to anonymous users.

#### Scenario: Own card
- **WHEN** alice records a review for her card
- **THEN** one log row owned by alice exists and the card holds the new state

#### Scenario: Another user's card
- **WHEN** bob records a review for alice's card
- **THEN** the call fails and alice's card and logs are unchanged

#### Scenario: Repeated call
- **WHEN** the same call is made twice
- **THEN** one log row exists and the card state is that of the call

#### Scenario: Older answer
- **WHEN** a call carries an answer time earlier than the card's last review
- **THEN** a log row is added and the card is unchanged

#### Scenario: Anonymous
- **WHEN** a request without a session makes the call
- **THEN** it is rejected

#### Scenario: Owner forced
- **WHEN** a call names another user as the log owner
- **THEN** the log row is owned by the caller
