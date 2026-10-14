## ADDED Requirements

### Requirement: Language pair switcher
Every page with the sidebar SHALL show a pair switcher at the top of the sidebar, above the links. It SHALL show the active pair as the target language name with "from <Native name>" below it (for example "German" and "from English"). Collapsed, it SHALL show only the target language code in capitals (for example "DE") and keep the full text as its accessible name and tooltip. The switcher SHALL be a button reachable with Tab that opens a menu listing the user's other pairs, each with its target name, "from <Native name>" and its review due count (the number Home would show for that pair, hidden when zero). The counts SHALL be loaded when the menu opens; a count that fails to load SHALL be left out without hiding the pair. Choosing a pair SHALL set it as the profile's active pair and reload the current page, so the page and the sidebar counts show that pair. The choice SHALL be stored on the profile, so it applies on every device. If saving the choice fails, the menu SHALL show an inline error and the active pair SHALL stay. With only one pair the menu SHALL say "No other languages" and point to Settings for adding one. The menu SHALL work from the keyboard: arrow keys move between pairs, Enter chooses, Escape closes it and returns focus to the switcher.

#### Scenario: Active pair shown
- **WHEN** the active pair is `de`/`en` and Home is open
- **THEN** the top of the sidebar shows "German" and "from English"

#### Scenario: Collapsed
- **WHEN** the sidebar is collapsed
- **THEN** the switcher shows "DE" and its accessible name names German from English

#### Scenario: Other pairs with counts
- **WHEN** the user has `de`/`en` (active) and `fr`/`en` with 4 cards due, and opens the menu
- **THEN** the menu lists French from English with 4

#### Scenario: Switch
- **WHEN** the user chooses French from English on the Words page
- **THEN** the profile's active pair is `fr`/`en`, the Words page reloads and lists only French words, and the Review count is the French count

#### Scenario: Follows the user
- **WHEN** the user switched to `fr`/`en` on one device and opens Home on another
- **THEN** Home shows `fr`/`en`

#### Scenario: Only one pair
- **WHEN** the user has one pair and opens the menu
- **THEN** "No other languages" is shown with a link to Settings

#### Scenario: Keyboard
- **WHEN** the user tabs to the switcher, presses Enter, moves with the arrow keys and presses Enter
- **THEN** the chosen pair becomes active

#### Scenario: Switch fails
- **WHEN** saving the active pair fails
- **THEN** an inline error is shown in the menu and the page is not reloaded

### Requirement: Screens show the active pair only
Home, Review, Practice, Add word, Words, the word page and the sidebar counts SHALL use only the active pair's words, cards, logs and daily limit. A session SHALL never mix cards of two pairs.

#### Scenario: Home count per pair
- **WHEN** `de`/`en` has 5 cards due, `fr`/`en` has 2, and `fr`/`en` is active
- **THEN** Home shows "2 cards due"

#### Scenario: Review session per pair
- **WHEN** both pairs have due cards and `fr`/`en` is active
- **THEN** the Review session contains only `fr`/`en` cards
