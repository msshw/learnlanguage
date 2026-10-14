## 1. Database

- [x] 1.1 Add a migration with `ai_usage_since(p_user, p_from)` (sums input and output tokens, execute for `service_role` only) and verify with new integration tests: sums at or after the start time, zero when no rows, other users excluded, rejected for alice and anon, and an `ai_calls` insert by alice is rejected

## 2. Edge function pure modules

- [x] 2.1 Create `supabase/functions/autofill/config.ts` (model ID, effort, max tokens 2000, prices, $2 cap, term and field limits) and `cost.ts` (UTC month start, cost from tokens) and verify unit tests cover month boundaries and the cap comparison at $1.99, $2.00
- [x] 2.2 Create `schema.ts` (structured-output JSON schema with `additionalProperties: false`, `is_german_word`, six nullable form keys) and `prompt.ts` (system rules, delimited user turn) and verify a unit test checks the schema shape and that the prompt contains the term only in the user turn
- [x] 2.3 Create `validate.ts` and verify unit tests cover each rule: allowed part of speech, forms keys per part of speech, null form keys stripped, article der/die/das, auxiliary haben/sein, translation count 1 to 3, hint at most 4 words, example at most 12 words, string lengths, sense count 1 to 3, `not_a_word`, truncated and refused results invalid

## 3. Edge function

- [x] 3.1 Create `index.ts`: CORS preflight, input check, JWT check, cap check, SDK call (effort low, structured output, 6 s abort), one retry on invalid output, `ai_calls` logging with cache tokens included, response statuses; verify by `supabase functions serve autofill --env-file supabase/functions/.env` and a curl with alice's token returning `ok` for `Bank` (Maks runs it)
- [x] 3.2 Add `supabase/functions/.env.example` with `ANTHROPIC_API_KEY=`, confirm `.gitignore` covers `supabase/functions/.env`, and add the `[functions.autofill]` entry in `supabase/config.toml` if the CLI needs it; verify the key file is ignored

## 4. Client

- [x] 4.1 Add `invokeAutofill` to `db.js` and `insertWord(pairId, value, source)` (callers in add and words updated); verify existing unit and integration tests still pass
- [x] 4.2 Create `src/js/lib/ai.js` with `suggest(term)` mapping every failure to `unavailable` with an 8 s timeout, and verify unit tests with fake timers cover success, `not_a_word`, `over_cap`, `error`, HTTP failure, malformed body and timeout
- [x] 4.3 Add `senseToFormValues` to `word-form.js` and verify a unit test covers noun, verb, and other parts of speech with empty forms

## 5. Add word page

- [x] 5.1 Update `add.html` and `add.js`: waiting state with "Skip suggestions", sense list with keys 1 to 3 and Enter, "Suggestions unavailable" message, "Not recognized as German" with "Save manually anyway", source tracking, stale-response guard, duplicate re-check on corrected term; verify by the e2e specs in 6.1
- [x] 5.2 Confirm the form keeps editable values and `source` resets on Cancel, skip and fallback; verify by an e2e step (pick, cancel, manual add saves `manual`)

## 6. End-to-end and quality set

- [x] 6.1 Update `tests/e2e/words.spec.js` to stub the function by default (`{status:'error'}`), and add specs for pick with `ai_confirmed` saved, `not_a_word`, skip while pending, corrected-term duplicate warning, and a hanging request falling back within 8 s; verify `npm run test:e2e` passes (Maks runs it)
- [x] 6.2 Create `scripts/autofill-quality.mjs` with the word list and automatic checks (about 20 words across the SPEC §5 categories) and an `npm run test:ai` script; verify `node --check` passes and Maks runs it against the served function with all automatic checks passing
