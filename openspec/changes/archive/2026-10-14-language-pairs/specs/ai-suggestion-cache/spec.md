## ADDED Requirements

### Requirement: Stored senses use language-neutral field names
Every stored sense SHALL use the field names `hint_native`, `example_target` and `example_native` in place of `hint_en`, `example_de` and `example_en`. The migration that introduces the new names SHALL rewrite every existing record: each sense keeps its values, its `state`, its `judged` flag and its position, and no old name remains. Admin edits and new model results SHALL be stored with the new names only.

#### Scenario: Existing record rewritten
- **WHEN** a record has a confirmed sense with `hint_en` `bank (money)`, `example_de` and `example_en`, and the migration runs
- **THEN** the sense has `hint_native` `bank (money)`, the same examples under `example_target` and `example_native`, state `confirmed`, and no `hint_en`, `example_de` or `example_en`

#### Scenario: Order and flags kept
- **WHEN** a record has senses confirmed and judged, rejected, candidate
- **THEN** after the migration the senses are in the same order with the same states and judged flags

#### Scenario: Cache hit after the migration
- **WHEN** bob requests `Bank` after the migration and a rewritten record has a confirmed sense
- **THEN** the senses are returned with `hint_native`, `example_target` and `example_native`

### Requirement: Records never cross language pairs
Lookups, new records, rejected senses, confirms and allow-again SHALL stay within one language pair (target and native language). A record or rejected sense of one pair SHALL NEVER be served to, or filter the model result of, a request for another pair, also when the term is the same.

#### Scenario: Same target, other native
- **WHEN** a `de`/`en` record for `bank` has a confirmed sense and carol requests `Bank` with her `de`/`ru` pair
- **THEN** the model is called and a new `de`/`ru` record is stored

#### Scenario: Rejection stays in its pair
- **WHEN** a sense of `Bank` is rejected for `de`/`en` and the model returns the same part of speech and translations for a `de`/`ru` request
- **THEN** the `de`/`ru` sense is not dropped
