## Context

Greenfield repo: only `SPEC.md`, `CLAUDE.md` and an empty `openspec/`. Motivation in `proposal.md`; requirements in `specs/`. Constraints from CLAUDE.md: vanilla JS modules, only `db.js` imports `supabase-js` in `src/`, no secrets in the client, no client DELETE, migrations never edited once applied. Claude writes files; Maks runs `supabase init`, `npm install`, `supabase start`, tests and deploys.

## Goals / Non-Goals

**Goals:**
- A `/review.html`-style URL scheme that works in dev, build and Cloudflare Pages.
- Auth and RLS correct before any feature data exists, including cross-user foreign keys.
- Tests that fail if isolation breaks.

**Non-Goals:**
- Sign-out button in the UI (Settings is M4); `signOut()` exists but nothing calls it yet.
- Setup redirect, due counts, any real data on Home.
- Backups, CI, PWA, edge functions.

## Decisions

**1. Vite `root: 'src/pages'`.** The e2e test and returnTo use `/review.html`, which only works if pages sit at the server root. Config then points back up: `envDir: '../..'`, `publicDir: '../../public'`, `build.outDir: '../../dist'`, `emptyOutDir: true`, `server.fs.allow: ['../..']`. `build.rollupOptions.input` lists the seven HTML files explicitly (no glob; seven is small and explicit beats magic). Alternative: root at project root with pages at `/src/pages/x.html`; rejected, URLs get ugly and the deploy output path changes.

**2. `vite-plugin-handlebars` with block partials for the layout.** `src/layouts/base.html` is a partial using `{{> @partial-block}}`; each page wraps its content in `{{#> base}}...{{/base}}`. `partialDirectory: [src/layouts, src/components]`. Current-page marking uses a `context(pagePath)` function returning `{ page, nav: [{href, label, current}] }`; the sidebar loops with `{{#each nav}}` and `aria-current="page"`. No custom helpers. Alternative: mark the link in JS at runtime; rejected, flashes unmarked and needs a module on every page.

**3. Inline module imports, same depth.** With `root: 'src/pages'`, a relative `<link href>` or `<script src>` to `../js/...` would resolve against the URL root and escape it. Inline module scripts (`<script type="module">import '../styles/main.css'</script>` in the layout, `import '../js/pages/x.js'` in each page) resolve relative to the page file on disk, so they reach `src/js` and `src/styles` in dev and build. All pages must stay flat in `src/pages`. `main.css` adds `@source "../"` because Tailwind would otherwise scan only the Vite root.

**4. Auth shape.** `auth.js` wraps `supabase.auth` (`signInWithPassword`, `signOut`, `getSession`). `requireSession()` hides `<body>` until resolved (adds a `hidden` attribute set in the layout, removed on success) and redirects with `returnTo=encodeURIComponent(location.pathname + location.search)`. `safeReturnTo(value, origin)` lives in its own pure file `lib/return-to.js` (so unit tests never load the Supabase client) and accepts only strings that start with `/`, not `//` or `/\`, whose `new URL(value, location.origin).origin` equals `location.origin`, and that are not the sign-in path; anything else becomes `/`. Alternative: allowlist of known pages; rejected, breaks on every new page.

**5. Sign-up off in two places.** `config.toml`: `[auth] enable_signup = false` and `[auth.email] enable_signup = false`. Cloud: documented dashboard toggle in `docs/deploy.md`. Seed writes `auth.users` directly, which bypasses this.

**6. Migrations: three files.**
- `..._schema.sql`: tables, checks, defaults, unique constraints, indexes (`cards (user_id, due)`, GIN on `words.tags`).
- `..._rls.sql`: enable RLS, policies.
- `..._profile_trigger.sql`: `handle_new_user()` as `security definer` with `set search_path = ''`, `after insert on auth.users`.

`profiles.active_pair_id` is nullable (Setup is M1). `ai_calls` has an `error text` column. No `updated_at` trigger yet. FKs to `auth.users` use `on delete cascade`.

**7. RLS policies.** Per table, `to authenticated`, always `(select auth.uid())` for plan caching.

| Table | select | insert | update | delete |
| --- | --- | --- | --- | --- |
| profiles | own `id` | none (trigger) | own, with check on `active_pair_id` | none |
| language_pairs | own | own | own | none |
| words | own | own + pair owned | own + pair owned | none |
| cards | own | own + word owned | own + word owned | none |
| review_logs | own | own + card owned | none | none |
| ai_calls | own | none | none | none |

Ownership checks are `WITH CHECK (user_id = (select auth.uid()) and exists (select 1 from <parent> p where p.id = <fk> and p.user_id = (select auth.uid())))`. The `exists` runs under the caller's RLS, so a parent the caller cannot see counts as missing; no security-definer helper is needed. Alternative: composite FKs `(id, user_id)`; rejected, it changes the table shape from SPEC §4 and needs extra unique indexes. Deleting rows needs no policy: with RLS on and no DELETE policy, deletes match zero rows. Also revoke `delete` grants from `anon` and `authenticated` in the RLS migration so a later accidental policy is not enough on its own.

**8. Seed.** `supabase/seed.sql` inserts two rows into `auth.users` and `auth.identities` (provider `email`), password via `crypt('password123', gen_salt('bf'))`, `email_confirmed_at = now()`, and empty strings (not NULL) for the token columns (`confirmation_token`, `recovery_token`, `email_change`, `email_change_token_new`, `email_change_token_current`), since GoTrue fails to scan NULLs there. The trigger creates their profiles.

**9. Tests.**
- `vitest.config.js` includes `tests/unit/**` and `tests/integration/**`. `test:unit` runs `vitest run` with `passWithNoTests`. `test` runs `test:unit` then `test:e2e`.
- Integration tests need `supabase start`. They create clients with `supabase-js` directly (the `db.js` rule covers `src/` only) from `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env`. Setup: sign in as alice, insert one row per table (a pair, a word, a card, a log); `ai_calls` and the profile come from service role or the trigger. Service-role key comes from an env var `SUPABASE_SERVICE_ROLE_KEY` that is test-only, never in `.env.example` values or the client.
- Matrix per table: bob select returns 0 rows, bob insert with alice's `user_id` fails, bob update affects 0 rows, bob and alice delete affect 0 rows and the row still exists. Extra: the four cross-parent inserts and the `active_pair_id` update from the spec, plus `review_logs` update and `ai_calls` insert rejected for alice.
- Playwright: `webServer` runs `npm run dev`, `baseURL` is the dev server. The three e2e tests are in `tests/e2e/signin.spec.js`.

**10. Dependencies.** Exactly: `vite`, `vite-plugin-handlebars`, `tailwindcss`, `@tailwindcss/vite`, `@supabase/supabase-js`, `vitest`, `@playwright/test`.

## Risks / Trade-offs

- [`exists` checks add a subquery per write] → Single-user scale; the lookups hit primary keys.
- [Seed relies on GoTrue's internal `auth` schema columns, which can change between Supabase versions] → Seed is local-only; a failing `db reset` is loud and the fix is in one file.
- [Hiding `<body>` until the session check could leave a blank page if the script fails to load] → Acceptable; protected pages have no public content. Sign-in is not hidden.
- [Cloudflare Pages rewrites `/review.html` to `/review`] → `returnTo` is built from `location.pathname`, so both forms redirect back correctly. Noted in `docs/deploy.md`.
- [Integration tests depend on a running local Supabase] → `npm test` fails fast with a clear connection error; documented in the test file header and `docs/deploy.md`.
- [Dev fs access to files outside Vite root] → `server.fs.allow` set explicitly.

## Migration Plan

1. Maks runs `supabase init` (before any file edit to `config.toml`), then Claude edits `config.toml`.
2. `npm install`, `supabase start`, `supabase db reset` applies migrations and seed locally.
3. Run `npm test`; all RLS and sign-in tests pass.
4. Follow `docs/deploy.md`: create cloud project, `supabase link`, `supabase db push`, disable sign-ups, Cloudflare Pages deploy.

Rollback: migrations are forward-only. Before production, fix with `supabase db reset` locally and a new migration; never edit an applied file.

## Open Questions

- Whether to add a trigram index on `words` is deferred to M1 search, as SPEC §4 says.
