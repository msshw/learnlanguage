## MODIFIED Requirements

### Requirement: Sign-out
The app SHALL provide a sign-out operation that ends the session, reachable from the "Sign out" button on Settings. A user without a session SHALL be treated as signed out on the next page load.

#### Scenario: Sign-out ends the session
- **WHEN** sign-out completes
- **THEN** opening a protected page redirects to sign-in

#### Scenario: Sign-out button
- **WHEN** the user presses "Sign out" on Settings
- **THEN** the session ends and the sign-in page opens
