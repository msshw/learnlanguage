## ADDED Requirements

### Requirement: Navigation shortcuts
On every page that shows the sidebar, each sidebar link SHALL have a shortcut made of Alt and one physical letter key, with no other modifier: Home Alt+H, Review Alt+R, Add word Alt+A, Words Alt+W, Settings Alt+S. The key SHALL be identified by its physical position, so a character the key would type with Alt (for example "ß" for Alt+S on a Mac) does not stop the shortcut. A shortcut SHALL open its page also while a text field has focus, and SHALL NOT insert a character into the field. The shortcut of the page that is already open SHALL do nothing. In addition, N SHALL open Add word when no text field has focus, no dialog is open and no modifier is held. Each link SHALL announce its shortcut to assistive technology. The shortcut SHALL be shown as a key chip only while the user hovers the link or it has keyboard focus, as a tooltip to the right of the link and outside the sidebar; the chip SHALL NOT be shown inline next to the label.

#### Scenario: Words from Home
- **WHEN** the user presses Alt+W on Home
- **THEN** the Words page opens

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
- **WHEN** the user presses Alt+A on the sign-in, Setup or Review page
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

## REMOVED Requirements

### Requirement: Add word shortcut
**Reason**: Replaced by "Navigation shortcuts", which covers Alt+A for Add word together with the other links and the N key.
**Migration**: Alt+A keeps working as before. The old scenario that pressed Alt+A on Review is dropped: Review has no sidebar, so no shortcut is installed there.
