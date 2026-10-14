## MODIFIED Requirements

### Requirement: Term step
The Add word page SHALL start with a term field focused on load and a "Check word" button. The field SHALL have focus once the page is shown, without a click, also when the page was opened by a shortcut. Pressing Enter in the field or the button SHALL continue to the duplicate check, then to suggestions. An empty term (after trimming) SHALL show an inline error and not continue.

#### Scenario: Focused on load
- **WHEN** the Add word page finishes loading
- **THEN** the term field has focus and typed characters go into it

#### Scenario: Focused after a shortcut
- **WHEN** the user opens Add word with Alt+A from Home and starts typing
- **THEN** the characters go into the term field

#### Scenario: Enter continues
- **WHEN** the user types `Haus` and presses Enter
- **THEN** suggestions are requested for `Haus`

#### Scenario: Empty term
- **WHEN** the user presses Enter with an empty or whitespace-only term
- **THEN** an inline error is shown, the form stays hidden and no suggestions are requested
