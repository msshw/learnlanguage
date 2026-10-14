## Why

Every Add word lookup calls the model, even for a word another user already added with an unchanged suggestion. Reusing confirmed suggestions saves tokens and latency.

## What Changes

- New shared table `ai_suggestions` keyed by normalized term and language pair, holding the full model response (up to 3 senses). It has no `user_id` and no client access; only the `autofill` edge function reads and writes it with the service role.
- On lookup the edge function returns a confirmed record if one exists (all senses, no model call, no `ai_calls` cost). On a miss it calls the model and stores the response as a candidate, returning a `candidate_id`.
- When a user saves a word whose fields equal the picked sense, the client sends only `confirm(candidate_id, sense_index)`; the server promotes the record to confirmed. Edited words are saved to the user's data only. The client never sends suggestion content.
- Reuse needs no copy step: the form is filled from the cached sense and saved to `words` as today, so the user's copy is independent.
- **BREAKING (data rule):** `ai_suggestions` is not per-user; it is the one table exempt from "every table has `user_id` and RLS", and is closed to clients by RLS with no policies.

## Capabilities

### New Capabilities
- `ai-suggestion-cache`: shared store of confirmed AI suggestions and the candidate/confirm flow.

### Modified Capabilities
- `ai-autofill`: cache lookup before the model call, candidate id in the response, confirm action, cache hits not counted against the cap.
- `data-access-control`: documented exception for the service-role-only shared table.

## Impact

New migration, `supabase/functions/autofill`, `src/js/lib/ai.js`, `src/js/pages/add.js`, SPEC-related docs proposed (not edited), tests with the stubbed function. Removing a bad suggestion is manual SQL until `suggestion-admin`.
