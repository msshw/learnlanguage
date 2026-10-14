## ADDED Requirements

### Requirement: Add word shortcut
On every page that shows the sidebar, pressing Alt+A (the physical A key, with no other modifier) SHALL open the Add word page, also while a text field has focus. On the Add word page itself it SHALL do nothing. The shortcut SHALL NOT insert a character into a field.

#### Scenario: From Home
- **WHEN** the user presses Alt+A on Home
- **THEN** the Add word page opens

#### Scenario: While typing an answer
- **WHEN** the user presses Alt+A with the answer field focused on Review
- **THEN** the Add word page opens and no character is typed

#### Scenario: On Add word
- **WHEN** the user presses Alt+A on Add word
- **THEN** nothing changes

#### Scenario: Other modifiers
- **WHEN** the user presses Ctrl+Alt+A or Alt+Shift+A
- **THEN** nothing happens

#### Scenario: Sign-in and Setup
- **WHEN** the user presses Alt+A on the sign-in or Setup page
- **THEN** nothing happens

## REMOVED Requirements

### Requirement: Placeholder pages
**Reason**: Settings is built in this change, so no placeholder page remains.
**Migration**: The Settings page contents are specified in the `settings` capability.
