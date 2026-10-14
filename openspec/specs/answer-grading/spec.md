# answer-grading Specification

## Purpose
Defines how a typed answer is judged against a word, so the same answer always gets the same result and a default rating. The user can still override the rating on the Review screen.

## Requirements

### Requirement: Answer normalization
Before comparing, typed answers and expected answers SHALL be trimmed, lowercased, have runs of spaces collapsed to one, and have ä, ö, ü and ß treated as equal to ae, oe, ue and ss respectively.

#### Scenario: Umlaut spelled out
- **WHEN** the expected German answer is `Mädchen` and the user types `maedchen`
- **THEN** the answer is correct

#### Scenario: Eszett spelled out
- **WHEN** the expected answer is `Straße` and the user types `STRASSE`
- **THEN** the answer is correct

#### Scenario: Spacing and case
- **WHEN** the expected answer is `zu Hause` and the user types `  Zu   hause `
- **THEN** the answer is correct

### Requirement: Correct answers
In the `de_en` direction an answer SHALL be correct when it matches any listed translation after normalization. In the `en_de` direction it SHALL be correct when it matches the term (for nouns, the article and the term) after normalization. A correct answer SHALL have the default rating Good (3).

#### Scenario: Any translation counts
- **WHEN** a word has translations `house` and `home` and the user types `home` for `de_en`
- **THEN** the result is correct with rating 3

#### Scenario: German noun with article
- **WHEN** the noun is `das Haus` and the user types `das Haus` for `en_de`
- **THEN** the result is correct with rating 3

### Requirement: Typos
An answer SHALL be graded as a typo when it is not correct, its normalized form differs from the normalized expected answer by exactly one inserted, deleted or substituted character, and the expected answer has at least 4 letters (counted without the article and before ä, ö, ü, ß are expanded). A swap of two neighbouring letters counts as two edits. A typo SHALL have the default rating Good (3) and SHALL report the correctly spelled expected answer. In `de_en` the typo check SHALL apply to each listed translation.

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
- **WHEN** a word has translations `house` and `home` and the user types `homme` for `de_en`
- **THEN** the result is a typo and the reported correct spelling is `home`

### Requirement: Article check for nouns
For nouns in the `en_de` direction, the typed answer MAY start with der, die or das followed by a space. If the term matches exactly after normalization but the article is wrong or missing, the result SHALL be article wrong with the default rating Hard (2). If the term has a typo and the article is correct, the result SHALL be a typo. If the term has a typo and the article is wrong or missing, the result SHALL be wrong. For words that are not nouns, no article SHALL be expected.

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
- **WHEN** the word is the verb `gehen` and the user types `gehen` for `en_de`
- **THEN** the result is correct

### Requirement: Wrong answers
Any answer that is not correct, a typo or article wrong, including an empty answer, SHALL be wrong with the default rating Again (1) and SHALL report the expected answer.

#### Scenario: Unrelated answer
- **WHEN** the user types `xyz` for `Haus`
- **THEN** the result is wrong with rating 1

#### Scenario: Empty answer
- **WHEN** the user submits an empty answer
- **THEN** the result is wrong with rating 1

### Requirement: Deterministic and side-effect free
Grading SHALL depend only on the answer, the word and the direction. Easy (4) SHALL never be a default rating.

#### Scenario: Same input, same output
- **WHEN** the same answer is graded twice for the same word and direction
- **THEN** both results are identical
