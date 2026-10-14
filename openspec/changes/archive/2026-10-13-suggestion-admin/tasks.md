<!-- Groups 1 to 5: first version, implemented in code, tick state left as is. Groups 6 to 10: the per-sense delta to implement on top of it. Group 11: Allow again, on top of that. Never edit the applied migration 20261013100000_suggestion_admin.sql. -->

## 1. Database (first version)

- [x] 1.1 Add migration `<timestamp>_suggestion_admin.sql`: `profiles.is_admin` with the guard trigger, `ai_suggestions.deleted_at`, `suggestion_reports` (RLS insert-only, revokes, unique pair), and service-role-only `moderate_suggestion(p_id, p_remove)`; verify `supabase db reset` applies it (Maks runs it)
- [x] 1.2 Extend `tests/integration/rls.test.js` with the cases in design.md (self-promotion rejected, limit still editable, report insert own and as another user, select, update, unknown suggestion, duplicate, `moderate_suggestion` rejected for users); verify Maks runs it green

## 2. Edge functions

- [x] 2.1 In `supabase/functions/autofill/index.ts` exclude removed rows from the lookup and answer `{status: "error"}` to a confirm on a removed row; verify with `curl` that a removed suggestion is a miss and cannot be confirmed (Maks runs it)
- [x] 2.2 Create `supabase/functions/admin/` (session check, server-side `is_admin` read, 403 `{status: "forbidden"}`, actions `list`, `remove`, `keep`) with the grouping in a pure module; verify a unit test for the grouping and `curl` as a non-admin returns 403 (Maks runs it)

## 3. Client

- [x] 3.1 Add `reportSuggestion(id)` (unique violation counts as success) and `invokeAdmin(body)` (403 mapped to `{status: 'forbidden'}`) to `src/js/lib/db.js`; verify unit tests with a fake client
- [x] 3.2 Add the "Report suggestion" button, "Suggestion reported" and "Could not report the suggestion" to `src/pages/add.html` and `src/js/pages/add.js`, reset on each new sense list; verify by the e2e in 4.1
- [x] 3.3 Extract the sense meta rendering into `src/js/lib/word-form-view.js`, build `src/pages/admin.html` and `src/js/pages/admin.js` ("No open reports", "Not available", load error with "Retry", "Remove suggestion", "Keep suggestion"), add `admin` to the Vite `pages`; verify the build emits `admin.html` and the e2e in 4.1
- [x] 3.4 Add the admin-only nav entry (Alt+M, chip, icon, rendered hidden) to `vite.config.js` and `sidebar.html`, reveal it from `sidebar.js` for admins with one profile read, and skip hidden links in `shortcutTarget`; verify a unit test that a hidden link's code does nothing

## 4. End-to-end and manual checks

- [x] 4.1 Add `tests/e2e/admin.spec.js` (stubbed autofill; admin set with the service role): report from the sense list, report failure, Admin link for admin only, list and "Remove suggestion", "Keep suggestion", bob sees "Not available"; Maks runs `npm test`
- [x] 4.2 Manual: set the owner's `is_admin` by SQL, remove the `Bank` suggestion from the page, request `Bank` again and see a new candidate and a new `ai_calls` row

## 5. Docs

- [x] 5.1 Hand Maks the proposed SPEC.md and CLAUDE.md edits from design.md; do not edit those files

## 6. Per-sense curation: database (new migration)

- [x] 6.1 Add a NEW migration (e.g. `20261014100000_suggestion_senses.sql`; do not edit `20261013100000_suggestion_admin.sql`) that converts existing rows: every sense gets `state` (deleted records all `rejected` with `status` candidate, confirmed records all `confirmed`, others `candidate`); verify on a seeded old-shape database after `supabase db reset` plus a hand-inserted old row (Maks runs it)
- [x] 6.2 In the same migration: `suggestion_reports.reason` (nullable, `char_length(btrim(reason)) between 50 and 2000`), insert policy also requiring `reason is not null`, `resolution` check widened to `removed, kept, approved, edited, rejected`; verify with the integration cases in 8.1
- [x] 6.3 In the same migration: `rejected_senses` (columns and unique key per design.md, RLS on, `revoke all` from clients, no policies); verify client access is closed. Do NOT backfill fingerprints in SQL (see 6.5)
- [x] 6.4 In the same migration: service-role-only `confirm_sense(p_id, p_index)` and `moderate_suggestion(p_id, p_action, p_index, p_sense, p_fingerprints)` (approve, edit, reject, remove; locks the row, sets `judged` on approve and edit, keeps `status`/`confirmed_at` as the summary, stores fingerprints under both keys, then closes open reports only when no non-rejected sense is unjudged or the action is remove, with the completing action as resolution; returns senses and `reports_closed`); drop the old `moderate_suggestion(uuid, boolean)`; verify with the integration cases in 8.1
- [x] 6.5 Add `scripts/backfill-rejected-senses.ts` (service role, Node 22.18+ with type stripping, run with `npm run backfill:rejected`; pure `backfillRows(records)` importing `fingerprint.ts`) that copies the senses of records with `deleted_at` not null into `rejected_senses` under both keys with `on conflict do nothing`; verify the unit and integration tests in 8.1 and that Maks runs it once after migration 2 and before deploying the functions

## 7. Per-sense curation: edge functions

- [x] 7.1 Add pure `supabase/functions/autofill/fingerprint.ts` (fingerprint, filter by rejected set, avoid-block text for the prompt) with a Vitest unit test (order, case, part of speech, nothing left, empty avoid list gives no text)
- [x] 7.2 `autofill`: serve non-rejected senses of a record with a confirmed sense, adding `index` and `state` to each; treat an all-rejected record as a miss; verify with a unit test of the mapping helper and `curl` (Maks runs it)
- [x] 7.3 `autofill`: on a miss read `rejected_senses` for the request key, add the avoid block to the user message (both attempts, max 10 senses), filter validated senses, store the rest as candidates (the all-dropped case is 7.6); verify with unit tests and a manual request after a rejection (Maks runs it)
- [x] 7.4 `autofill`: replace the confirm update with `confirm_sense` (only the picked stored index; rejected, unknown or out-of-range gives `{status: "error"}`); verify with `curl` (Maks runs it)
- [x] 7.5 `admin`: replace `keep` with `approve`, `edit` (validate with the existing `validate()` via `../autofill/validate.ts` or `_shared/`, per the bundling check in design.md; `{status: "invalid"}` on failure), `reject` and `remove` through `moderate_suggestion`; `list` returns reasons, sense states and judged flags and `group.ts` is updated; action responses carry the updated senses and `reports_closed`; verify a unit test for grouping with reasons and `curl` as non-admin returns 403 (Maks runs it)
- [x] 7.6 `autofill`: all-rejected retry. If attempt 1 leaves no sense after the filter, run attempt 2 (the existing retry slot, never a third call) with the stronger avoid block (rejected senses repeated before and after the request); if attempt 2 also leaves none, answer `error` and store nothing; log each all-dropped attempt in `ai_calls` with `ok` false, real tokens and error "all senses rejected" so both count toward the cap; verify with unit tests of the loop with a fake model (first all-rejected then valid, both all-rejected, validation failure then all-rejected stays within two calls) and the cost helper counting both rows (Maks runs them)

## 8. Per-sense curation: tests

- [x] 8.1 Extend `tests/integration/rls.test.js` and add a service-role test file: reason limits, `rejected_senses` closed, functions rejected for users, confirm only touches the picked sense, confirm on rejected errors, approve/edit/reject/remove states, judged flags and resolutions (reports stay open while any non-rejected sense is unjudged, close with the completing action; a user-confirmed sense stays unjudged until approved; remove closes at once; a late report on a fully judged record closes on approve), reject stores fingerprints under both keys once, edit on index 0 moves `corrected_key`; backfill: a seeded deleted record with umlaut translations yields rows equal to `fingerprint.ts` output under both keys, a second run adds none; Maks runs it green
- [x] 8.2 Update existing unit and e2e tests that assert record-level confirm, `keep`, or the report with no reason (`tests/e2e/admin.spec.js`, `add` and `db.js` tests); verify they describe the new behaviour

## 9. Per-sense curation: client

- [x] 9.1 `db.js`: `reportSuggestion(id, reason)` (trim, 50 to 2000 check, `23505` still success), `invokeAdmin` unchanged; the confirm call sends the picked sense's stored `index`; verify unit tests with a fake client
- [x] 9.2 `add.js` and `add.html`: the reason field with count and "Send report" (disabled below 50), typing digits in it picks nothing, confirm only when the picked sense `state` is `candidate` and the save is unchanged; verify unit test for the confirm decision and the e2e in 9.4
- [x] 9.3 Admin page: show reasons, sense states and "Judged"/"Not judged", buttons "Approve as is", "Edit and approve", "Reject" per non-rejected sense, "Remove suggestion" per entry (replacing "Keep suggestion"), edit form reusing the Add word form pieces extracted into `word-form-view.js` (no notes or tags), in-place re-render after an action (entry stays while `reports_closed` is false), invalid-edit error; all text via `textContent`; verify the build and the e2e in 9.4
- [x] 9.4 Update `tests/e2e/admin.spec.js` and the Add word e2e: report with reason (49 vs 50 characters), admin sees reason and states, approve, the entry stays listed after the first of two sense actions and shows "Reports closed" after the last, edit valid and invalid, reject, remove; an Add word e2e where the stubbed function answers `error` after two all-rejected attempts shows the manual form with "Suggestions unavailable"; Maks runs `npm test`

## 10. Per-sense curation: manual checks and docs

- [x] 10.1 Manual: run the backfill script after migration 2 and check the removed `Bank` meaning is dropped on the next request; make the stubbed model return only a rejected sense and see the retry, two `ai_calls` rows ("all senses rejected") and the manual form; reject one `Bank` sense and request `Bank` (sense gone); remove the whole suggestion and request again (avoid list in the call, new candidate); confirm a rephrased sense can reappear and can be rejected again
- [x] 10.2 Hand Maks the "Proposed doc updates" from design.md; do not edit SPEC.md or CLAUDE.md

## 11. Allow again: rejected senses section

- [x] 11.1 Add a NEW migration `20261015100000_allow_sense_again.sql` with `allow_sense_again(p_ids bigint[], p_records jsonb)` (security invoker, empty search_path, execute revoked from public, anon, authenticated and granted to service_role): deletes the rows of `p_ids` from `rejected_senses`, sets matching rejected senses of the named suggestions to candidate with `judged` removed, recomputes `status`, leaves `deleted_at`, `confirmed_at` and reports alone, raises on anything inconsistent; verify with `supabase db reset` and the integration cases in 11.4 (Maks runs them)
- [x] 11.2 `admin` function: actions `list_rejected` (capped, `ponytail:` comment) and `allow_again` (ids checked, fingerprints computed in code, rows and suggestions read with the service role, same per-request admin check); pure `groupRejected` and records-to-restore helper in `group.ts`; verify the unit tests in 11.4 and `curl` as non-admin returns 403 (Maks runs it)
- [x] 11.3 Admin page: tablist "Open reports" and "Rejected" with `aria-selected` and arrow, Home and End keys, panels, a section list for later sections, the Rejected list with "Allow again", empty, error and Retry states, all text via `textContent`; `db.js` needs no change (`invokeAdmin`); verify the build and the e2e in 11.4
- [x] 11.4 Tests: unit (`tests/unit/suggestion-admin.test.js`: `groupRejected`, records-to-restore helper), integration (`tests/integration/allow-sense-again.test.js` and the function-closed case in `rls.test.js`), e2e (`tests/e2e/admin.spec.js`: tabs, keyboard, lazy load, Allow again, failure, empty, forbidden); Maks runs `npm test`
- [x] 11.5 Manual: reject a `Bank` sense, open Admin, Rejected, select "Allow again", request `Bank` and see the sense can come back as a candidate (no "do not suggest" line for it in the call); also for a removed first-version record
- [x] 11.6 Hand Maks the added "Proposed doc updates" from design.md; do not edit SPEC.md or CLAUDE.md
