## MODIFIED Requirements

### Requirement: Sidebar navigation
Every page except sign-in and Setup SHALL show a left sidebar with links, in this order, to Home, Review, Add word, Words and Settings. The link for the current page SHALL be marked as current.

#### Scenario: Current page is marked
- **WHEN** the Words page is open
- **THEN** the Words link is marked as the current page and no other link is

#### Scenario: Sign-in has no sidebar
- **WHEN** the sign-in page is open
- **THEN** no sidebar is shown

#### Scenario: Setup has no sidebar
- **WHEN** the Setup page is open
- **THEN** no sidebar is shown

#### Scenario: Narrow screen
- **WHEN** the viewport is narrow (phone width)
- **THEN** the navigation links are still reachable and nothing is cut off

### Requirement: Home empty state
The Home page SHALL show the "No words yet" empty state with a link labelled "Add word" when the user has no active words. When the user has active words it SHALL instead show the word count ("1 word", "N words") and an "Add word" link, and SHALL NOT show "No words yet".

#### Scenario: Empty state shown
- **WHEN** a signed-in user with no active words opens Home
- **THEN** the text "No words yet" and an "Add word" link are visible

#### Scenario: Count shown
- **WHEN** a signed-in user with three active words opens Home
- **THEN** "3 words" and an "Add word" link are visible and "No words yet" is not

#### Scenario: Singular
- **WHEN** the user has one active word
- **THEN** "1 word" is shown

#### Scenario: Add word link works
- **WHEN** the user follows the "Add word" link
- **THEN** the Add word page opens

### Requirement: Placeholder pages
The Review and Settings pages SHALL each show a heading and one line stating the page is not built yet, and SHALL contain no feature behavior.

#### Scenario: Placeholder content
- **WHEN** a signed-in user opens the Settings page
- **THEN** a heading and a single placeholder line are shown inside the layout
