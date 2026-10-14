## Context

`admin.html` is one page with tabs (Open reports, Rejected), and the `admin` function already checks `is_admin` on every request. This change adds three read-only views and replaces the tabs with a second sidebar where every item is its own page. Chosen with Maks: accounts and counts only (no user content), fixed read-only tables, no user changes.

## Decisions

- **Second sidebar, one page per item.** A new partial `src/components/admin-nav.html` fed by a nav list in `vite.config.js` (same pattern as the main sidebar). Pages: `admin.html` (Reports, URL unchanged so Alt+M and the main link keep working), `admin-rejected.html`, `admin-suggestions.html`, `admin-ai-calls.html`, `admin-users.html`, each a Vite page. Chosen with Maks: Rejected is its own item; no count on the main Admin link; the second sidebar never collapses. Layout: a flex row inside the page area, a strip above the content on narrow screens. Rejected: tabs with a hash (the first version of this change; panel swapping and `hashchange` bookkeeping).
- **Shared client modules.** `src/js/lib/admin-guard.js` (session, forbidden state "Not available", reveals the sub-navigation only for an admin, fills the Reports pill) and `src/js/lib/admin-table.js` (the column-driven table with paging and Retry). The old `admin.js` splits into `admin.js` (reports), `admin-rejected.js` and three small table pages.
- **Pill.** New action `report_count` (no body fields) returns `{status: "ok", count}`: suggestions with at least one open report, counted by the service role. One call per admin page load; a failure hides the pill. Alternative rejected: counting the result of `list` on every page.
- **Server actions.** `list_users`, `list_ai_calls`, `list_suggestions`, each `{offset}` only, 50 rows plus one to compute `has_more`. No client-chosen limit, sort, filter or column, so the client cannot widen what is read.
- **SQL functions for joins.** `admin_users(p_offset, p_limit)` and `admin_ai_calls(p_offset, p_limit)` are `security definer`, `search_path = ''`, execute revoked from public, anon and authenticated, granted to service_role. They read `auth.users` (email, created_at, last_sign_in_at) which PostgREST cannot join. `admin_users` returns counts only: non-deleted words, review_logs, sentence_logs, and this month's ai_calls count and token sums. Cost is computed in the function from the tokens with `costUsd` (one price config), never in SQL.
- **Privacy limit.** Selected columns are explicit; no `words`, `sentence`, `review_logs.typed` or `ai_calls.error`. A unit test on the shaping module asserts the response keys.
- **Suggestions** are read with the service role through PostgREST (`ai_suggestions` plus open report counts). Sense state counts and the "Removed" label are computed in the pure module `supabase/functions/admin/views.ts` (counts shaping, `has_more` trimming).
- **Client.** One generic table renderer in `admin-table.js` driven by a column list per page (header, cell getter), text only, Previous/Next, Retry. All calls through `invokeAdmin`.
- **Not done.** Sorting, search, filters, CSV, user actions (grant admin, disable, per-user cap), per-user drill-down. Add when a real need appears.

## Risks

- `admin_users` counts scan `review_logs` and `sentence_logs` per user: fine at personal scale. `ponytail` comment: add count caches or indexes if the user table grows past hundreds.
- Emails are personal data shown to the admin; limited to admins by the checks above and never logged.

## Migration plan

New migration `<timestamp>_admin_views.sql` adds the two functions. No table changes, no data backfill. Rollback: drop the functions.

## Proposed doc updates

- SPEC.md §2 Admin row: add "users, AI calls and suggestions views (read-only)".
- SPEC.md §6 admin actions: add `list_users`, `list_ai_calls`, `list_suggestions` (offset only, 50 rows, `has_more`).
- SPEC.md §4 access rules: add `admin_users` and `admin_ai_calls` as service-role-only functions.
- CLAUDE.md: no change (the admin rule already covers these actions).
