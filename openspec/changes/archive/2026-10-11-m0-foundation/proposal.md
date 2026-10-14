## Why

Nothing exists yet. Every later milestone (words, review loop, AI auto-fill) needs a buildable multi-page site, a signed-in user, and a database whose row-level security is proven to isolate users. SPEC §8 puts this first so RLS and auth are right from day one, not retrofitted.

## What Changes

- Scaffold a Vite multi-page project with `root: 'src/pages'` (so URLs are `/review.html` etc.), `vite-plugin-handlebars` for layouts and components, and Tailwind via `@tailwindcss/vite`.
- Add the base layout with a left sidebar (Home, Review, Add word, Words, Settings) that marks the current page.
- Add pages: working sign-in with an inline error, Home with the "No words yet" empty state, and placeholder shells for setup, review, add, words, settings.
- Add `db.js` (only `supabase-js` importer) and `auth.js` (`signIn`, `signOut`, `getSession`, `requireSession` with a validated `returnTo`), plus one entry module per page.
- Add Supabase project config with sign-ups disabled, migrations for all six SPEC §4 tables, RLS on every table, a profile-creation trigger on `auth.users`, and a seed with `alice@test.local` and `bob@test.local`.
- RLS goes beyond `user_id = auth.uid()`: `WITH CHECK` ownership checks on foreign keys (`words.pair_id`, `cards.word_id`, `review_logs.card_id`, `profiles.active_pair_id`) so one user cannot attach rows to another user's parents. No DELETE policies; `review_logs` insert and select only; `ai_calls` select only for users.
- Add Vitest (unit and integration) and Playwright setup, an RLS integration test (including cross-user foreign key attempts), and a sign-in end-to-end spec.
- Add `docs/deploy.md` with the manual Supabase cloud and Cloudflare Pages steps.
- Out of scope: word forms, cards logic, scheduler, grader, queue, time, edge functions, PWA files, CI.

## Capabilities

### New Capabilities
- `app-shell`: multi-page build, shared layout and sidebar with current-page marking, Home empty state, page shells.
- `user-auth`: email and password sign-in and sign-out, session check on every page except sign-in, redirect to sign-in with a safe `returnTo`, sign-ups disabled.
- `data-access-control`: six-table schema, profile trigger, RLS isolating users including foreign key ownership, append-only review log, no client deletes.

### Modified Capabilities

None.

## Impact

- New files only: `package.json`, `vite.config.js`, `src/**`, `supabase/**`, `tests/**`, `docs/deploy.md`, `.env.example`, `.gitignore`.
- Dependencies: `vite`, `vite-plugin-handlebars`, `tailwindcss`, `@tailwindcss/vite`, `@supabase/supabase-js`, `vitest`, `@playwright/test`. Nothing else.
- Tooling: Maks runs `supabase init`, `npm install`, `supabase start`, tests, and deploys. Claude writes files only.
- Cloudflare Pages strips `.html` from URLs; `returnTo` uses `location.pathname + search` so redirects work either way.
