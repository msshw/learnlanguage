## Why

The app works end to end but cannot be lived in yet. Settings is a stub, there is no sign-out button, no way to take the data out, no install as an app, no visible sign that something broke, and no shortcut to add a word from anywhere. M4 closes these so two weeks of daily use can start.

## What Changes

- Settings page: language pair (read-only German ← English), daily new-word limit (integer 0 to 100, saved to the profile), this month's AI usage, "Export my data", and "Sign out".
- AI usage: the `autofill` function also answers `{action: "usage"}` with `{spent_usd, cap_usd}` for the signed-in user, using the existing cost code and price constant. Settings shows it. No model call and no `ai_calls` row.
- Export: one JSON file with all words (including deleted), cards and review logs, plus a format version and export time. Built by a pure function and downloaded from the browser.
- PWA: web app manifest, placeholder icons (192, 512, maskable) that Maks replaces later, and a service worker that caches the static shell only. It registers in production builds only.
- Global error bar: uncaught errors and unhandled rejections show a small dismissible bar and log to the console, on every page including sign-in.
- Error handling spec for what M2 added without one: the "Could not load your data" message with Retry when the profile fails to load.
- Add word shortcut: `Alt+A` opens Add word from any page (matched on the physical key). It does nothing on Add word itself.
- End-to-end tests: one full review session through the summary, plus Settings (limit persists, export parses and includes deleted words, sign out) and a mobile-width check that no page scrolls sideways. This completes the three flows in SPEC §7.
- Not in this change: password reset (SPEC §7 mentions it but gives it no milestone; propose moving it to "After the MVP"), offline reviews, changing the language pair, a stats page.

## Capabilities

### New Capabilities
- `settings`: the Settings page contents and behavior (pair display, daily limit, usage display, sign-out control).
- `data-export`: the export file content and download.
- `pwa`: manifest, icons and the static-shell service worker.
- `error-handling`: the data-load error with Retry and the global error bar.

### Modified Capabilities
- `ai-autofill`: the function answers a usage request without calling the model.
- `app-shell`: the `Alt+A` shortcut to Add word.
- `user-auth`: the sign-out operation gets a visible control in Settings.

## Impact

- New: `src/js/lib/export.js` (pure), `src/js/lib/error-bar.js`, `src/js/lib/pwa.js` (service worker registration), `public/manifest.webmanifest`, `public/sw.js`, icons, a small script that generates the icons, new e2e specs, unit tests.
- Changed: `src/pages/settings.html`, `src/js/pages/settings.js`, `src/layouts/base.html` (error bar, manifest link, worker registration, shortcut), `src/js/lib/db.js` (profile update, export queries, usage call), `supabase/functions/autofill/index.ts` (usage action) and a pure helper, the review-related e2e helpers.
- No migration: the profile update and all reads go through existing RLS policies.
- No new dependencies.
