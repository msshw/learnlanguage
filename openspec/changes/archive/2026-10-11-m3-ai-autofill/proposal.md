## Why

Adding a word by hand means typing article, plural, verb forms, translations, a hint and an example. That is the slowest part of using the trainer. M3 lets the model suggest all of it from the German term, while the user stays in control: nothing is saved until Save, and every failure falls back to the manual form.

## What Changes

- New `autofill` Supabase edge function (TypeScript, Deno): verifies the user JWT, checks the monthly spend cap, calls `claude-haiku-5-5` with structured output, validates the result in code, retries once on invalid output, and logs every model call to `ai_calls`.
- $2 monthly cap, summed from `ai_calls` (UTC calendar month). At the cap the function returns `over_cap` without calling the model.
- Model ID and per-token prices live in one config constant in the function.
- Request settings: effort `low`, `max_tokens` about 2000 (SPEC says about 600; thinking tokens count toward the cap, so it needs headroom). A `max_tokens` stop or a refusal counts as invalid output.
- New migration: a SQL function that sums the month's cost for a user. The function is executable by the service role only.
- `ai.js` client module calls the function through a new `db.js` wrapper (`db.js` stays the only `supabase-js` importer). Eight-second timeout, every failure maps to a fallback.
- Add word: after the duplicate check, the term is sent for suggestions. A sense picker (keys 1 to 3, Enter takes the first, "Skip suggestions") fills the editable form. A saved word that came from a picked sense gets `source = 'ai_confirmed'`.
- Fallback messages: "Suggestions unavailable" (timeout, provider error, invalid output, over cap), "Not recognized as German" with a way to save manually anyway.
- If the model corrects the spelling of the term, the duplicate check runs again on the corrected term.
- Quality test set of about 20 words and a script that runs it against the locally served function. The script checks fields automatically and prints senses and hints for review by eye.
- Spec amendment to propose to Maks (SPEC.md is not edited here): the "about 600 tokens" output cap becomes about 2000.
- Not in this change: AI usage display in Settings (M4), the full add-with-AI end-to-end flow (M4), sentence checking and generation.

## Capabilities

### New Capabilities
- `ai-autofill`: the edge function contract (request, response statuses, validation, retry), the monthly spend cap, `ai_calls` logging, and the client fallbacks and timeout.

### Modified Capabilities
- `word-entry`: the term step requests suggestions and shows the sense picker; saving a picked sense records `source = 'ai_confirmed'`; fallback and "not a word" behavior; duplicate check re-runs on a corrected term.
- `data-access-control`: the month-usage function is callable by the service role only, and `ai_calls` stays readable by its owner and written only by the service role.

## Impact

- New: `supabase/functions/autofill/` (`index.ts`, pure modules for prompt, schema, validation and cost), `supabase/functions/.env` for the local key (already gitignored), one migration, `src/js/lib/ai.js`, the autofill test script under `scripts/`.
- Changed: `src/js/lib/db.js` (function wrapper, `insertWord` takes a `source`), `src/js/pages/add.js`, `src/pages/add.html`, existing e2e stubs the function.
- Dependency: `npm:@anthropic-ai/sdk` inside the edge function (approved by Maks). No new client dependencies.
- External: Anthropic API, billed per call. Local runs need `ANTHROPIC_API_KEY` in `supabase/functions/.env`.
