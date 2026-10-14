## Purpose

Defines how a person proves who they are and how pages stay closed to anyone who has not. One account at a time signs in with email and password; new accounts cannot be created from the app.

## ADDED Requirements

### Requirement: Email and password sign-in
The sign-in page SHALL provide an email field, a password field and a "Sign in" button. A valid email and password SHALL start a session.

#### Scenario: Successful sign-in
- **WHEN** a user submits correct credentials
- **THEN** a session is stored and the user is taken to the return target

#### Scenario: Keyboard submit
- **WHEN** the user presses Enter in either field
- **THEN** the form is submitted

### Requirement: Inline sign-in error
When sign-in fails, the page SHALL show an error message next to the form without leaving the page and SHALL keep the entered email.

#### Scenario: Wrong password
- **WHEN** a user submits a wrong password
- **THEN** an inline error is shown, the email field keeps its value, the password field is cleared, and the user stays on the sign-in page

#### Scenario: Error clears on retry
- **WHEN** the user submits again after an error
- **THEN** the old error is removed before the new result is shown

#### Scenario: Button disabled while pending
- **WHEN** a sign-in request is in flight
- **THEN** the button is disabled so the form cannot be submitted twice

### Requirement: Session required on every other page
Every page except sign-in SHALL check for a session before showing content or loading data. Without a session it SHALL redirect to the sign-in page with a `returnTo` parameter holding the path and query of the page that was requested.

#### Scenario: Signed-out visit
- **WHEN** a signed-out user opens `/review.html`
- **THEN** the browser is redirected to `/signin.html` with `returnTo` set to `/review.html`

#### Scenario: Content hidden until checked
- **WHEN** a signed-out user opens a protected page
- **THEN** no protected content is visible before the redirect

#### Scenario: Signed-in visit
- **WHEN** a signed-in user opens a protected page
- **THEN** the page renders normally with no redirect

### Requirement: Return after sign-in
After a successful sign-in the app SHALL send the user to `returnTo` when it is a safe same-origin path, and to Home otherwise.

#### Scenario: Valid returnTo
- **WHEN** a user signs in from `/signin.html?returnTo=/review.html`
- **THEN** the user lands on `/review.html`

#### Scenario: No returnTo
- **WHEN** a user signs in from `/signin.html` with no `returnTo`
- **THEN** the user lands on Home

#### Scenario: Unsafe returnTo
- **WHEN** `returnTo` is an absolute URL, starts with `//`, or points at the sign-in page
- **THEN** it is ignored and the user lands on Home

### Requirement: Sign-out
The app SHALL provide a sign-out operation that ends the session. A user without a session SHALL be treated as signed out on the next page load.

#### Scenario: Sign-out ends the session
- **WHEN** sign-out completes
- **THEN** opening a protected page redirects to sign-in

### Requirement: Sign-ups disabled
The backend SHALL reject new account creation. Only accounts created by the operator can sign in.

#### Scenario: Sign-up attempt
- **WHEN** a client calls the sign-up endpoint with a new email
- **THEN** the request is rejected and no user is created

### Requirement: Client holds only public config
The client SHALL be configured with the Supabase URL and anon key only. No service-role key or AI key SHALL appear in the repo or the client bundle.

#### Scenario: Bundle check
- **WHEN** the built files are searched for a service-role key
- **THEN** none is found
