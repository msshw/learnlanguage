## ADDED Requirements

### Requirement: Admin navigation entry
For a user whose profile is marked admin, the sidebar SHALL show an "Admin" link to `/admin.html` after Settings, with the shortcut Alt+M, its key chip and an icon, following the rules of the other sidebar links. For any other user the link SHALL NOT be shown and Alt+M SHALL do nothing. The link SHALL be marked as current on the admin page.

#### Scenario: Admin sees the link
- **WHEN** an admin opens Home
- **THEN** an "Admin" link is shown after Settings

#### Scenario: Others do not
- **WHEN** a user who is not an admin opens Home
- **THEN** no "Admin" link is shown and Alt+M does nothing

#### Scenario: Shortcut
- **WHEN** an admin presses Alt+M on Words
- **THEN** the admin page opens
