## 1. Database

- [x] 1.1 Add migration `<timestamp>_admin_views.sql` with `admin_users(p_offset, p_limit)` and `admin_ai_calls(p_offset, p_limit)`: security definer, `search_path = ''`, explicit columns only, execute revoked from public/anon/authenticated and granted to service_role; run `supabase db reset`
- [x] 1.2 Extend `tests/integration/rls.test.js`: alice calling either function is refused; the service role gets counts that match seeded data and no content columns

## 2. Edge function

- [x] 2.1 Add pure `supabase/functions/admin/views.ts` (page trimming and `has_more`, sense state counts, user and call row shaping with cost from `_shared/cost.ts`) with a unit test, including that no content keys are in the output
- [x] 2.2 Add actions `list_users`, `list_ai_calls`, `list_suggestions` to `supabase/functions/admin/index.ts` (offset validated, 50 rows, existing admin check)
- [x] 2.3 Add action `report_count` (`{status: "ok", count}`, suggestions with at least one open report, no body fields read) to `supabase/functions/admin/index.ts`; verify with curl: admin gets the count, alice gets 403, no token gets 401

## 3. Client: second sidebar, one page per item (replaces the tabs built earlier)

- [x] 3.1 Add `src/components/admin-nav.html` (five links, `aria-current` on the current one, a count pill on Reports, hidden by default) and its nav data in `vite.config.js`; add the four new pages to the Vite `pages`; mark the main "Admin" link current on all five; layout CSS in `src/styles/main.css` using design tokens (row on wide screens, strip on narrow; never collapses)
- [x] 3.2 Add `src/js/lib/admin-guard.js` (session, forbidden "Not available", reveals the sub-navigation for admins only, fills the pill with `report_count`, hides it on 0 or failure) and `src/js/lib/admin-table.js` (the table renderer from `admin.js`)
- [x] 3.3 Split `src/pages/admin.html` and `src/js/pages/admin.js` into the five pages: Reports (`/admin.html`), `admin-rejected`, `admin-suggestions`, `admin-ai-calls`, `admin-users`; remove the tablist, the hash handling and lazy tab loading; keep every existing Reports and Rejected behaviour

## 4. Tests and checks

- [x] 4.1 Update `tests/e2e/admin.spec.js` (tabs and hash tests become sub-navigation tests): five links in order, `aria-current`, each page requests only its own action plus `report_count`, pill shows the count and hides at 0, main Admin link current on all pages, bob sees "Not available" with no sub-navigation on every page, Users and AI calls rows and paging, email with markup shown as text; add a unit test for the pill logic if it is pure
- [x] 4.2 Run `npm run test:unit`, `npm run test:e2e`, `npm run build` and the curl checks in a subagent (see CLAUDE.md), leaving the functions server running; Maks reviews the admin area in the browser

## 5. Docs

- [x] 5.1 Applied (Maks approved) the SPEC.md edits listed under "Proposed doc updates" in design.md
- [x] 5.2 Applied (Maks approved): SPEC.md §2 Admin row says sections/tabs: reword to "a second sidebar with Reports, Rejected, Suggestions, AI calls and Users pages"; §6 admin actions add `report_count`
