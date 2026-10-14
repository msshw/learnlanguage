## ADDED Requirements

### Requirement: Admin-only read actions
The `admin` function SHALL offer the read actions `list_users`, `list_ai_calls`, `list_suggestions` and `report_count`. Each SHALL pass the same checks as the other admin actions: session valid and `is_admin` read from the database on this request; otherwise 401 or 403 `{status: "forbidden"}` and no data. The three list actions SHALL take only `offset` from the body (an integer from 0, default 0) and SHALL return at most 50 rows in a fixed order with `has_more` true when a further row exists. `report_count` SHALL take nothing and return `{status: "ok", count}` with the number of suggestions that have at least one open report. A failed read SHALL return `{status: "error"}`. The SQL behind `list_users` and `list_ai_calls` SHALL be callable by the service role only.

#### Scenario: Non-admin refused
- **WHEN** bob, who is not an admin, sends `list_users`
- **THEN** the answer is 403 `{status: "forbidden"}` and no user data is returned

#### Scenario: No token
- **WHEN** `list_ai_calls` is sent without a token
- **THEN** the answer is 401

#### Scenario: Page size and more
- **WHEN** 60 AI calls exist and the admin sends `list_ai_calls` with offset 0
- **THEN** 50 rows are returned with `has_more` true, and offset 50 returns 10 rows with `has_more` false

#### Scenario: Report count
- **WHEN** two suggestions have open reports (one of them two) and a third has only closed reports
- **THEN** `report_count` returns count 2

#### Scenario: Users cannot call the SQL
- **WHEN** a signed-in user calls `admin_users` or `admin_ai_calls` through the data API
- **THEN** the call is refused

### Requirement: Users section
The Users page SHALL list accounts, newest signup first. Each row SHALL show email, signup date, last sign-in date (or "Never"), an "Admin" mark when the account is an admin, the number of non-deleted words, review logs and practice attempts, and this month's AI calls and cost in USD (calendar month, UTC, same prices as the cap). It SHALL NOT show or load any word text, sentence, review content or token values beyond the cost. With no accounts it SHALL show "No users".

#### Scenario: Counts
- **WHEN** alice has 3 words (one deleted), 5 review logs, 2 practice attempts and 4 AI calls this month
- **THEN** her row shows 2 words, 5 reviews, 2 practice attempts and 4 calls with their cost

#### Scenario: No private content
- **WHEN** the admin opens "Users"
- **THEN** the response and the page contain no word term, translation or sentence

#### Scenario: Never signed in
- **WHEN** an account has no sign-in time
- **THEN** its last sign-in shows "Never"

### Requirement: AI calls section
The AI calls page SHALL list logged AI calls, newest first. Each row SHALL show time, the user's email, kind (`autofill` or `sentence_check`), model, input tokens, output tokens, cost in USD, duration in ms and "OK" or "Failed". It SHALL NOT show the stored error text. With no calls it SHALL show "No AI calls".

#### Scenario: Row content
- **WHEN** alice made a successful `sentence_check` call with 800 input and 120 output tokens
- **THEN** the top row shows alice's email, `sentence_check`, 800, 120, the cost from the shared prices and "OK"

#### Scenario: Failed call
- **WHEN** a call was logged with `ok` false and an error text
- **THEN** its row shows "Failed" and not the error text

### Requirement: Suggestions section
The Suggestions page SHALL list shared suggestions, newest first. Each row SHALL show the corrected term, the language pair, the status (candidate or confirmed, "Removed" when marked deleted), the count of senses in each state (candidate, confirmed, rejected), the number of open reports and the creation date. It SHALL be read-only; moderation stays on the Reports and Rejected pages. With no suggestions it SHALL show "No suggestions".

#### Scenario: Sense counts
- **WHEN** a suggestion has two confirmed senses and one rejected sense
- **THEN** its row shows 0 candidate, 2 confirmed and 1 rejected

#### Scenario: Removed
- **WHEN** a suggestion is marked deleted
- **THEN** its row shows "Removed"

### Requirement: Admin sub-navigation
Every admin page SHALL show a second sidebar next to the main sidebar with five links, in this order: "Reports" (`/admin.html`), "Rejected" (`/admin-rejected.html`), "Suggestions" (`/admin-suggestions.html`), "AI calls" (`/admin-ai-calls.html`) and "Users" (`/admin-users.html`). Each link opens its own page; the link of the current page SHALL carry `aria-current="page"`. The second sidebar SHALL always be expanded (it does not collapse with the main sidebar). The "Admin" link in the main sidebar SHALL be marked current on all five pages. On a narrow screen the second sidebar SHALL become a horizontal strip above the page content. The "Reports" link SHALL show the number of suggestions with open reports as a count pill, read with `report_count` when the page loads and hidden when the number is 0 or the read fails. For a user who is not an admin every admin page SHALL show "Not available" and neither the second sidebar nor any data. In the other requirements, "section" for Open reports, Rejected, Suggestions, AI calls and Users means the matching page, which loads its data when it opens.

#### Scenario: Five links
- **WHEN** an admin opens `/admin-users.html`
- **THEN** the second sidebar shows Reports, Rejected, Suggestions, AI calls and Users in that order, and "Users" has `aria-current` page

#### Scenario: Own pages
- **WHEN** the admin selects "AI calls"
- **THEN** `/admin-ai-calls.html` opens and requests only `list_ai_calls` (and `report_count` for the pill)

#### Scenario: Open reports pill
- **WHEN** 3 suggestions have open reports and the admin opens any admin page
- **THEN** the "Reports" link shows 3

#### Scenario: No open reports
- **WHEN** no report is open
- **THEN** the "Reports" link shows no pill

#### Scenario: Main link stays current
- **WHEN** an admin is on `/admin-rejected.html`
- **THEN** the main sidebar's "Admin" link is marked current

#### Scenario: Not an admin
- **WHEN** bob, who is not an admin, opens `/admin-users.html`
- **THEN** "Not available" is shown, no second sidebar is shown and no admin data is requested

### Requirement: Paging and loading
Each of the Suggestions, AI calls and Users pages SHALL request its data when the page opens and SHALL show "Previous" and "Next" buttons that request the neighbouring 50 rows ("Previous" disabled at offset 0, "Next" disabled when `has_more` is false). A load failure SHALL show an inline message and a "Retry" button on that page. All values SHALL be inserted as text.

#### Scenario: Next page
- **WHEN** the admin selects "Next" on the AI calls page with more rows available
- **THEN** the rows from offset 50 are shown and "Previous" is enabled

#### Scenario: Load failure
- **WHEN** `list_users` fails
- **THEN** an inline message and "Retry" are shown on the Users page

#### Scenario: Email is text
- **WHEN** an email contains `<b>`
- **THEN** the page shows the characters literally and renders no element
