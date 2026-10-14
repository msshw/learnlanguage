## MODIFIED Requirements

### Requirement: Card prompts
For a `forward` card the prompt SHALL show the target-language term, with its article for nouns when the pair's profile has articles, and the direction line "<Target> → <Native>". For a `reverse` card it SHALL show the native-language translations joined with commas, the hint when the word has one, the part of speech, and the direction line "<Native> → <Target>". Language names SHALL come from the supported language list. The page SHALL show the position in the session ("3 of 12"); requeued cards extend the total.

#### Scenario: de_en prompt
- **WHEN** a `forward` card for the noun `das Haus` of a `de`/`en` pair is shown
- **THEN** the prompt shows `das Haus` and the direction line "German → English"

#### Scenario: en_de prompt
- **WHEN** a `reverse` card for `Bank` with translation `bank` and hint `bank (money)` of a `de`/`en` pair is shown
- **THEN** the prompt shows `bank`, `bank (money)` and `noun`, and the direction line "English → German"

#### Scenario: Generic forward prompt
- **WHEN** a `forward` card for the French noun `maison` of a `fr`/`ru` pair is shown
- **THEN** the prompt shows `maison` without an article and the direction line "French → Russian"
