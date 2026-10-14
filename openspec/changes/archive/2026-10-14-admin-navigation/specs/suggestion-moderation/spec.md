## MODIFIED Requirements

### Requirement: Admin review page
The site SHALL serve the Reports page at `/admin.html` with the main sidebar and the admin sub-navigation (see the `admin-views` capability). The page SHALL list every suggestion that has open reports, oldest first report first. Each entry SHALL show the corrected term, the language pair, the number of open reports, the time of the first open report, every reason (as text), and every sense shown as on the Add word sense list together with its state (candidate, confirmed or rejected) and, for a sense that is not rejected, whether an admin has judged it ("Judged" or "Not judged"). Each sense that is not rejected SHALL offer "Approve as is", "Edit and approve" and "Reject". Each entry SHALL offer "Remove suggestion". With no open reports the page SHALL show "No open reports". For a signed-in user who is not an admin it SHALL show "Not available" and no data. If the list fails to load it SHALL show an inline message and a "Retry" button. All suggestion and report text SHALL be inserted as text. The "Rejected" list (see "Rejected senses list") is its own page, `/admin-rejected.html`.

#### Scenario: Admin sees a report
- **WHEN** alice reported the `Bank` suggestion with a reason and the admin opens the page
- **THEN** an entry for `Bank` with 1 open report, the reason, both senses and their states is shown

#### Scenario: Judged label
- **WHEN** a sense was confirmed by a user's unchanged save and no admin has acted on it
- **THEN** the entry shows it as confirmed and "Not judged"

#### Scenario: Reason is text
- **WHEN** a reason contains `<b>x</b>`
- **THEN** the page shows the characters literally and renders no element

#### Scenario: Nothing open
- **WHEN** there are no open reports
- **THEN** "No open reports" is shown

#### Scenario: Not an admin
- **WHEN** bob, who is not an admin, opens `/admin.html`
- **THEN** "Not available" is shown and no report or suggestion data is loaded

#### Scenario: Tabs
- **WHEN** an admin opens `/admin.html`
- **THEN** no tabs are shown; the sub-navigation links "Reports" (current) and "Rejected" are shown instead

#### Scenario: Rejected section loads on first use
- **WHEN** an admin selects "Rejected" in the sub-navigation
- **THEN** `/admin-rejected.html` opens and the rejected senses are requested then, not on the Reports page
