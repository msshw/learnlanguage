## Context

See proposal.md for motivation. Current state: `ai_calls` and its RLS (select-own only) exist from M0; `words.hint_en` and `words.source` exist; the review screen already shows the hint. Add word is a term step, duplicate check, then a manual form. `db.js` is the only `supabase-js` importer. Sign-ups are disabled, one or two users, local Supabase only (deploy is postponed).

## Goals / Non-Goals

**Goals:**
- Pure logic (prompt, schema, validation, cost, month window) testable by Vitest without Deno or the network.
- Every failure ends in the manual form; the cap cannot be bypassed by the client.

**Non-Goals:**
- Settings usage display, full add-with-AI e2e (M4).
- Strict cap under concurrent calls: one user, so a small overshoot is accepted.
- Streaming, batching, or multiple providers.

## Decisions

**Function layout.** `supabase/functions/autofill/` holds `config.ts` (model ID, prices, cap, limits), `prompt.ts`, `schema.ts` (JSON schema for structured output), `validate.ts`, `cost.ts` (month start, cost from tokens) and a thin `index.ts` (CORS preflight, input check, JWT check, cap check, model call with one retry, log, respond). The pure modules import each other with explicit `.ts` extensions, which Deno requires and Vite resolves, so Vitest imports them straight from `tests/unit`. `index.ts` is not unit-tested; the quality script and manual runs cover it.

**Anthropic SDK in Deno.** `npm:@anthropic-ai/sdk` (approved). Alternative was raw `fetch`; the SDK gives typed errors and usage fields for the same few lines. Pin the version in `index.ts`.

**Model call.** `claude-haiku-5-5`, effort `low`, `max_tokens` 2000, structured output through `output_config.format`, no `temperature`/`top_p`/`top_k` (rejected on this model), no assistant prefill. Thinking stays at its default; the cap leaves room for it. Billing is for tokens produced, so the cap is headroom, not spend. `stop_reason` `max_tokens` or `refusal` counts as invalid output. System prompt (rules) carries a cache marker; the prefix may be under the model's minimum and not cache, which only costs a fraction of a cent. The term goes in the user turn inside a delimiter, with an instruction to treat it as data.

**Schema versus code validation.** The JSON schema lists all six `forms` keys as nullable strings, `additionalProperties: false`, enums for part of speech. Structured output cannot enforce lengths, counts or "keys match the part of speech", so `validate.ts` checks those, and also strips null form keys. The status `not_a_word` is a model-level field (`is_german_word`: boolean) in the schema; when false, `senses` is ignored.

**Cap.** New migration adds `ai_usage_since(p_user uuid, p_from timestamptz)` returning summed input and output tokens. Execute is revoked from `public`, `anon` and `authenticated` and granted to `service_role`. The function computes the month start (UTC) in `cost.ts`, calls the SQL function with a service-role client, multiplies by the price constants, and compares to 2.00. PostgREST aggregates are off and responses cap at 1000 rows, so a client-side sum is not safe. All input-side tokens (input plus cache read and write) are priced at the full input rate, which overestimates slightly; that is the safe direction for a cap.

**Writes and identity.** The user client (with the caller's JWT header) calls `auth.getUser()`; the service-role client inserts `ai_calls` and runs the usage function. Both keys come from the function's standard env vars. `ANTHROPIC_API_KEY` is read from env; locally it lives in `supabase/functions/.env` (gitignored by the existing `.env.*` rule, checked in tasks) and is passed with `--env-file`.

**Retry and timeout.** One retry, only on invalid or truncated output, not on provider errors (a failing provider will not recover within the client's 8 s window). The retry is a second logged call. The function sets its own per-call abort of 6 s so the retry cannot silently outlive the client; the client's 8 s abort is the hard bound.

**Client.** `db.js` gets `invokeAutofill(body, signal)` wrapping `supabase.functions.invoke`. `ai.js` exports `suggest(term, {timeoutMs = 8000})`: it builds an `AbortController`, calls `invokeAutofill`, and returns `{status, senses}` where every failure, including HTTP errors and malformed bodies, maps to `{status: 'unavailable', senses: []}`. `over_cap` also maps to `unavailable` for the UI. No retries.

**Add word flow.** `add.js` grows from two states to: term → (duplicate warning) → waiting → picker | notaword | manual form. `showDetails(term, sense?)` takes an optional sense; a module-level `source` variable is `'ai_confirmed'` after a pick and reset on every return to the term step, on skip and on fallback. `insertWord(pairId, value, source)` takes the source as a parameter. A request token (counter) guards against late responses after "Skip suggestions" or Cancel. The sense-to-form mapping (`senseToFormValues`) lives in `word-form.js` as a pure function with a unit test; `word-form-view.js` gets a `fill(values)` use if it already exposes one (it does).

**Duplicate re-check.** After a response, if the returned term differs from the entered term other than by case, `findDuplicates` runs on the returned term of the first sense; a match shows the existing warning for that term. "Add anyway" then proceeds straight to the picker (no second request).

**Quality script.** `scripts/autofill-quality.mjs`, run with `node --env-file=.env`. Signs in as alice with the anon key, calls the served function for each word in a list, applies per-word automatic checks (expected part of speech, article, plural, auxiliary, separable prefix, status, corrected term), prints senses and hints, prints cache-read tokens, exits non-zero on failures. The word list and expectations live in the same file. It spends real API money (well under a cent for the set) and Maks runs it.

**Tests.** Unit: `validate`, `cost`, `schema` shape sanity, `senseToFormValues`, `ai.js` mapping and timeout (fake timers, injected invoker). Integration: `ai_usage_since` sums, month boundary, per-user isolation, and execute rejected for alice/anon; `ai_calls` insert rejected for alice. E2E: existing specs get a default Playwright route that answers the function with `{status:'error'}` so they behave as before; new specs stub `ok` with two senses (pick, `ai_confirmed` saved), `not_a_word`, and a hanging request (falls back within 8 s plus margin).

## Risks / Trade-offs

- Model returns plausible but wrong forms → the user reads and edits before saving; senses and hints are reviewed by eye in the quality run; `ai_confirmed` marks them.
- Concurrent calls overshoot the cap → accepted for a single user; worst case is a few fractions of a cent.
- Prompt-injection in the term → the term is delimited and treated as data, output is schema-bound and validated, and the result is only shown in an editable form (inserted with `textContent`).
- Prefix too short to cache → cost stays trivial; script prints cache tokens so it is visible.
- SDK or model API drift → model ID, prices and effort live in `config.ts`; the quality script runs before any change to them.
- Cap counts UTC months, the user's day is profile timezone → can be off by hours at month edges; harmless for a safety cap.

## Migration Plan

One new migration file; no data changes. Rollback: drop the function and remove the edge function directory. Nothing deployed (cloud deploy is postponed).
