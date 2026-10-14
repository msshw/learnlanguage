# app-shell Specification

## Purpose
Defines the pages every signed-in user sees and the shared frame around them: one HTML page per screen, a left sidebar, the Home states and the Add word shortcut.

## Requirements

### Requirement: One page per screen
The site SHALL serve these pages at the paths `/` (Home), `/signin.html`, `/setup.html`, `/review.html`, `/add.html`, `/words.html` and `/settings.html`, in both the dev server and the production build.

#### Scenario: Page is reachable by path
- **WHEN** a signed-in user opens `/review.html`
- **THEN** the Review page renders inside the shared layout

#### Scenario: Production build includes every page
- **WHEN** the site is built
- **THEN** the output contains an HTML file for each of the seven pages

### Requirement: Sidebar navigation
Every page except sign-in, Setup, Review and Practice SHALL show a left sidebar with links, in this order, to Home, Review, Practice, Add word, Words and Settings. Links added by other requirements SHALL follow Settings. The link for the current page SHALL be marked as current. The Practice link SHALL show the number of practice cards in the practice queue when it is above zero, the same way the Review link shows the review due count.

#### Scenario: Current page is marked
- **WHEN** the Words page is open
- **THEN** the Words link is marked as the current page and no other link is

#### Scenario: Practice link
- **WHEN** Home is open
- **THEN** a Practice link is shown between Review and Add word

#### Scenario: Practice count
- **WHEN** 3 practice cards are in the practice queue
- **THEN** the Practice link shows 3

#### Scenario: No practice count
- **WHEN** the practice queue is empty
- **THEN** the Practice link shows no count

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
The Home page SHALL show one of four states, always with an "Add word" link and, when the user has words, the word count ("1 word", "N words") as a secondary line. With no active words it SHALL show "No words yet" and no "Start review" button. With cards in the review queue it SHALL show the number of cards due ("1 card due", "N cards due") and a "Start review" button that opens Review. With words but an empty queue and no answers given on the current logical day it SHALL show "Nothing due" and the next due time when there is one. With an empty queue after answers were given on the current logical day it SHALL show "All done for today" and the next due time when there is one. If the data fails to load it SHALL show an inline message and a "Retry" button. When answers are waiting to be saved with 3 or more failed attempts, it SHALL show the unsaved banner.

#### Scenario: Empty state shown
- **WHEN** a signed-in user with no active words opens Home
- **THEN** the text "No words yet" and an "Add word" link are visible and "Start review" is not

#### Scenario: Cards due
- **WHEN** a user has 12 cards in the review queue
- **THEN** "12 cards due" and a "Start review" button are visible

#### Scenario: Singular
- **WHEN** one card is in the queue
- **THEN** "1 card due" is shown

#### Scenario: Start review
- **WHEN** the user presses "Start review"
- **THEN** the Review page opens

#### Scenario: Nothing due
- **WHEN** a user with words has an empty queue and gave no answers today
- **THEN** "Nothing due" and the next due time are shown

#### Scenario: All done today
- **WHEN** a user finishes their queue and returns to Home on the same logical day
- **THEN** "All done for today" is shown

#### Scenario: Count shown
- **WHEN** a signed-in user with three active words opens Home
- **THEN** "3 words" and an "Add word" link are visible and "No words yet" is not

#### Scenario: Add word link works
- **WHEN** the user follows the "Add word" link
- **THEN** the Add word page opens

#### Scenario: Load failure
- **WHEN** Home data fails to load and the user presses "Retry"
- **THEN** the load is attempted again

### Requirement: User content is inserted as text
Any user-supplied or server-supplied string shown on a page SHALL be inserted as text, never as HTML.

#### Scenario: Markup in an error message
- **WHEN** an error message contains `<b>x</b>`
- **THEN** the literal characters are displayed and no element is created

### Requirement: Navigation shortcuts
On every page that shows the sidebar, each sidebar link SHALL have a shortcut made of Alt and one physical letter key, with no other modifier: Home Alt+H, Review Alt+R, Practice Alt+P, Add word Alt+A, Words Alt+W, Settings Alt+S. The key SHALL be identified by its physical position, so a character the key would type with Alt (for example "ß" for Alt+S on a Mac) does not stop the shortcut. A shortcut SHALL open its page also while a text field has focus, and SHALL NOT insert a character into the field. The shortcut of the page that is already open SHALL do nothing. In addition, N SHALL open Add word when no text field has focus, no dialog is open and no modifier is held. Each link SHALL announce its shortcut to assistive technology. The shortcut SHALL be shown as a key chip only while the user hovers the link or it has keyboard focus, as a tooltip to the right of the link and outside the sidebar; the chip SHALL NOT be shown inline next to the label.

#### Scenario: Words from Home
- **WHEN** the user presses Alt+W on Home
- **THEN** the Words page opens

#### Scenario: Practice from Words
- **WHEN** the user presses Alt+P on Words
- **THEN** the Practice page opens

#### Scenario: Character typed by the key is ignored
- **WHEN** the user presses Alt+S on a Mac keyboard, where the key event reports "ß"
- **THEN** the Settings page opens

#### Scenario: While typing in a field
- **WHEN** the user presses Alt+H with the Words search field focused
- **THEN** Home opens and no character is typed into the field

#### Scenario: Current page
- **WHEN** the user presses Alt+A on Add word
- **THEN** nothing changes

#### Scenario: Other modifiers
- **WHEN** the user presses Ctrl+Alt+A or Alt+Shift+A
- **THEN** nothing happens

#### Scenario: N outside a field
- **WHEN** the user presses N on Home with no field focused
- **THEN** the Add word page opens

#### Scenario: N while typing
- **WHEN** the user types N into the Words search field
- **THEN** the letter is typed and the page does not change

#### Scenario: Chip on hover or focus
- **WHEN** the user hovers a sidebar link or moves keyboard focus to it
- **THEN** its Alt shortcut appears as a key chip tooltip to the right of the link, outside the sidebar, and disappears when hover and focus leave

#### Scenario: No inline chips
- **WHEN** a page with the sidebar is open and no link is hovered or focused
- **THEN** no key chip is visible

#### Scenario: Pages without the sidebar
- **WHEN** the user presses Alt+A on the sign-in, Setup, Review or Practice page
- **THEN** nothing happens

### Requirement: Viewport-filling layout
The page SHALL fill the full width and height of the browser window. On pages with the sidebar, the sidebar SHALL reach the bottom of the window and stay in place while the main content scrolls. On the Review page, the focus layout SHALL fill the window height so its key hints sit at the bottom of the window when the content is shorter than the window.

#### Scenario: Tall window
- **WHEN** Home is open in a window taller than its content
- **THEN** the sidebar background reaches the bottom edge of the window

#### Scenario: Long page scrolls
- **WHEN** the Words list is longer than the window and the user scrolls down
- **THEN** the sidebar stays visible at full height

#### Scenario: Review hints at the bottom
- **WHEN** a Review card is shown in a window taller than the card
- **THEN** the key hints are at the bottom edge of the window

#### Scenario: No horizontal scroll
- **WHEN** any page is open at any window width
- **THEN** the page does not scroll sideways

### Requirement: Collapsible sidebar
On wide screens the sidebar SHALL have a toggle button that collapses it to a narrow column showing one icon per link, and expands it again. Collapsed, each link SHALL keep its accessible name and show its label together with its shortcut in the same right-side tooltip on hover or keyboard focus, the current page SHALL stay marked and the Review due count SHALL stay visible. Shortcuts SHALL work in both states. The toggle SHALL be a button reachable from the keyboard that announces whether the sidebar is expanded. The state SHALL be remembered per device and browser and applied on every page; when it cannot be stored the sidebar SHALL start expanded. On narrow screens the toggle SHALL be hidden and the existing narrow layout SHALL apply.

#### Scenario: Collapse
- **WHEN** the user presses the toggle on an expanded sidebar
- **THEN** only icons are shown and the main content gets the freed width

#### Scenario: Remembered across pages
- **WHEN** the user collapses the sidebar on Home and opens Words
- **THEN** the sidebar on Words is collapsed

#### Scenario: Expand
- **WHEN** the user presses the toggle on a collapsed sidebar
- **THEN** labels are shown again

#### Scenario: Storage unavailable
- **WHEN** the browser blocks local storage
- **THEN** the sidebar starts expanded and the toggle still works on the open page

#### Scenario: Accessible names when collapsed
- **WHEN** the sidebar is collapsed
- **THEN** each link still has its label as its accessible name

#### Scenario: Narrow screen
- **WHEN** the viewport is phone width
- **THEN** no toggle is shown and all links are reachable

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
