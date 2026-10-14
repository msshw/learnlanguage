## ADDED Requirements

### Requirement: AI usage summation is service-only
The database SHALL provide a function that returns the summed input tokens and output tokens of a given user's `ai_calls` rows created at or after a given time. It SHALL be executable by the service role only; signed-in and anonymous users SHALL NOT be able to call it. `ai_calls` rows SHALL stay readable by their owner and writable only by the service role.

#### Scenario: Sum for a user
- **WHEN** alice has `ai_calls` rows before and after the start time
- **THEN** the function returns the sums of the rows at or after the start time and none of bob's

#### Scenario: No rows
- **WHEN** the user has no matching rows
- **THEN** the sums are zero

#### Scenario: Called by a user
- **WHEN** a signed-in user or an anonymous client calls the function
- **THEN** the call is rejected

#### Scenario: User writes to ai_calls
- **WHEN** a signed-in user inserts into `ai_calls`
- **THEN** the insert is rejected
