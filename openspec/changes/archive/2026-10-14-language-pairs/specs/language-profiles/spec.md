## Purpose

Defines which languages the app supports, which pairs a user may learn, and the per-language profile that decides word forms, article badges and typing equivalences, so any supported pair works without code written for it.

## ADDED Requirements

### Requirement: Supported languages
The system SHALL keep one list of supported languages, each with an ISO 639-1 code and an English name, and two roles. Native languages SHALL be English (`en`) and Russian (`ru`). Target languages SHALL be German (`de`), French (`fr`), Spanish (`es`), Italian (`it`), Portuguese (`pt`), Dutch (`nl`), Polish (`pl`), Czech (`cs`), Ukrainian (`uk`), Russian (`ru`) and English (`en`), each one added to the list only once its quality set passes (see ai-autofill). A pair SHALL be allowed only when its native language is a native language of the list, its target language is a target language of the list, and the two differ. The edge functions and the client SHALL use the same list; a unit test SHALL fail when the client copy and the functions' copy differ.

#### Scenario: Allowed pair
- **WHEN** the pair is target `fr`, native `ru`
- **THEN** the pair is allowed

#### Scenario: Same language
- **WHEN** the pair is target `en`, native `en`
- **THEN** the pair is not allowed

#### Scenario: Unsupported native language
- **WHEN** the pair is target `de`, native `fr`
- **THEN** the pair is not allowed

#### Scenario: Unknown code
- **WHEN** the pair is target `xx`, native `en`
- **THEN** the pair is not allowed

#### Scenario: Copies drift
- **WHEN** a language is added to the functions' list but not to the client copy
- **THEN** the unit test fails

### Requirement: Language profiles
Each language SHALL have a profile that defines: the word forms per part of speech, the allowed articles, and the typing equivalences used by answer grading. German (`de`) SHALL have the German profile: nouns have `article` (der, die or das, required) and `plural`; verbs have `praeteritum`, `partizip2`, `auxiliary` (haben or sein) and `separable_prefix`; other parts of speech have no forms; typing equivalences ä = ae, ö = oe, ü = ue, ß = ss. Every other language SHALL have the generic profile: no forms for any part of speech (`forms` is always `{}`), no articles, no gender field, and no typing equivalences except that Russian (`ru`) treats е and ё as equal. A word's profile SHALL be the profile of its pair's target language.

#### Scenario: German noun
- **WHEN** a word of a `de` pair is a noun
- **THEN** it has an article from der, die or das and may have a plural

#### Scenario: French noun
- **WHEN** a word of a `fr` pair is a noun
- **THEN** its forms are `{}` and no article is asked for or stored

#### Scenario: Russian equivalence
- **WHEN** the language is `ru`
- **THEN** е and ё count as the same letter in typed answers

### Requirement: Article badges only where the profile has articles
The der/die/das article badge SHALL be shown only for nouns of a pair whose profile has articles (German). Words of other pairs SHALL show no badge and no article text before the term, on every page that shows the badge for German nouns (Add word sense list, Words, word page, Review, Practice, Admin).

#### Scenario: German noun badge
- **WHEN** the Words list shows the `de` noun `Haus` with article `das`
- **THEN** the `das` badge is shown before `Haus`

#### Scenario: French noun
- **WHEN** the Words list shows the `fr` noun `maison`
- **THEN** no badge or article text is shown

### Requirement: Page copy names the pair's languages
Every piece of page copy that named German or English SHALL instead name the active pair's target or native language by its English name from the list. This covers at least: the Add word term label ("<Target> word or phrase"), the not-a-word message ("Not recognized as <Target>"), the Home and Words empty states ("Add your first <Target> word to start reviewing."), the word form labels for the hint ("Hint for <Native> to <Target> prompts (optional)") and the examples ("Example sentence in <Target> (optional)", "Example sentence in <Native> (optional)"), and the Review direction line ("<Target> → <Native>" on forward cards, "<Native> → <Target>" on reverse cards). The rest of the interface SHALL stay in English for every native language.

#### Scenario: French from Russian
- **WHEN** the active pair is target `fr`, native `ru` and the user opens Add word
- **THEN** the term label reads "French word or phrase"

#### Scenario: Review direction line
- **WHEN** a reverse card of a `fr`/`ru` pair is shown
- **THEN** the direction line reads "Russian → French"

#### Scenario: Interface language
- **WHEN** a user with native language Russian opens Settings
- **THEN** the page text is in English
