## MODIFIED Requirements

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
