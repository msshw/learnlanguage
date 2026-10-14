## MODIFIED Requirements

### Requirement: Answer normalization
Before comparing, typed answers and expected answers SHALL be put in Unicode NFC form, trimmed, lowercased, and have runs of spaces collapsed to one. Then the typing equivalences of the language the answer is typed in SHALL be applied: the target language's profile in the `reverse` direction, the native language's profile in the `forward` direction (see language-profiles). For German, ä, ö, ü and ß SHALL be treated as equal to ae, oe, ue and ss respectively. For Russian, е and ё SHALL be treated as equal. All other diacritics SHALL stay significant.

#### Scenario: Umlaut spelled out
- **WHEN** the expected German answer is `Mädchen` and the user types `maedchen`
- **THEN** the answer is correct

#### Scenario: Eszett spelled out
- **WHEN** the expected answer is `Straße` and the user types `STRASSE`
- **THEN** the answer is correct

#### Scenario: Spacing and case
- **WHEN** the expected answer is `zu Hause` and the user types `  Zu   hause `
- **THEN** the answer is correct

#### Scenario: Russian yo
- **WHEN** the expected Russian answer is `ёлка` and the user types `елка`
- **THEN** the answer is correct

#### Scenario: Cyrillic case
- **WHEN** the expected Russian answer is `Москва` and the user types `МОСКВА`
- **THEN** the answer is correct

#### Scenario: French accents count
- **WHEN** the expected French answer is `café` and the user types `cafe`
- **THEN** the answer is not correct

#### Scenario: Composed and decomposed
- **WHEN** the expected answer is `café` written with a combining accent and the user types `café` with the composed letter
- **THEN** the answer is correct

### Requirement: Correct answers
In the `forward` direction (target term shown) an answer SHALL be correct when it matches any listed translation after normalization. In the `reverse` direction (native translation shown) it SHALL be correct when it matches the term after normalization, together with the article for nouns when the target's profile has articles. A correct answer SHALL have the default rating Good (3).

#### Scenario: Any translation counts
- **WHEN** a word has translations `house` and `home` and the user types `home` for `forward`
- **THEN** the result is correct with rating 3

#### Scenario: German noun with article
- **WHEN** the noun is `das Haus` and the user types `das Haus` for `reverse`
- **THEN** the result is correct with rating 3

#### Scenario: Generic noun without article
- **WHEN** the French noun is `maison` and the user types `maison` for `reverse`
- **THEN** the result is correct with rating 3

### Requirement: Typos
An answer SHALL be graded as a typo when it is not correct, its normalized form differs from the normalized expected answer by exactly one inserted, deleted or substituted character, and the expected answer has at least 4 letters (counted without the article and before typing equivalences are applied). A swap of two neighbouring letters counts as two edits. A typo SHALL have the default rating Good (3) and SHALL report the correctly spelled expected answer. In `forward` the typo check SHALL apply to each listed translation.

#### Scenario: One letter off
- **WHEN** the expected answer is `Haus` and the user types `Hous`
- **THEN** the result is a typo with rating 3 and the correct spelling `Haus`

#### Scenario: Too short for typos
- **WHEN** the expected answer is `Uhr` and the user types `Ohr`
- **THEN** the result is wrong

#### Scenario: Umlaut words under four letters
- **WHEN** the expected answer is `Bär` and the user types `Bar`
- **THEN** the result is wrong

#### Scenario: Swapped letters
- **WHEN** the expected answer is `Haus` and the user types `Huas`
- **THEN** the result is wrong

#### Scenario: Typo against a second translation
- **WHEN** a word has translations `house` and `home` and the user types `homme` for `forward`
- **THEN** the result is a typo and the reported correct spelling is `home`

#### Scenario: Missing accent is a typo
- **WHEN** the expected French answer is `école` and the user types `ecole`
- **THEN** the result is a typo with the correct spelling `école`

#### Scenario: Cyrillic typo
- **WHEN** the expected Russian answer is `собака` and the user types `сабака`
- **THEN** the result is a typo

### Requirement: Article check for nouns
For nouns in the `reverse` direction of a pair whose target profile has articles (German), the typed answer MAY start with der, die or das followed by a space. If the term matches exactly after normalization but the article is wrong or missing, the result SHALL be article wrong with the default rating Hard (2). If the term has a typo and the article is correct, the result SHALL be a typo. If the term has a typo and the article is wrong or missing, the result SHALL be wrong. For words that are not nouns, and for every word of a pair whose target profile has no articles, no article SHALL be expected and the result SHALL never be article wrong.

#### Scenario: Wrong article
- **WHEN** the noun is `das Haus` and the user types `der Haus`
- **THEN** the result is article wrong with rating 2 and the correct answer `das Haus`

#### Scenario: Missing article
- **WHEN** the noun is `das Haus` and the user types `Haus`
- **THEN** the result is article wrong with rating 2

#### Scenario: Typo with correct article
- **WHEN** the noun is `das Haus` and the user types `das Hous`
- **THEN** the result is a typo with rating 3

#### Scenario: Typo with wrong article
- **WHEN** the noun is `das Haus` and the user types `die Hous`
- **THEN** the result is wrong

#### Scenario: Verb has no article
- **WHEN** the word is the verb `gehen` and the user types `gehen` for `reverse`
- **THEN** the result is correct

#### Scenario: Generic target with a typed article
- **WHEN** the French noun is `maison` and the user types `la maison` for `reverse`
- **THEN** the result is wrong, not article wrong

### Requirement: Deterministic and side-effect free
Grading SHALL depend only on the answer, the word, the direction and the pair's target and native language. Easy (4) SHALL never be a default rating.

#### Scenario: Same input, same output
- **WHEN** the same answer is graded twice for the same word, direction and pair
- **THEN** both results are identical
