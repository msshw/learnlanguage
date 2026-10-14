Claude writes files only. Maks runs every command; each "Verify" names what he checks.

## 1. Project scaffold

- [x] 1.1 Write `package.json` (scripts `dev`, `build`, `preview`, `test`, `test:unit`, `test:e2e`; dependencies per design decision 10), `.env.example` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) and `.gitignore` (includes `.env`, `node_modules`, `dist`). Verify: `npm install` succeeds and `.env` is ignored.
- [x] 1.2 Write `vite.config.js` with `root: 'src/pages'`, `envDir`, `publicDir`, `outDir`, `server.fs.allow`, explicit seven-page `rollupOptions.input`, `@tailwindcss/vite`, and `vite-plugin-handlebars` (`partialDirectory` for layouts and components, `context(pagePath)` returning `page` and `nav`). Verify: `npm run build` produces seven HTML files in `dist`.
- [x] 1.3 Write `src/styles/main.css` (Tailwind entry, muted base styles). Verify: styles apply on any page in `npm run dev`.

## 2. Layout and pages

- [x] 2.1 Write `src/layouts/base.html` (head, stylesheet link, `hidden` body attribute until session check, block partial slot) and `src/components/sidebar.html` (nav loop, `aria-current="page"`, stacks on narrow screens). Verify: Words page marks only the Words link as current.
- [x] 2.2 Write `src/pages/index.html` with the "No words yet" empty state and an "Add word" link to `/add.html`. Verify: signed in as alice, Home shows the text and link, link opens Add word.
- [x] 2.3 Write placeholder shells `setup.html`, `review.html`, `add.html`, `words.html`, `settings.html` (heading plus one line, no logic). Verify: each opens at its `.html` path in dev.
- [x] 2.4 Write `src/pages/signin.html` (no sidebar, email and password fields, "Sign in" button, error element with `role="alert"`, no framework). Verify: page renders with no sidebar.

## 3. Client lib and page modules

- [x] 3.1 Write `src/js/lib/db.js` creating the Supabase client from `import.meta.env` (the only `supabase-js` import in `src/`). Verify: `grep -r supabase-js src` matches only `db.js`.
- [x] 3.2 Write `src/js/lib/auth.js` with `signIn`, `signOut`, `getSession`, `requireSession` (reveals body, or redirects with `returnTo` from `pathname + search`) and a pure `lib/return-to.js` exporting `safeReturnTo(value, origin)` (same-origin path only, not `//`, not sign-in). Verify with 3.4.
- [x] 3.3 Write one entry module per page in `src/js/pages/` (`index`, `setup`, `review`, `add`, `words`, `settings` call `requireSession()`; `signin` handles submit, disables button while pending, shows error via `textContent`, keeps email, clears password, redirects to `safeReturnTo`). Wire each page's `<script type="module">`. Verify: signed-out visit to any protected page redirects.
- [x] 3.4 Write `tests/unit/return-to.test.js` covering `safeReturnTo`: accepts `/review.html?x=1`, rejects `https://evil.test`, `//evil.test`, `/\evil`, `/signin.html`, empty and non-strings. Verify: `npm run test:unit` passes this file.

## 4. Supabase config and migrations

- [x] 4.1 Maks runs `supabase init`; then Claude edits `supabase/config.toml` to set `enable_signup = false` under `[auth]` and `[auth.email]`. Verify: `supabase start` runs and a sign-up call is rejected.
- [x] 4.2 Write `supabase/migrations/<ts>_schema.sql`: six tables per SPEC §4 with types, defaults, checks (`part_of_speech`, `source`, `direction`, `state`, `grader_result`, `rating` 1 to 4, `cardinality(translations) >= 1`), unique constraints, `cards (user_id, due)` index, GIN on `words.tags`, `ai_calls.error`, `on delete cascade` to `auth.users`. Verify: `supabase db reset` applies cleanly.
- [x] 4.3 Write `supabase/migrations/<ts>_rls.sql`: enable RLS on all tables, policies per design decision 7 with `(select auth.uid())` and parent-ownership `exists` checks in `WITH CHECK`, no DELETE policies, revoke `delete` from `anon` and `authenticated`. Verify: the integration tests in 5.2 pass.
- [x] 4.4 Write `supabase/migrations/<ts>_profile_trigger.sql`: `handle_new_user()` as `security definer` with `set search_path = ''`, trigger after insert on `auth.users`. Verify: a new auth user gets a profile with defaults and null `active_pair_id`.
- [x] 4.5 Write `supabase/seed.sql` with alice and bob in `auth.users` and `auth.identities` (bcrypt `password123`, confirmed, token columns as empty strings) and nothing else. Verify: after `supabase db reset`, alice signs in and has a profile and no words.

## 5. Tests

- [x] 5.1 Write `vitest.config.js` (includes `tests/unit/**` and `tests/integration/**`, `passWithNoTests`) and `playwright.config.js` (`webServer` runs `npm run dev`, `baseURL`, `tests/e2e`). Verify: `npm run test:unit` and `npx playwright test --list` start without config errors.
- [x] 5.2 Write `tests/integration/rls.test.js` implementing the design decision 9 matrix for all six tables, the four cross-parent inserts, the `active_pair_id` update, the `user_id` reassignment, `review_logs` update and `ai_calls` insert rejected, and anonymous reads empty. Header comment states it needs `supabase start` and the three env vars. Verify: `npm run test:unit` passes against a fresh `supabase db reset`.
- [x] 5.3 Write `tests/e2e/signin.spec.js`: wrong password shows the inline error; alice signs in and lands on the Home empty state; signed-out `/review.html` redirects to sign-in and returns to `/review.html` after sign-in. Verify: `npm run test:e2e` passes.

## 6. Deploy notes

- [x] 6.1 Write `docs/deploy.md`: create the Supabase cloud project, `supabase link`, `supabase db push`, disable sign-ups in the dashboard, create the one real user, Cloudflare Pages project (build command `npm run build`, output `dist`, env vars `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`), first deploy, the `.html` stripping note, and the local test prerequisites. Verify: Maks follows it end to end and the site signs in on the Pages URL with sign-ups off.
