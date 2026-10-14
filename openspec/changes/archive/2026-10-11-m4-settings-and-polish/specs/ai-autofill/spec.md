## ADDED Requirements

### Requirement: Usage request
The `autofill` function SHALL answer a POST with a valid session and the body `{action: "usage"}` with `{status: "ok", spent_usd, cap_usd}`, where `spent_usd` is the caller's cost this calendar month (UTC), computed exactly as for the spending cap, and `cap_usd` is the monthly cap. It SHALL NOT call the model and SHALL NOT write an `ai_calls` row. It SHALL NOT apply the term and language checks of suggestion requests. Without a valid session it SHALL be rejected. If the spend cannot be read it SHALL answer `{status: "error"}`.

#### Scenario: Usage returned
- **WHEN** the user's calls this month cost $0.50
- **THEN** the response is `{status: "ok", spent_usd: 0.5, cap_usd: 2}`

#### Scenario: No model call
- **WHEN** a usage request is made
- **THEN** no model call happens and `ai_calls` has no new row

#### Scenario: Other users do not count
- **WHEN** another user has spent $1.00 this month
- **THEN** the caller's `spent_usd` does not include it

#### Scenario: No session
- **WHEN** a usage request has no valid session
- **THEN** it is rejected

#### Scenario: Spend unreadable
- **WHEN** reading the month's usage fails
- **THEN** the response is `{status: "error"}`
