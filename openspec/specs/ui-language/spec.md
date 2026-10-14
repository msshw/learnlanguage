# ui-language Specification

## Purpose
Defines which language the interface is shown in, which text is translated, and the rules that keep every supported native language complete.

## Requirements

### Requirement: Interface language follows the active pair
On every signed-in non-admin page the interface language SHALL be the native language of the active pair, when that language has a dictionary. Otherwise it SHALL be English. Switching the active pair SHALL show the page again in the new pair's interface language, with no flash of the previous language.

#### Scenario: Russian pair
- **WHEN** the active pair has native language `ru`
- **THEN** page text, buttons and messages are shown in Russian

#### Scenario: Switching pairs
- **WHEN** the user switches from a pair with native `en` to one with native `ru`
- **THEN** the interface is shown in Russian

### Requirement: Language before a pair exists
The sign-in page SHALL use the browser language when it is a supported native language with a dictionary, otherwise English. The setup page SHALL start in the same way and SHALL switch the whole page to the native language as soon as the user picks one, before the pair is created.

#### Scenario: Browser language on sign-in
- **WHEN** the browser language is `ru` and the user opens sign-in
- **THEN** the page is shown in Russian

#### Scenario: Unsupported browser language
- **WHEN** the browser language is `ja`
- **THEN** sign-in is shown in English

#### Scenario: Live change in setup
- **WHEN** the user picks native language Russian on the setup page
- **THEN** the labels, hints and button on the page switch to Russian at once

### Requirement: Dictionaries and fallback
All user-facing text on non-admin pages, whether in HTML or set from script, SHALL come from a per-language dictionary of keys. A missing key in a language SHALL fall back to the English text, and a key missing everywhere SHALL show the key itself. Text SHALL still be inserted as text, never as markup. The document language attribute SHALL equal the interface language.

#### Scenario: Missing key falls back
- **WHEN** the Russian dictionary lacks a key that the English one has
- **THEN** the English text is shown for it

#### Scenario: Document language
- **WHEN** the interface is Russian
- **THEN** the page's `lang` attribute is `ru`

### Requirement: Dictionary parity
Every dictionary SHALL have exactly the same keys and the same placeholders per key as the English one, and every language with `native: true` in the supported list SHALL have a dictionary. A test SHALL fail when this does not hold.

#### Scenario: Key missing in one language
- **WHEN** a key exists in English but not in Russian
- **THEN** the parity test fails and names the key

#### Scenario: New native language without a dictionary
- **WHEN** a language is marked as native in the supported list and has no dictionary
- **THEN** the parity test fails

### Requirement: Language names and plurals
Language names in pickers, the pair switcher and Settings SHALL be shown in the interface language. Text that contains a count SHALL use the plural form that the interface language's plural rules select for that count.

#### Scenario: Language name
- **WHEN** the interface is Russian and a picker lists German
- **THEN** the option reads "немецкий" or its standard Russian name, not "German"

#### Scenario: Russian plural
- **WHEN** the interface is Russian and a text counts 1, 2 and 5 words
- **THEN** each count uses the form for one, few and many

### Requirement: Out of scope text stays English
Admin pages and error messages returned by the edge functions SHALL stay in English whatever the interface language is.

#### Scenario: Admin page
- **WHEN** an admin with a Russian interface opens an admin page
- **THEN** the admin page is shown in English

#### Scenario: Function error text
- **WHEN** an edge function returns an error message
- **THEN** the message is shown as received
