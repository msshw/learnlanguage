# Deploy

Manual steps for the first production deploy. There is no CI: migrations go up with the Supabase CLI, the site deploys when you push to `main`.

## Prerequisites for local work

1. Docker running, Supabase CLI installed.
2. `supabase start`, then `supabase db reset` (applies migrations and the seed).
3. `supabase status -o env` prints `API_URL`, `ANON_KEY` and `SERVICE_ROLE_KEY`. Copy `.env.example` to `.env` and fill in:
   - `VITE_SUPABASE_URL` = `API_URL`
   - `VITE_SUPABASE_ANON_KEY` = `ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` = `SERVICE_ROLE_KEY` (integration tests only)
4. `npm install`, then `npm run test:unit` (includes the RLS integration tests, which need Supabase running) and `npm run test:e2e`.

## 1. Create the Supabase cloud project

1. Open the Supabase dashboard, then New project.
2. Pick a name, a region close to you, and a strong database password. Save the password in your password manager.
3. Wait until the project is ready.
4. Settings, API: copy the Project URL and the `anon` public key. You need them in step 4. Do not copy the `service_role` key anywhere in this setup.

## 2. Link and push migrations

```bash
supabase login
supabase link --project-ref <project-ref>
supabase db push
```

`<project-ref>` is the string in the project URL (`https://<project-ref>.supabase.co`). `db push` applies everything in `supabase/migrations`. It does not run `seed.sql`, so the test users stay local. Never edit a migration after it is applied; add a new file.

## 3. Disable sign-ups and create your user

1. Authentication, Sign In / Providers (or Settings): turn off "Allow new users to sign up". Make sure the email provider stays enabled.
2. Authentication, Users, Add user, Create new user: enter your email and a password, tick "Auto Confirm User".
3. Check Table Editor, `profiles`: a row exists for your user (created by the trigger).

## 4. Create the Cloudflare Pages project

1. Cloudflare dashboard, Workers & Pages, Create, Pages, Connect to Git. Pick the repository.
2. Build settings:
   - Production branch: `main`
   - Build command: `npm run build`
   - Build output directory: `dist`
3. Environment variables (Production and Preview):
   - `VITE_SUPABASE_URL` = the Project URL from step 1
   - `VITE_SUPABASE_ANON_KEY` = the `anon` key from step 1
   - Do not set `SUPABASE_SERVICE_ROLE_KEY` here.
4. Save and deploy.

## 5. First deploy check

1. Open the Pages URL. You land on the sign-in page.
2. Sign in with the user from step 3. You land on Home with "No words yet".
3. Open `/review.html` in a private window. It redirects to sign-in and returns to the page after sign-in.
4. Try creating an account through the API (for example `POST <project-url>/auth/v1/signup`). It must be rejected.

Cloudflare Pages serves `/review.html` as `/review`. Both URLs work: the app builds `returnTo` from `location.pathname`, and the sign-in page accepts `/signin` and `/signin.html`.

## Later deploys

1. `supabase db push` if there are new migrations (run them locally first with `supabase db reset`).
2. Run `npm test` locally.
3. Push to `main`. Cloudflare builds and deploys. Branches get a preview URL.

## App behavior that matters at deploy time

- The service worker (`public/sw.js`) registers only in production builds. To check install locally, run `npm run build` then `npm run preview` and open the preview URL in Chrome. When you change `sw.js`, bump its `CACHE` constant.
- Deploy the `autofill` function before the site: Settings asks it for this month's usage (`{action: "usage"}`).
- Placeholder icons are in `public/` (`icon-192.png`, `icon-512.png`, `icon-maskable-512.png`). Replace the three files with real artwork; the manifest only needs the names. `node scripts/make-icons.mjs` rewrites the placeholders.
- Alt+A opens Add word from any page with the sidebar.
- Never run `supabase db reset` against the linked project (`--linked`). It wipes the auth data, so every session ends and signing in again is the only way back. Deploying functions and `supabase db push` leave sessions alone.

## Browsers that cannot reach Supabase on 127.0.0.1

Some embedded browsers (for example the Claude Desktop one) show "Failed to fetch" on sign-in because they block the page's call to `http://127.0.0.1:54321`. Run `npm run dev:proxy` instead of `npm run dev`. It serves the app on `http://localhost:5173` and forwards `/supabase/*` to local Supabase, so the browser only talks to one origin. Use port 5173 (the script fails if it is taken) and open `http://localhost:5173`. `.env` stays unchanged, so tests are unaffected. The proxy exists only in the dev server, never in a build.

## SPEC.md edits to make

- Move password reset (SPEC §7, Auth) to "After the MVP"; no milestone covers it.
- Tick the M3 and M4 acceptance criteria once they pass.
