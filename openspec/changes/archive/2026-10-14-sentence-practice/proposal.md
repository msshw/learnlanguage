## Why

Reviews train recall of single words, not using them. Writing sentences with learned words, with AI feedback, is the next planned milestone ("After the MVP" in SPEC.md).

## What Changes

- A separate Practice page with its own queue, independent of word reviews: one FSRS card per word for sentence practice (`sentence_cards`), with its own due count and sidebar entry.
- The user writes a sentence with the given word; a new `check-sentence` edge function returns a corrected sentence and issues with spans; the client highlights them using `textContent` and `<mark>`.
- The user rates the attempt; results go to append-only `sentence_logs`. Word cards and `review_logs` are untouched.
- The edge function reuses `ai_calls` logging and the $2 monthly cap, with manual fallbacks on every failure.
- Needs its own contract and SPEC proposal first (SPEC.md is not edited here).

## Capabilities

### New Capabilities
- `sentence-practice`: practice queue, writing step, feedback display, scheduling and logs.
- `sentence-check`: edge function contract for checking a sentence.

### Modified Capabilities
- `app-shell`: Practice nav entry with due count.
- `ai-autofill`: shared `ai_calls` kind and cap accounting for the new call kind.

## Impact

New migrations (`sentence_cards`, `sentence_logs`, RLS), new edge function, new page and `lib` modules reusing `scheduler.js`, sidebar, tests. Best built after `ai-word-cache`.
