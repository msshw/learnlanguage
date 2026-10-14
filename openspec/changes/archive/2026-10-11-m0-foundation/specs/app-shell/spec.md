## Purpose

Defines the pages every signed-in user sees and the shared frame around them: one HTML page per screen, a left sidebar, and the Home empty state. Later milestones fill the placeholder pages.

## ADDED Requirements

### Requirement: One page per screen
The site SHALL serve these pages at the paths `/` (Home), `/signin.html`, `/setup.html`, `/review.html`, `/add.html`, `/words.html` and `/settings.html`, in both the dev server and the production build.

#### Scenario: Page is reachable by path
- **WHEN** a signed-in user opens `/review.html`
- **THEN** the Review page renders inside the shared layout

#### Scenario: Production build includes every page
- **WHEN** the site is built
- **THEN** the output contains an HTML file for each of the seven pages

### Requirement: Sidebar navigation
Every page except sign-in SHALL show a left sidebar with links, in this order, to Home, Review, Add word, Words and Settings. The link for the current page SHALL be marked as current.

#### Scenario: Current page is marked
- **WHEN** the Words page is open
- **THEN** the Words link is marked as the current page and no other link is

#### Scenario: Sign-in has no sidebar
- **WHEN** the sign-in page is open
- **THEN** no sidebar is shown

#### Scenario: Narrow screen
- **WHEN** the viewport is narrow (phone width)
- **THEN** the navigation links are still reachable and nothing is cut off

### Requirement: Home empty state
The Home page SHALL show the "No words yet" empty state with a link labelled "Add word" that opens the Add word page.

#### Scenario: Empty state shown
- **WHEN** a signed-in user opens Home
- **THEN** the text "No words yet" and an "Add word" link are visible

#### Scenario: Add word link works
- **WHEN** the user follows the "Add word" link
- **THEN** the Add word page opens

### Requirement: Placeholder pages
The Setup, Review, Add word, Words and Settings pages SHALL each show a heading and one line stating the page is not built yet, and SHALL contain no feature behavior.

#### Scenario: Placeholder content
- **WHEN** a signed-in user opens the Settings page
- **THEN** a heading and a single placeholder line are shown inside the layout

### Requirement: User content is inserted as text
Any user-supplied or server-supplied string shown on a page SHALL be inserted as text, never as HTML.

#### Scenario: Markup in an error message
- **WHEN** an error message contains `<b>x</b>`
- **THEN** the literal characters are displayed and no element is created
