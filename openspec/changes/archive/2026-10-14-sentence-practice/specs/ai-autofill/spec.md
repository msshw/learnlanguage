## MODIFIED Requirements

### Requirement: Monthly spending cap
Before calling the model the function SHALL compute this calendar month's (UTC) cost from all of the user's `ai_calls` rows, of every kind (`autofill` and `sentence_check`), using per-token prices from one configuration constant shared by all AI edge functions. At $2.00 or more it SHALL return status `over_cap` without calling the model. Below $2.00 it SHALL proceed. The cost of failed calls with tokens SHALL count. The usage request SHALL report the same total.

#### Scenario: Under the cap
- **WHEN** the month's cost is $1.99
- **THEN** the model is called

#### Scenario: At the cap
- **WHEN** the month's cost is $2.00
- **THEN** status is `over_cap` and the model is not called

#### Scenario: Sentence checks count
- **WHEN** the month's autofill calls cost $1.50 and sentence checks cost $0.50
- **THEN** an autofill request returns `over_cap` and the usage request reports $2.00

#### Scenario: New month
- **WHEN** the month changes
- **THEN** earlier months' calls no longer count

#### Scenario: Other users do not count
- **WHEN** another user has spent $2.00 this month
- **THEN** the current user is not capped
