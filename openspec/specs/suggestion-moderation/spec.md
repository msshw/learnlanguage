# suggestion-moderation Specification

## Purpose
Lets users report a wrong shared AI suggestion with a reason, and lets the admin judge each sense of a reported suggestion (approve, edit, reject) so that good senses are marked verified and bad ones are never suggested again. Reports stay open until every sense has been judged. A second section lists rejected senses and lets the admin allow one again.

## Requirements

### Requirement: Suggestion reports
A signed-in user SHALL be able to report a stored suggestion by its id with a reason. The reason SHALL be plain text of at least 50 and at most 2000 characters after trimming; the function SHALL reject a shorter or longer reason. A report SHALL record the reporting user, the suggestion, the reason and the time, and SHALL start open. The reporter SHALL NOT name a sense. A user SHALL have at most one report per suggestion; reporting the same suggestion again SHALL succeed without adding a second report or changing the first reason.

#### Scenario: Report recorded
- **WHEN** alice reports the suggestion she was shown for `Bank` with a 70-character reason
- **THEN** one open report by alice with that reason exists for that suggestion

#### Scenario: Reason too short
- **WHEN** alice sends a report with a 30-character reason
- **THEN** no report is stored

#### Scenario: Reported twice
- **WHEN** alice reports the same suggestion again
- **THEN** the request succeeds and still one report by alice exists, with the first reason

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

### Requirement: Approve a sense as is
"Approve as is" on a sense SHALL set that sense to confirmed and leave its content unchanged. It SHALL succeed on a candidate or a confirmed sense, and SHALL mark the sense as judged. Open reports are closed only as described in "Closing reports".

#### Scenario: Approve a candidate sense
- **WHEN** the admin approves sense 2 of a candidate `Bank` suggestion
- **THEN** sense 2 is confirmed and judged, sense 1 keeps its state and judged flag, and the open reports stay open while sense 1 is not judged

#### Scenario: User-confirmed sense still needs the admin
- **WHEN** sense 1 was confirmed by a user's unchanged save and the admin has not acted on it
- **THEN** it counts as not judged; approving it as is marks it judged

#### Scenario: Cache starts serving
- **WHEN** the admin approves one sense of a candidate and bob then requests `Bank`
- **THEN** bob gets all non-rejected senses of that suggestion and no model call is made

### Requirement: Edit and approve a sense
"Edit and approve" on a sense SHALL open a form with that sense's term, part of speech, translations, hint, forms and examples, built from the same pieces as the Add word form and without notes and tags. Saving SHALL send the edited sense to the server, which SHALL check it with the same validation as a model-produced sense and either store it in place of the old sense as confirmed or answer with an error and change nothing. This SHALL be one step: there is no separate approve after an edit. When the edited sense is the first sense, the suggestion's corrected-term key SHALL follow its term. The stored sense SHALL be marked judged. Open reports are closed only as described in "Closing reports".

#### Scenario: Edit fixes a plural
- **WHEN** the admin changes the plural of sense 1 and saves
- **THEN** the stored sense has the new plural, is confirmed and judged

#### Scenario: Invalid edit
- **WHEN** the admin saves a noun sense without an article
- **THEN** an error is shown, the stored sense is unchanged and the reports stay open

#### Scenario: Corrected term follows
- **WHEN** the admin changes the term of sense 1 from `Bank` to `Bänke`
- **THEN** the suggestion is found by the key `bänke`

### Requirement: Reject a sense
"Reject" on a sense SHALL set it to rejected and remember it as rejected forever (see ai-suggestion-cache). A rejected sense SHALL never be served by a lookup and SHALL NOT be confirmable. A rejected sense counts as judged. Open reports are closed only as described in "Closing reports". Words that users already saved SHALL NOT change.

#### Scenario: Rejected sense hidden
- **WHEN** the admin rejects sense 2 of the confirmed `Bank` suggestion and bob requests `Bank`
- **THEN** bob gets only the senses that are not rejected

#### Scenario: Confirm after rejection
- **WHEN** a confirm arrives for a rejected sense
- **THEN** the response is `{status: "error"}` and the sense stays rejected

#### Scenario: Saved words kept
- **WHEN** a sense that bob saved a word from is rejected
- **THEN** bob's word is unchanged

### Requirement: Remove a suggestion
"Remove suggestion" SHALL reject every sense of the suggestion, remember each as rejected forever, and close all its open reports as removed, in one step, whatever the senses' earlier states. The next lookup for its terms SHALL be a miss that calls the model with the rejected senses listed as not to be suggested.

#### Scenario: Next lookup is fresh
- **WHEN** the admin removes the confirmed `Bank` suggestion and bob then requests `Bank`
- **THEN** the model is called, none of the removed senses is returned, and a new candidate is stored

#### Scenario: Reports closed
- **WHEN** the admin removes a suggestion with two open reports
- **THEN** both reports are closed as removed

### Requirement: Judged senses and closing reports
A sense SHALL count as judged when it is rejected, or when an admin has approved it as is or saved an edit of it in this moderation (a judged flag stored on the sense, set only by the admin function). A sense that is confirmed because a user saved it unchanged SHALL count as not judged until an admin approves or edits it. A new candidate record has no judged sense. Judging SHALL NOT be undone by later user confirms.

An entry SHALL stay on the list while it has an open report and at least one of its non-rejected senses is not judged. After every admin action on a suggestion (approve, edit, reject of a sense, or remove), in the same step as the change, the server SHALL check the suggestion: when no non-rejected sense is left that is not judged (every sense is judged, or the record was removed), it SHALL close all the suggestion's open reports; otherwise the reports SHALL stay open. The stored resolution SHALL be the action that completed the judging: `approved`, `edited`, `rejected` or `removed`. Removing a suggestion always closes its reports as `removed`. An approve of an already judged sense still runs the check, so an entry whose senses are all judged (for example after a late report) can be closed by approving a sense. After each action the entry SHALL be re-rendered in place from the response, showing the new sense states, judged labels and whether the reports are closed; a closed entry SHALL leave the list on the next load. A failed action SHALL change nothing, including the reports.

#### Scenario: First action leaves the entry open
- **WHEN** a suggestion has two open reports and two unjudged senses and the admin rejects one sense
- **THEN** that sense is rejected, the other is unjudged, both reports stay open and the entry stays listed

#### Scenario: Last judgment closes
- **WHEN** the admin then approves the remaining sense
- **THEN** both reports are closed with resolution `approved` and the entry shows "Reports closed"

#### Scenario: Edit completes the judging
- **WHEN** the only unjudged sense is edited and saved
- **THEN** the reports are closed as `edited`

#### Scenario: Remove closes at once
- **WHEN** the admin removes a suggestion with unjudged senses and two open reports
- **THEN** both reports are closed as `removed`

#### Scenario: Earlier user confirm is not a judgment
- **WHEN** one sense was confirmed by a user's save and the admin rejects the other sense
- **THEN** the reports stay open until the admin approves or edits the user-confirmed sense

#### Scenario: Failed action
- **WHEN** an action fails
- **THEN** the sense states and judged flags are unchanged and the reports stay open

### Requirement: Rejected senses list
The "Rejected" section SHALL list the senses in the `rejected_senses` store, newest rejection first, whether or not the suggestion they came from still exists. Rows that one rejection stored for the same sense under several lookup keys (the entered-term key and the corrected-term key) SHALL appear as one entry. An entry is the rows with the same language pair, the same fingerprint and the same creation time (rows written by one moderation step share it). Each entry SHALL show the term (its lookup keys, joined with " / " when there are two), the language pair, the part of speech, the translations and the time it was rejected. With nothing rejected the section SHALL show "No rejected senses". If the list fails to load it SHALL show an inline message and a "Retry" button. All text SHALL be inserted as text. The list SHALL be capped at 500 stored rows.

#### Scenario: One entry for two keys
- **WHEN** a sense was rejected on a suggestion whose entered key is `bank` and corrected key is `banke`
- **THEN** one entry for that sense is listed, with both keys shown

#### Scenario: Suggestion gone
- **WHEN** the suggestion a rejected sense came from no longer exists
- **THEN** the sense is still listed

#### Scenario: Nothing rejected
- **WHEN** the store is empty
- **THEN** "No rejected senses" is shown

### Requirement: Allow a rejected sense again
Each entry in the "Rejected" section SHALL offer "Allow again". The request SHALL carry only the identifiers of the stored rows of that entry; the server SHALL take everything else (language pair, fingerprint, keys, the suggestions to change) from the database. In one step the server SHALL delete those rows from the store and, in every suggestion of that language pair whose entered-term key or corrected-term key is one of the entry's keys, set each rejected sense with the entry's fingerprint back to `candidate` and not judged, then recompute the suggestion's status (confirmed when at least one sense is confirmed, otherwise candidate). Senses with another fingerprint, other suggestions and users' saved words SHALL NOT change. A suggestion that was removed by the first version (marked deleted) keeps its deletion mark; its senses are restored in the same way, but it is still not served because a lookup needs a confirmed sense and an unmarked suggestion. After the step the model MAY suggest the sense again and it SHALL return as an unverified candidate. On success the entry SHALL leave the list and the "Open reports" section SHALL be reloaded when next selected. A failed action SHALL change nothing and show "Could not allow the sense again". Reports are not reopened or closed by this action.

#### Scenario: Allowed again
- **WHEN** the admin selects "Allow again" on the entry for `noun: bank, financial institution`
- **THEN** its rows are gone from the store, the entry leaves the list, and the matching rejected senses of the suggestions for its keys are candidates that are not judged

#### Scenario: Status recomputed
- **WHEN** a suggestion has one confirmed sense and one rejected sense that is allowed again
- **THEN** its status stays confirmed and the restored sense is a candidate

#### Scenario: Only that sense
- **WHEN** a suggestion has two rejected senses and one is allowed again
- **THEN** the other stays rejected and stays in the store

#### Scenario: Suggestion already gone
- **WHEN** an entry whose suggestion no longer exists is allowed again
- **THEN** its rows are removed from the store and nothing else changes

#### Scenario: Removed by the first version
- **WHEN** a sense of a suggestion with a deletion mark is allowed again
- **THEN** the sense is a candidate, the mark stays, and a lookup for the term is still a miss

#### Scenario: Model may suggest it again
- **WHEN** bob requests `Bank` after the sense was allowed again and the model returns it
- **THEN** it is stored as an unverified candidate and returned

#### Scenario: Failed action
- **WHEN** the request names a row that is not in the store
- **THEN** the response is `{status: "error"}` and nothing changes

### Requirement: Admin actions go through the admin function
Listing reports, listing rejected senses, allowing a sense again and every sense action SHALL be done only by an `admin` edge function. It SHALL reject a request without a valid session, and SHALL answer a caller whose profile is not marked admin with a forbidden error and no data, without changing anything. The admin status SHALL be read on the server for every request, never taken from the request. Ids, sense indexes and rejected-sense ids in a request SHALL be checked; an unknown suggestion or an out-of-range index SHALL be answered `{status: "error"}` and change nothing.

#### Scenario: Non-admin call
- **WHEN** bob posts a reject action to the admin function
- **THEN** the response is forbidden and nothing changes

#### Scenario: No session
- **WHEN** a request without a session reaches the admin function
- **THEN** it is rejected

#### Scenario: Out of range
- **WHEN** the admin sends sense index 5 for a suggestion with two senses
- **THEN** the response is `{status: "error"}` and nothing changes

#### Scenario: Non-admin allow again
- **WHEN** bob posts an allow-again action to the admin function
- **THEN** the response is forbidden and nothing changes

### Requirement: Reports closed by the first version are reopened
When the per-sense rules are introduced, a closed report SHALL be reopened (no closing time, no resolution) when its suggestion has a non-rejected sense that is not judged. A closed report whose suggestion has no such sense SHALL stay closed.

#### Scenario: Legacy kept report reopens
- **WHEN** a report was closed as `kept` by the first version and no sense of its suggestion has been judged
- **THEN** after the migration the report is open again and the entry is listed

#### Scenario: Legacy removed report stays closed
- **WHEN** a report was closed as `removed` on a suggestion the first version deleted
- **THEN** after the migration every sense is rejected and the report stays closed
