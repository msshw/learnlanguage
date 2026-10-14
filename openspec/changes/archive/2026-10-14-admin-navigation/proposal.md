## Why

The admin page only moderates reports. The admin cannot see who uses the app, what the AI costs per user, or what is in the shared suggestion store, so spend and abuse checks mean opening Studio.

## What Changes

- The admin area gets a second sidebar next to the main one, always expanded, with five items that each open their own page: Reports (`/admin.html`, with an open-reports count pill), Rejected, Suggestions, AI calls and Users. The tabs on the single admin page are removed.
- Users section: accounts with counts (words, reviews, practice attempts) and this month's AI calls and spend. No word text, sentences or review content.
- AI calls section: recent calls with user email, kind, model, tokens, cost, duration and ok/failed.
- Suggestions section: the shared store with status, sense states, report count and age.
- All three are read-only, fixed order (newest first), paged 50 rows at a time, loaded when its page opens. No sorting, filters, search or write actions.
- New read actions in the `admin` edge function (`list_users`, `list_ai_calls`, `list_suggestions`, `report_count`), backed by service-role-only SQL functions for the user and AI call joins.

## Capabilities

### New Capabilities
- `admin-views`: the Users, AI calls and Suggestions sections, their data limits, paging and server actions.

### Modified Capabilities
- `suggestion-moderation`: "Admin review page" becomes the Reports page and the tabs are replaced by the sub-navigation.

## Impact

- New migration with `admin_users` and `admin_ai_calls` (service role only).
- `supabase/functions/admin/`: actions `list_users`, `list_ai_calls`, `list_suggestions`, shaping in a pure module.
- `src/pages/admin*.html` (five pages), `src/components/admin-nav.html`, `src/js/pages/admin*.js` and shared `lib` modules for the admin guard and the table renderer, `src/js/lib/db.js` (no new client query path; all through `invokeAdmin`).
- Tests: unit (shaping, paging), integration (SQL functions closed to users), e2e (sub-navigation, pill, forbidden).
- SPEC.md §2 and §6 wording (see design.md).
