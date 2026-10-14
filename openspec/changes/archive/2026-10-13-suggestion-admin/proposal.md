## Why

A wrong suggestion in the shared cache reaches every later user. There is no way to report one, judge it sense by sense, or keep a rejected meaning from coming back.

## What Changes

- A "Report suggestion" action on the Add word sense list writes a complaint with a required reason (plain text, at least 50 characters). The reporter does not pick a sense. Reports are per-user rows, insert only, RLS by `user_id`.
- `profiles.is_admin` flag (set by hand). An admin-only page lists reported suggestions with the reasons and each sense's state. Per sense the admin can approve as is, edit and approve (one step, validated on the server like model output), or reject. "Remove" rejects every sense. Reports do not close on the first action: an entry stays listed until every non-rejected sense has been judged by an admin (approved, edited or rejected; a sense a user confirmed by an unchanged save is not judged until the admin approves it) or the record is removed. The closing action is stored as the resolution.
- **Per-sense state replaces record-level state.** Each sense in `ai_suggestions.senses` is `candidate`, `confirmed` or `rejected`. A user's unchanged save confirms only the picked sense. A cache hit needs at least one confirmed sense and serves every non-rejected sense. Rejected senses are never served or confirmable.
- **Reject forever.** A new service-only table `rejected_senses` remembers rejected senses by fingerprint. On a cache miss the `autofill` function lists them in the prompt as "do not suggest" and drops any model sense that matches one. If every model sense is dropped, `autofill` retries once with the rejected senses stressed in the prompt; if that also leaves nothing, the user gets the manual-entry fallback (status `error`), nothing is stored, and both attempts are logged ("all senses rejected") and count toward the monthly cap. Senses of records the first version removed are copied into `rejected_senses` by a one-off backfill step.
- Admin reads and writes go through an `admin` edge function that checks `is_admin` and uses the service role; the Admin nav entry shows only for admins.
- **Allow again.** The Admin page is split into sections by status shown as tabs: "Open reports" and "Rejected". "Rejected" lists `rejected_senses` (one entry per rejection, whether or not the suggestion still exists); "Allow again" deletes the entry's rows and puts its senses back to unjudged candidates in one service-role-only database function, through new `list_rejected` and `allow_again` admin actions.
- A new migration reshapes the already-applied `suggestion_admin` one (the applied file is not edited): per-sense states, report reason and resolutions, `rejected_senses`, a new moderation function. A later migration adds the allow-again function.

## Capabilities

### New Capabilities
- `suggestion-moderation`: reports with reasons and the admin review page with per-sense actions.

### Modified Capabilities
- `ai-suggestion-cache`: per-sense states, lookup, confirm by sense, rejected senses, manual removal replaced by moderation.
- `ai-autofill`: sense state in responses, cache hits by confirmed sense, sense-level confirm, avoid list and filter.
- `word-entry`: report action with a reason on suggested senses.
- `data-access-control`: `is_admin` flag, admin-only access path, report and rejected-sense tables.
- `app-shell`: conditional Admin nav entry.

## Impact

Depends on `ai-word-cache`. The first implementation of this change (migration `20261013100000_suggestion_admin.sql`, `admin` function, page, nav) exists but is not archived; this revision is a delta on top of it. Adds a second migration, changes to both edge functions, the admin page, the report form and `db.js`, plus tests. Single admin (the owner).
