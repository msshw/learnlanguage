## ADDED Requirements

### Requirement: Report a suggestion
When the sense list shows senses that come with a suggestion id, the page SHALL show a "Report suggestion" button below the senses, also after a sense is picked. Pressing it SHALL show a reason field (plain text, with a character count) and a "Send report" button; "Send report" SHALL stay disabled until the reason has at least 50 characters after trimming, and the field SHALL accept at most 2000. The user SHALL NOT be asked which sense is wrong. Sending SHALL report that suggestion with the reason and, on success, replace the report controls with the text "Suggestion reported". On failure it SHALL show "Could not report the suggestion" inline and keep the reason and the controls. Reporting SHALL NOT change the form, the picked sense or the saved word. Without a suggestion id the button SHALL NOT be shown. The controls SHALL be reachable with Tab, and typing in the reason field SHALL NOT trigger the keys 1 to 3 or Enter of the sense list.

#### Scenario: Report from the sense list
- **WHEN** suggestions for `Bank` are shown, the user presses "Report suggestion", types a 60-character reason and presses "Send report"
- **THEN** a report with that reason is sent for that suggestion and "Suggestion reported" is shown

#### Scenario: Reason too short
- **WHEN** the reason has 49 characters
- **THEN** "Send report" is disabled and nothing is sent

#### Scenario: Typing digits
- **WHEN** the user types `1` in the reason field
- **THEN** no sense is picked

#### Scenario: Report after picking
- **WHEN** the user picks a sense and then reports with a valid reason
- **THEN** the report is sent and the filled form is unchanged

#### Scenario: Report fails
- **WHEN** the report request fails
- **THEN** "Could not report the suggestion" is shown, the reason stays and the controls stay

#### Scenario: No id
- **WHEN** the senses came without a suggestion id
- **THEN** no "Report suggestion" button is shown

#### Scenario: New lookup
- **WHEN** the user reports, then saves and looks up another word
- **THEN** the button is shown again for the new suggestions, with an empty reason
