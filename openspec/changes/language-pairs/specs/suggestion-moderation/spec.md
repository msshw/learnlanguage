## MODIFIED Requirements

### Requirement: Edit and approve a sense
"Edit and approve" on a sense SHALL open a form with that sense's term, part of speech, translations, hint, forms and examples, built from the same pieces as the Add word form and without notes and tags. The form SHALL show the fields and language labels of the suggestion's own language pair (its target's profile), not of the admin's active pair. Saving SHALL send the edited sense to the server, which SHALL read the suggestion's language pair from the database and check the sense with the same validation as a model-produced sense of that pair, and either store it in place of the old sense as confirmed or answer with an error and change nothing. This SHALL be one step: there is no separate approve after an edit. When the edited sense is the first sense, the suggestion's corrected-term key SHALL follow its term. The stored sense SHALL be marked judged and stored with the field names `hint_native`, `example_target` and `example_native`. Open reports are closed only as described in "Closing reports".

#### Scenario: Edit fixes a plural
- **WHEN** the admin changes the plural of sense 1 and saves
- **THEN** the stored sense has the new plural, is confirmed and judged

#### Scenario: Invalid edit
- **WHEN** the admin saves a noun sense of a `de`/`en` suggestion without an article
- **THEN** an error is shown, the stored sense is unchanged and the reports stay open

#### Scenario: Corrected term follows
- **WHEN** the admin changes the term of sense 1 from `Bank` to `Bänke`
- **THEN** the suggestion is found by the key `bänke`

#### Scenario: Generic pair edit
- **WHEN** the admin edits a noun sense of a `fr`/`en` suggestion while their own active pair is `de`/`en`
- **THEN** the form shows no article or plural field, and the saved sense has forms `{}`

#### Scenario: Forms rejected for a generic pair
- **WHEN** an edit request for a `fr`/`en` suggestion carries an article in `forms`
- **THEN** the server answers with an error and the stored sense is unchanged
